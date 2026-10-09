[English](/README.md) | [فارسی](/README.fa_IR.md) | [العربية](/README.ar_EG.md) | [中文](/README.zh_CN.md) | [Español](/README.es_ES.md) | [Русский](/README.ru_RU.md) | [Türkçe](/README.tr_TR.md)

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./media/fullboard-dark.png">
    <img alt="FullBoard" src="./media/fullboard-light.png">
  </picture>
</p>

<p align="center">
  <a href="https://github.com/WeIbSchatten/FullBoard/releases"><img src="https://img.shields.io/github/v/release/WeIbSchatten/FullBoard" alt="Release"></a>
  <a href="https://github.com/WeIbSchatten/FullBoard/actions"><img src="https://img.shields.io/github/actions/workflow/status/WeIbSchatten/FullBoard/release.yml.svg" alt="Build"></a>
  <a href="https://www.gnu.org/licenses/gpl-3.0.en.html"><img src="https://img.shields.io/badge/license-GPL%20V3-blue.svg?longCache=true" alt="License"></a>
  <a href="https://pkg.go.dev/github.com/WeIbSchatten/FullBoard/v3"><img src="https://pkg.go.dev/badge/github.com/WeIbSchatten/FullBoard/v3.svg" alt="Go Reference"></a>
</p>

