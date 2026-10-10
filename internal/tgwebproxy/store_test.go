package tgwebproxy

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"testing"
)

type recordedCall struct {
	name string
	args []string
}

type fakeRunner struct {
	calls []recordedCall
	// respond returns output/error for a call; nil means success with no output.
	respond func(name string, args []string) ([]byte, error)
}

func (f *fakeRunner) run(_ context.Context, name string, args ...string) ([]byte, error) {
	f.calls = append(f.calls, recordedCall{name: name, args: args})
	if f.respond != nil {
		return f.respond(name, args)
	}
	return nil, nil
}

func newTestStore(t *testing.T, runner *fakeRunner) (*Store, Paths) {
	t.Helper()
	dir := t.TempDir()
	paths := Paths{
		ConfigFile:   filepath.Join(dir, "etc", "config.json"),
		ProfilesFile: filepath.Join(dir, "etc", "profiles.json"),
		Binary:       filepath.Join(dir, "tproxy-server"),
		JobDir:       filepath.Join(dir, "jobs"),
		SourceDir:    filepath.Join(dir, "src"),
	}
	if err := os.WriteFile(paths.Binary, []byte("#!/bin/true\n"), 0o755); err != nil {
		t.Fatal(err)
	}
	return NewStore(paths, runner.run), paths
}

func testConfig() RelayConfig {
	cfg := NewRelayConfig()
	cfg.PublicHostname = "proxy.example.com"
	return cfg
}

func TestStoreApplyRunsCheckOnCandidatesAndCommits(t *testing.T) {
	runner := &fakeRunner{}
	store, paths := newTestStore(t, runner)
	if err := os.MkdirAll(filepath.Dir(paths.ConfigFile), 0o750); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(paths.ConfigFile, []byte(`{"public_hostname":"old.example.com","public_dir":"/srv/site","future_key":{"x":1}}`), 0o640); err != nil {
		t.Fatal(err)
	}

	store.mu.Lock()
	err := store.applyLocked(context.Background(), testConfig(), []RelayProfile{validProfile()})
	store.mu.Unlock()
	if err != nil {
		t.Fatalf("apply: %v", err)
	}

	if len(runner.calls) != 1 {
		t.Fatalf("expected exactly one -check call, got %d", len(runner.calls))
	}
	want := []string{"-config", paths.ConfigFile + candidateSuffix, "-profiles-file", paths.ProfilesFile + candidateSuffix, "-check"}
	if strings.Join(runner.calls[0].args, " ") != strings.Join(want, " ") {
		t.Fatalf("check args = %v, want %v", runner.calls[0].args, want)
	}

	raw, err := os.ReadFile(paths.ConfigFile)
	if err != nil {
		t.Fatal(err)
	}
	var written map[string]any
	if err := json.Unmarshal(raw, &written); err != nil {
		t.Fatal(err)
	}
	if written["public_hostname"] != "proxy.example.com" || written["public_dir"] != "" {
		t.Fatalf("known keys not replaced: hostname=%v public_dir=%v", written["public_hostname"], written["public_dir"])
	}
	if _, ok := written["future_key"]; !ok {
		t.Fatal("unknown key future_key was dropped from config.json")
	}
	if _, err := os.Stat(paths.ConfigFile + backupSuffix); err != nil {
		t.Fatalf("previous config.json not kept: %v", err)
	}
	if _, err := os.Stat(paths.ProfilesFile + candidateSuffix); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("candidate profiles left behind: %v", err)
	}
	if runtime.GOOS != "windows" {
		if mode := FileMode(paths.ProfilesFile); mode != "0400" {
			t.Fatalf("profiles.json mode = %s, want 0400", mode)
		}
	}
	snap, err := store.Load()
	if err != nil || len(snap.Profiles) != 1 || snap.Profiles[0].Name != "default" {
		t.Fatalf("reload = %+v, %v", snap.Profiles, err)
	}
}

