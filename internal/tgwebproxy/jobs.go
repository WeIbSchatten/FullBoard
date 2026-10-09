package tgwebproxy

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

// UpstreamTarball is the relay source the installer builds from; the upstream
// scripts verify Caddy, Go and MTProxy checksums themselves.
const UpstreamTarball = "https://codeload.github.com/telegramdesktop/tproxy-server/tar.gz/HEAD"

var (
	emailPattern  = regexp.MustCompile(`^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$`)
	installSecret = regexp.MustCompile(`^(dd)?[0-9a-f]{32}$`)
)

type RelayInstallRequest struct {
	Hostname string `json:"hostname" example:"proxy.example.com"`
	Email    string `json:"email" example:"admin@example.com"`
	// Secret is written to a 0400 file and fed to the installer on stdin, so it
	// never appears in a process list or unit environment.
	Secret         string `json:"secret" example:"000102030405060708090a0b0c0d0e0f"`
	SiteUpstream   string `json:"siteUpstream" example:"http://127.0.0.1:3000"`
	SiteDir        string `json:"siteDir" example:""`
	BasePath       string `json:"basePath" example:"none"`
	MtproxyWorkers int    `json:"mtproxyWorkers" example:"1"`
}

func (r RelayInstallRequest) Validate() error {
	if err := ValidateHostname(r.Hostname); err != nil {
		return fmt.Errorf("hostname: %w", err)
	}
	if !emailPattern.MatchString(r.Email) {
		return errors.New("a valid ACME contact email is required")
	}
	if !installSecret.MatchString(r.Secret) {
		return errors.New("secret must be 32 lowercase hex characters, optionally prefixed with dd")
	}
	if (r.SiteUpstream == "") == (r.SiteDir == "") {
		return errors.New("set exactly one of siteUpstream or siteDir")
	}
	if r.SiteUpstream != "" {
		if err := validatePublicUpstream(r.SiteUpstream); err != nil {
			return fmt.Errorf("siteUpstream: %w", err)
		}
	}
	if r.SiteDir != "" && (!filepath.IsAbs(r.SiteDir) || strings.ContainsAny(r.SiteDir, "\n\r'")) {
		return errors.New("siteDir must be an absolute path")
	}
	if r.BasePath != "" && r.BasePath != "none" &&
		(len(r.BasePath) > maxBasePathLength || !basePathPattern.MatchString(r.BasePath)) {
		return errors.New("basePath: segments must match [A-Za-z0-9][A-Za-z0-9_-]* joined by /, or \"none\"")
	}
	if r.MtproxyWorkers < 0 || r.MtproxyWorkers > 256 {
		return errors.New("mtproxyWorkers must be between 1 and 256")
	}
	return nil
}

type RelayJobStatus struct {
	Kind      string `json:"kind" example:"install"`
	Unit      string `json:"unit" example:"fullboard-tproxy-install-1760000000"`
	State     string `json:"state" example:"running"`
	ExitCode  *int   `json:"exitCode"`
	StartedAt int64  `json:"startedAt" example:"1760000000"`
	Log       string `json:"log" example:""`
}

type jobRecord struct {
	Kind      string `json:"kind"`
	Unit      string `json:"unit"`
	StartedAt int64  `json:"startedAt"`
}

type jobRunner struct {
	dir       string
	sourceDir string
	run       commandRunner
	mu        sync.Mutex
}

func (j *jobRunner) file(name string) string { return filepath.Join(j.dir, name) }

func (j *jobRunner) startInstall(ctx context.Context, req RelayInstallRequest) (RelayJobStatus, error) {
	if err := req.Validate(); err != nil {
		return RelayJobStatus{}, err
	}
	args := []string{"--hostname", req.Hostname, "--email", req.Email}
	if req.SiteUpstream != "" {
		args = append(args, "--site-upstream", req.SiteUpstream)
	} else {
		args = append(args, "--site-dir", req.SiteDir)
	}
	if req.BasePath != "" {
		args = append(args, "--base-path", req.BasePath)
	}
	if req.MtproxyWorkers > 0 {
		args = append(args, "--mtproxy-workers", strconv.Itoa(req.MtproxyWorkers))
	}
	return j.start(ctx, "install", "./deploy/install.sh "+shellJoin(args), req.Secret)
}

func (j *jobRunner) startUpdate(ctx context.Context) (RelayJobStatus, error) {
	return j.start(ctx, "update", "./deploy/update-relay.sh", "")
}

