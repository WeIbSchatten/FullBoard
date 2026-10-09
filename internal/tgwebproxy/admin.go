package tgwebproxy

import (
	"bufio"
	"context"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type RelayAdminProbe struct {
	Address     string             `json:"address" example:"127.0.0.1:8081"`
	Reachable   bool               `json:"reachable" example:"true"`
	Healthy     bool               `json:"healthy" example:"true"`
	Ready       bool               `json:"ready" example:"true"`
	ReadyDetail string             `json:"readyDetail" example:""`
	Metrics     map[string]float64 `json:"metrics"`
	Error       string             `json:"error" example:""`
	CheckedAt   int64              `json:"checkedAt" example:"1760000000"`
}

// adminClient never consults HTTP(S)_PROXY: the admin listener is loopback-only
// and must not be reached through, or leaked to, an outbound proxy.
var adminClient = &http.Client{
	Timeout:   4 * time.Second,
	Transport: &http.Transport{Proxy: nil, DisableKeepAlives: true},
	CheckRedirect: func(*http.Request, []*http.Request) error {
		return http.ErrUseLastResponse
	},
}

// ProbeAdmin queries /healthz, /readyz and /metrics server-side. The address is
// re-validated as loopback so an edited config cannot turn this into an SSRF.
func ProbeAdmin(ctx context.Context, address string) RelayAdminProbe {
	probe := RelayAdminProbe{Address: address, Metrics: map[string]float64{}, CheckedAt: time.Now().Unix()}
	if err := ValidateLoopbackAddress(address); err != nil {
		probe.Error = "admin_listen " + err.Error()
		return probe
	}
	base := "http://" + address
	status, _, err := adminGet(ctx, base+"/healthz")
	if err != nil {
		probe.Error = err.Error()
		return probe
	}
	probe.Reachable = true
	probe.Healthy = status == http.StatusOK
	status, body, err := adminGet(ctx, base+"/readyz")
	if err == nil {
		probe.Ready = status == http.StatusOK
		if !probe.Ready {
			probe.ReadyDetail = strings.TrimSpace(body)
		}
	}
	if status, body, err := adminGet(ctx, base+"/metrics"); err == nil && status == http.StatusOK {
		probe.Metrics = ParseMetrics(body)
	}
	return probe
}

func adminGet(ctx context.Context, url string) (int, string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return 0, "", err
	}
	resp, err := adminClient.Do(req)
	if err != nil {
		return 0, "", err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 256*1024))
	if err != nil {
		return resp.StatusCode, "", err
	}
	return resp.StatusCode, string(body), nil
}

// ParseMetrics reads the relay's flat Prometheus text format ("name value").
func ParseMetrics(body string) map[string]float64 {
	out := map[string]float64{}
	scanner := bufio.NewScanner(strings.NewReader(body))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 2 || strings.ContainsAny(fields[0], "{}") {
			continue
		}
		if v, err := strconv.ParseFloat(fields[1], 64); err == nil {
			out[fields[0]] = v
		}
	}
	return out
}