func TestStoreApplyFailedCheckLeavesLiveFilesUntouched(t *testing.T) {
	runner := &fakeRunner{respond: func(string, []string) ([]byte, error) {
		return []byte("configuration error: token_key_file missing"), errors.New("exit status 1")
	}}
	store, paths := newTestStore(t, runner)
	if err := os.MkdirAll(filepath.Dir(paths.ConfigFile), 0o750); err != nil {
		t.Fatal(err)
	}
	original := []byte(`{"public_hostname":"live.example.com"}`)
	if err := os.WriteFile(paths.ConfigFile, original, 0o640); err != nil {
		t.Fatal(err)
	}

	initial := validProfile()
	err := store.SaveConfig(context.Background(), testConfig(), &initial)
	if err == nil || !strings.Contains(err.Error(), "token_key_file missing") {
		t.Fatalf("error = %v, want the -check output surfaced", err)
	}
	got, _ := os.ReadFile(paths.ConfigFile)
	if string(got) != string(original) {
		t.Fatalf("live config.json changed after failed check: %s", got)
	}
	if _, err := os.Stat(paths.ProfilesFile); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("profiles.json was created despite failed check: %v", err)
	}
	for _, p := range []string{paths.ConfigFile + candidateSuffix, paths.ProfilesFile + candidateSuffix} {
		if _, err := os.Stat(p); !errors.Is(err, os.ErrNotExist) {
			t.Fatalf("candidate %s left behind", p)
		}
	}
}

func TestWrapConfigWriteErrorHintsSandbox(t *testing.T) {
	err := wrapConfigWriteError(fmt.Errorf("open candidate: %w", syscall.EROFS))
	if err == nil || !strings.Contains(err.Error(), "ReadWritePaths=-/etc/tproxy-server") {
		t.Fatalf("error = %v, want ReadWritePaths hint", err)
	}
	if !errors.Is(err, syscall.EROFS) {
		t.Fatalf("wrapped error must still match EROFS, got %v", err)
	}
	plain := errors.New("permission denied")
	if wrapConfigWriteError(plain) != plain {
		t.Fatal("non-EROFS errors must pass through unchanged")
	}
}

func TestStoreRefusesToWriteWithoutBinary(t *testing.T) {
	runner := &fakeRunner{}
	store, paths := newTestStore(t, runner)
	if err := os.Remove(paths.Binary); err != nil {
		t.Fatal(err)
	}
	initial := validProfile()
	err := store.SaveConfig(context.Background(), testConfig(), &initial)
	if !errors.Is(err, ErrBinaryMissing) {
		t.Fatalf("error = %v, want ErrBinaryMissing", err)
	}
	if _, err := os.Stat(paths.ConfigFile); !errors.Is(err, os.ErrNotExist) {
		t.Fatal("config.json written without a -check")
	}
}

// MutateProfiles must keep carrier_mode through check+commit so WebSocket
// profiles are not silently rewritten to https on disk.
func TestMutateProfilesPreservesCarrierModeWebSocket(t *testing.T) {
	runner := &fakeRunner{}
	store, paths := newTestStore(t, runner)
	initial := validProfile()
	if err := store.SaveConfig(context.Background(), testConfig(), &initial); err != nil {
		t.Fatal(err)
	}
	err := store.MutateProfiles(context.Background(), func(list []RelayProfile) ([]RelayProfile, error) {
		list[0].CarrierMode = "websocket"
		return list, nil
	})
	if err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(paths.ProfilesFile)
	if err != nil {
		t.Fatal(err)
	}
	disk, err := ParseProfiles(raw)
	if err != nil {
		t.Fatal(err)
	}
	if len(disk) != 1 || disk[0].CarrierMode != "websocket" {
		t.Fatalf("disk carrier_mode = %+v, want websocket", disk)
	}
	snap, err := store.Load()
	if err != nil {
		t.Fatal(err)
	}
	if snap.Profiles[0].CarrierMode != "websocket" {
		t.Fatalf("load carrier_mode = %q, want websocket", snap.Profiles[0].CarrierMode)
	}
}
