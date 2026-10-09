package tgwebproxy

import "testing"

// Vectors are the ones published in the upstream README / deploy/install.sh.
func TestBuildShareInfo(t *testing.T) {
	tests := []struct {
		name       string
		basePath   string
		secret     string
		server     string
		plain      string
		linkSecret string
		link       string
	}{
		{
			name:       "root deployment keeps plain hex",
			secret:     "000102030405060708090a0b0c0d0e0f",
			server:     "proxy.example.com",
			plain:      "000102030405060708090a0b0c0d0e0f",
			linkSecret: "000102030405060708090a0b0c0d0e0f",
			link:       "https://t.me/webproxy?server=proxy.example.com&secret=000102030405060708090a0b0c0d0e0f",
		},
		{
			name:       "base path marks the link secret with 0x70",
			basePath:   "phcf2vfe7zgbrslg",
			secret:     "8561944064fc730cbfa4473562d8ec59",
			server:     "proxy.example.com/phcf2vfe7zgbrslg",
			plain:      "8561944064fc730cbfa4473562d8ec59",
			linkSecret: "cIVhlEBk_HMMv6RHNWLY7Fk",
			link:       "https://t.me/webproxy?server=proxy.example.com%2Fphcf2vfe7zgbrslg&secret=cIVhlEBk_HMMv6RHNWLY7Fk",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := BuildShareInfo("proxy.example.com", tt.basePath, RelayProfile{Name: "p", Secret: tt.secret})
			if err != nil {
				t.Fatalf("BuildShareInfo: %v", err)
			}
			if got.Server != tt.server || got.Secret != tt.plain || got.LinkSecret != tt.linkSecret || got.Link != tt.link {
				t.Fatalf("got server=%q secret=%q linkSecret=%q link=%q", got.Server, got.Secret, got.LinkSecret, got.Link)
			}
			if got.CarrierMode != "https" {
				t.Fatalf("carrier mode default = %q, want https", got.CarrierMode)
			}
		})
	}
}
