package tgwebproxy

import (
	"encoding/base64"
	"encoding/hex"
	"net/url"
)

// basePathSecretMarker prefixes the secret in links that carry a base path so
// an older client cannot accept the link as a pathless proxy (see BASE_PATH.md).
const basePathSecretMarker = 0x70

type RelayShareInfo struct {
	Profile string `json:"profile" example:"default"`
	// Server is what a user types into the client: hostname[/base_path].
	Server string `json:"server" example:"proxy.example.com"`
	// Secret is the value typed by hand; under a base path it stays plain hex.
	Secret string `json:"secret" example:"000102030405060708090a0b0c0d0e0f"`
	// LinkSecret is the secret form embedded in links (marked under a base path).
	LinkSecret  string `json:"linkSecret" example:"000102030405060708090a0b0c0d0e0f"`
	Link        string `json:"link" example:"https://t.me/webproxy?server=proxy.example.com&secret=000102030405060708090a0b0c0d0e0f"`
	DeepLink    string `json:"deepLink" example:"tg://webproxy?server=proxy.example.com&secret=000102030405060708090a0b0c0d0e0f"`
	CarrierMode string `json:"carrierMode" example:"https"`
}

func BuildShareInfo(hostname, basePath string, p RelayProfile) (RelayShareInfo, error) {
	secret, err := DecodeSecret(p.Secret)
	if err != nil {
		return RelayShareInfo{}, err
	}
	server := hostname
	plain := hex.EncodeToString(secret)
	linkSecret := plain
	if basePath != "" {
		server = hostname + "/" + basePath
		marked := append([]byte{basePathSecretMarker}, secret...)
		linkSecret = base64.RawURLEncoding.EncodeToString(marked)
	}
	query := "server=" + url.QueryEscape(server) + "&secret=" + url.QueryEscape(linkSecret)
	mode := p.CarrierMode
	if mode == "" {
		mode = "https"
	}
	return RelayShareInfo{
		Profile:     p.Name,
		Server:      server,
		Secret:      plain,
		LinkSecret:  linkSecret,
		Link:        "https://t.me/webproxy?" + query,
		DeepLink:    "tg://webproxy?" + query,
		CarrierMode: mode,
	}, nil
}