**FullBoard** is an open-source web control panel for [Xray-core](https://github.com/XTLS/Xray-core) servers. It gives you one multi-language interface to deploy, configure, and monitor a wide range of proxy and VPN protocols, from a single VPS up to multi-node deployments.

> [!IMPORTANT]
> This project is intended for personal use. Do not use it for illegal purposes.

## Features

- **Multi-protocol inbounds**: VLESS, VMess, Trojan, Shadowsocks, WireGuard, AmneziaWG, TUIC v5, Hysteria2, MTProto, HTTP, SOCKS (Mixed), Dokodemo-door / Tunnel, and TUN.
- **Modern transports and security**: TCP (Raw), mKCP, WebSocket, gRPC, HTTPUpgrade, and XHTTP, secured with TLS, XTLS, and REALITY.
- **Built-in AmneziaWG**: DPI-resistant WireGuard runs inside the panel on a userspace network stack, with no kernel module, DKMS, or extra packages.
- **Native TUIC v5 server**: an in-process QUIC server with Xray routing and per-client traffic accounting (BBR and New Reno congestion control).
- **MTProto proxies**: per-client FakeTLS secrets, ad-tags, and quotas, applied live without dropping existing connections.
- **Fallbacks**: serve several protocols on one port (for example VLESS and Trojan on 443).
- **Per-client management**: traffic quotas, expiry dates, IP limits with trusted-address exemptions, HWID device limits, scheduled renewals, live online status, share links, QR codes, and subscriptions.
- **Traffic statistics** per inbound, per client, and per outbound, with reset controls.
- **Multi-node**: manage many servers from one panel, including cloning inbounds onto other nodes.
- **Outbounds and routing**: WARP, NordVPN, PIA, custom routing rules, load balancers with fallback chains, and outbound proxy chaining. Bundled geosite/geoip categories are browsable from the rule editor.
- **Subscription server**: raw, JSON, and Clash output, picked from the client's User-Agent, plus [custom page templates](docs/custom-subscription-templates.md).
- **Telegram and Discord bots** for remote monitoring and management.
- **REST API** with scoped, optionally expiring tokens and an in-panel API reference.
- **Installable panel (PWA)** for desktop and mobile home screens.
- **Storage**: SQLite (default) or PostgreSQL.
- **13 UI languages** with dark and light themes.
- **Fail2ban integration** to enforce per-client IP limits.

## Screenshots

<details>
<summary>Click to expand</summary>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./media/01-overview-dark.png">
  <img alt="Overview" src="./media/01-overview-light.png">
</picture>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./media/02-add-inbound-dark.png">
  <img alt="Inbounds" src="./media/02-add-inbound-light.png">
</picture>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./media/03-add-client-dark.png">
  <img alt="Add client" src="./media/03-add-client-light.png">
</picture>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./media/05-add-nodes-dark.png">
  <img alt="Nodes" src="./media/05-add-nodes-light.png">
</picture>

</details>

## Quick Start

```bash
bash <(curl -Ls https://raw.githubusercontent.com/WeIbSchatten/FullBoard/main/install.sh)
```

To install a specific release, append its tag:

```bash
bash <(curl -Ls https://raw.githubusercontent.com/WeIbSchatten/FullBoard/main/install.sh) v3.7.0
```

To install the rolling **dev** build (latest per-commit pre-release from `main`), pass `dev-latest`:

```bash
bash <(curl -Ls https://raw.githubusercontent.com/WeIbSchatten/FullBoard/main/install.sh) dev-latest
```

The installer generates a random username, password, and access path. Afterwards, run `fullboard` to open the management menu: start/stop the service, view or reset credentials, manage SSL certificates, and more.

Every release asset ships with a `.sha256` file. Both `install.sh` and the updater verify the archive against it and abort on a mismatch.

Full documentation (installation, configuration, operations, API reference) lives in the [`docs/`](docs/) folder.

### Unattended install

The installer also runs **non-interactively** (for example from cloud-init). Set `XUI_NONINTERACTIVE=1`, or run it without a TTY, and it installs with zero prompts, generating random credentials and writing them to `/etc/fullboard/install-result.env`. See [`deploy/`](deploy/) for:

- [Cloud-init user-data](deploy/cloud-init/) for any cloud provider
- [Hetzner Cloud notes](deploy/marketplace/hetzner/)

### Management

| Command | What it does |
| --- | --- |
| `fullboard` | Interactive management menu |
| `fullboard start` / `stop` / `restart` | Control the service |
| `fullboard status` | Show service status |
| `fullboard settings` | Show current panel settings |
| `fullboard log` | Show recent logs |
| `fullboard update` | Update to the latest release |
| `fullboard uninstall` | Remove the panel |

Paths: binary and Xray assets in `/usr/local/fullboard`, database and state in `/etc/fullboard`, logs in `/var/log/fullboard`, service unit `fullboard.service`.

## Supported Platforms

**Operating systems:** Ubuntu, Debian, Armbian, Fedora, CentOS, RHEL, AlmaLinux, Rocky Linux, Oracle Linux, Amazon Linux, Virtuozzo, Arch, Manjaro, Parch, openSUSE (Tumbleweed / Leap), Alpine, and Windows.

**Architectures:** `amd64` · `386` · `arm64` (aarch64) · `armv7` · `armv6` · `armv5` · `s390x`.

## Database Options

FullBoard supports two backends, chosen during install:

- **SQLite** (default): a single file at `/etc/fullboard/fullboard.db`. No setup, good for small and medium deployments.
- **PostgreSQL**: recommended for many clients or multi-node setups. The installer can install PostgreSQL locally or use a DSN for an existing server.

The backend is selected with environment variables (the installer writes them to `/etc/default/fullboard`):

```
XUI_DB_TYPE=postgres
XUI_DB_DSN=postgres://xui:password@127.0.0.1:5432/xui?sslmode=disable
```

### Migrating SQLite to PostgreSQL

```bash
fullboard migrate-db --dsn "postgres://xui:password@127.0.0.1:5432/xui?sslmode=disable"
# then set XUI_DB_TYPE and XUI_DB_DSN in /etc/default/fullboard and restart:
systemctl restart fullboard
```

The source SQLite file is left untouched; remove it yourself once the new backend is verified.

## Docker

```bash
docker compose up -d
```

The default compose setup uses SQLite. To use the bundled PostgreSQL service, uncomment the two `XUI_DB_*` lines in `docker-compose.yml` and start with the profile:

```bash
docker compose --profile postgres up -d
```

The image bundles Fail2ban (enabled by default) to enforce per-client **IP limits**. Fail2ban bans with `iptables`, which needs the `NET_ADMIN` capability. `docker-compose.yml` already grants it; with plain `docker run`, add the capabilities yourself, otherwise bans are logged but never applied:

```bash
docker run -d --cap-add=NET_ADMIN --cap-add=NET_RAW -p 2053:2053 -v $PWD/db/:/etc/fullboard/ ghcr.io/weibschatten/fullboard
```

## Environment Variables

| Variable | Description | Default |
| --- | --- | --- |
| `XUI_DB_TYPE` | Database backend: `sqlite` or `postgres` | `sqlite` |
| `XUI_DB_DSN` | PostgreSQL connection string (when `XUI_DB_TYPE=postgres`) | — |
| `XUI_DB_FOLDER` | Directory for the SQLite database file | `/etc/fullboard` |
| `XUI_DB_MAX_OPEN_CONNS` | Maximum open connections (PostgreSQL pool) | — |
| `XUI_DB_MAX_IDLE_CONNS` | Maximum idle connections (PostgreSQL pool) | — |
| `XUI_INIT_WEB_BASE_PATH` | Initial URI path of the web panel | `/` |
| `XUI_PORT` | Override the panel listen port | — |
| `XUI_ENABLE_FAIL2BAN` | Enable Fail2ban-based IP-limit enforcement | `true` |
| `XUI_LOG_LEVEL` | Log verbosity (`debug`, `info`, `warning`, `error`) | `info` |
| `XUI_DEBUG` | Enable debug mode | `false` |
| `XUI_TUNNEL_HEALTH_MONITOR` | Probe a URL and restart Xray after repeated failures (a restart drops all clients) | `false` |
| `XUI_TUNNEL_HEALTH_PROXY` | Proxy for the probe, e.g. a local inbound (`socks5://127.0.0.1:1080`); empty checks host connectivity only | — |
| `XUI_TUNNEL_HEALTH_URL` | URL probed for tunnel health | `https://www.cloudflare.com/cdn-cgi/trace` |
| `XUI_TUNNEL_HEALTH_INTERVAL` | Interval between probes | `30s` |
| `XUI_TUNNEL_HEALTH_TIMEOUT` | Per-probe timeout | `10s` |
| `XUI_TUNNEL_HEALTH_FAILURES` | Consecutive failures before a restart | `3` |
| `XUI_TUNNEL_HEALTH_COOLDOWN` | Minimum delay between restarts | `5m` |
| `NODE_TOKEN_ENCRYPTION` | Encryption at rest for node API tokens: `off`, `migration`, or `required` | `off` |
| `XUI_NODE_TOKEN_KEY_FILE` | JSON keyring (mode `0600`) with the active key id and base64 32-byte keys | `/etc/fullboard/node_token_key.json` |
| `XUI_NODE_TOKEN_KEY` | A single base64 32-byte key, used when the key file cannot be loaded | — |

The full list is in the [environment variables reference](docs/content/docs/en/reference/env-vars.mdx).

## Supported Languages

English · فارسی · العربية · 中文（简体） · 中文（繁體） · Español · Русский · Українська · Türkçe · Tiếng Việt · 日本語 · Bahasa Indonesia · Português (Brasil)

## Contributing

Contributions are welcome. Please read the [Contributing Guide](/CONTRIBUTING.md) before opening an issue or pull request. Security issues: see [SECURITY.md](/SECURITY.md).

## Acknowledgments

- [Iran v2ray rules](https://github.com/chocolate4u/Iran-v2ray-rules) (GPL-3.0): enhanced routing rules with built-in Iranian domains, focused on security and ad blocking.
- [Russia v2ray rules](https://github.com/runetfreedom/russia-v2ray-rules-dat) (GPL-3.0): automatically updated routing rules based on blocked domains and addresses in Russia.

## License

FullBoard is licensed under the [GNU General Public License v3.0](/LICENSE).