func (j *jobRunner) start(ctx context.Context, kind, command, secret string) (RelayJobStatus, error) {
	j.mu.Lock()
	defer j.mu.Unlock()
	if current := j.statusLocked(ctx); current.State == "running" {
		return current, errors.New("another tg-web-proxy job is still running")
	}
	if err := os.MkdirAll(j.dir, 0o700); err != nil {
		return RelayJobStatus{}, err
	}
	for _, name := range []string{"job.log", "job.exit", "job.secret"} {
		prepareReplace(j.file(name))
		_ = os.Remove(j.file(name))
	}
	stdin := "/dev/null"
	if secret != "" {
		if err := writeExclusive(j.file("job.secret"), []byte(secret+"\n"), 0o400); err != nil {
			return RelayJobStatus{}, err
		}
		stdin = j.file("job.secret")
	}
	script := buildJobScript(j.sourceDir, command, stdin, j.file("job.secret"), j.file("job.log"), j.file("job.exit"))
	if err := os.WriteFile(j.file("job.sh"), []byte(script), 0o700); err != nil {
		return RelayJobStatus{}, err
	}
	now := time.Now().Unix()
	unit := fmt.Sprintf("fullboard-tproxy-%s-%d", kind, now)
	out, err := j.run(ctx, "systemd-run", "--unit", unit, "--collect", "--quiet", "/bin/bash", j.file("job.sh"))
	if err != nil {
		_ = os.Remove(j.file("job.secret"))
		return RelayJobStatus{}, fmt.Errorf("systemd-run: %s", firstNonEmpty(strings.TrimSpace(string(out)), err.Error()))
	}
	record, _ := json.Marshal(jobRecord{Kind: kind, Unit: unit, StartedAt: now})
	if err := os.WriteFile(j.file("job.json"), record, 0o600); err != nil {
		return RelayJobStatus{}, err
	}
	return j.statusLocked(ctx), nil
}

// buildJobScript fetches a fresh upstream tree and runs one deploy script in it.
// The exit file is written last so its presence alone means "finished".
func buildJobScript(sourceDir, command, stdin, secretFile, logFile, exitFile string) string {
	q := shellQuote
	return strings.Join([]string{
		"#!/bin/bash",
		"set -uo pipefail",
		"umask 077",
		"(",
		"  set -e",
		"  src=" + q(sourceDir),
		`  rm -rf "$src.new" && mkdir -p "$src.new"`,
		"  curl -fsSL --retry 3 " + q(UpstreamTarball) + ` | tar -xz --strip-components=1 -C "$src.new"`,
		`  rm -rf "$src" && mv "$src.new" "$src"`,
		`  cd "$src"`,
		`  echo "== upstream source ready in $src =="`,
		"  " + command + " < " + q(stdin),
		") >> " + q(logFile) + " 2>&1",
		"code=$?",
		"rm -f " + q(secretFile),
		"echo \"$code\" > " + q(exitFile),
		"",
	}, "\n")
}

func (j *jobRunner) status(ctx context.Context) RelayJobStatus {
	j.mu.Lock()
	defer j.mu.Unlock()
	return j.statusLocked(ctx)
}

func (j *jobRunner) statusLocked(ctx context.Context) RelayJobStatus {
	st := RelayJobStatus{State: "idle"}
	raw, err := os.ReadFile(j.file("job.json"))
	if err != nil {
		return st
	}
	var rec jobRecord
	if json.Unmarshal(raw, &rec) != nil {
		return st
	}
	st.Kind, st.Unit, st.StartedAt = rec.Kind, rec.Unit, rec.StartedAt
	st.Log = tailFile(j.file("job.log"), 16*1024)
	if raw, err := os.ReadFile(j.file("job.exit")); err == nil {
		if code, err := strconv.Atoi(strings.TrimSpace(string(raw))); err == nil {
			st.ExitCode = &code
			st.State = "succeeded"
			if code != 0 {
				st.State = "failed"
			}
			return st
		}
	}
	cctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	out, _ := j.run(cctx, "systemctl", "is-active", rec.Unit+".service")
	switch strings.TrimSpace(string(out)) {
	case "active", "activating":
		st.State = "running"
	default:
		st.State = "failed"
	}
	return st
}

func tailFile(path string, limit int64) string {
	f, err := os.Open(path)
	if err != nil {
		return ""
	}
	defer f.Close()
	if info, err := f.Stat(); err == nil && info.Size() > limit {
		_, _ = f.Seek(info.Size()-limit, io.SeekStart)
	}
	data, _ := io.ReadAll(f)
	return string(data)
}

func shellQuote(s string) string {
	return "'" + strings.ReplaceAll(s, "'", `'\''`) + "'"
}

func shellJoin(args []string) string {
	quoted := make([]string, len(args))
	for i, a := range args {
		quoted[i] = shellQuote(a)
	}
	return strings.Join(quoted, " ")
}
