<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./media/brand/fullboard-logo-dark.svg">
    <img alt="FullBoard" src="./media/brand/fullboard-logo-light.svg" height="56">
  </picture>
</p>

<p align="center">
  <b>One calm, monochrome panel for Xray-core, Telegram WEB Proxy and every server you run.</b>
</p>

<p align="center">
  <a href="https://github.com/WeIbSchatten/FullBoard/releases"><img src="https://img.shields.io/github/v/release/WeIbSchatten/FullBoard?style=flat-square&color=111111&label=release" alt="Release"></a>
  <a href="https://github.com/WeIbSchatten/FullBoard/actions"><img src="https://img.shields.io/github/actions/workflow/status/WeIbSchatten/FullBoard/release.yml?style=flat-square&color=111111" alt="Build"></a>
  <a href="https://www.gnu.org/licenses/gpl-3.0.en.html"><img src="https://img.shields.io/badge/license-GPL--3.0-111111?style=flat-square" alt="License"></a>
  <a href="https://pkg.go.dev/github.com/WeIbSchatten/FullBoard/v3"><img src="https://img.shields.io/badge/go-reference-111111?style=flat-square" alt="Go Reference"></a>
</p>

<p align="center">
  <b>English</b> · <a href="./README.ru_RU.md">Русский</a>
  &nbsp;|&nbsp;
  <a href="#quick-start">Quick start</a> ·
  <a href="#features">Features</a> ·
  <a href="./docs/content/docs/en/index.mdx">Documentation</a>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./media/screenshots/overview-dark.png">
    <img alt="FullBoard overview" src="./media/screenshots/overview-light.png" width="900">
  </picture>
</p>

**FullBoard** is a self-hosted web panel for [Xray-core](https://github.com/XTLS/Xray-core) servers.
It started from the 3x-ui idea and grew into its own product: a redesigned interface, the official
**Telegram WEB Proxy** relay with per-client secrets, one-shot node invites, and servers that come up
tuned for speed.

> [!IMPORTANT]
> FullBoard is meant for personal use. Do not use it for anything illegal where you live.

## Quick start

```bash
bash <(curl -Ls https://raw.githubusercontent.com/WeIbSchatten/FullBoard/main/install.sh)
```

The installer:

- downloads the latest release and verifies its `.sha256`;
- generates a random username, password and secret web path;
- installs the systemd service with a hardened sandbox;
- enables **BBR + fq** and larger TCP buffers (opt out with `XUI_NET_TUNING=false`);
- sets up Fail2ban for per-client IP limits.

Then open the printed URL, or run `fullboard` for the management menu.

<details>
<summary>Other ways to install</summary>

```bash
# a specific release
bash <(curl -Ls https://raw.githubusercontent.com/WeIbSchatten/FullBoard/main/install.sh) v1.4.4

# the rolling dev build from main
bash <(curl -Ls https://raw.githubusercontent.com/WeIbSchatten/FullBoard/main/install.sh) dev-latest

# Docker (SQLite by default; add --profile postgres for the bundled PostgreSQL)
docker compose up -d
```

Unattended installs (cloud-init and friends): set `XUI_NONINTERACTIVE=1` or run without a TTY.
Credentials go to `/etc/fullboard/install-result.env`. See [`deploy/`](deploy/).

</details>

## Features

<table>
<tr>
<td width="50%" valign="top">

### Protocols
VLESS + REALITY / XTLS-Vision, VMess, Trojan, Shadowsocks, WireGuard, **AmneziaWG**
(in-process, no kernel module), **TUIC v5**, Hysteria2, MTProto, SOCKS / HTTP, Tunnel and TUN.
Transports: Raw, XHTTP, WebSocket, gRPC, HTTPUpgrade, mKCP.

</td>
<td width="50%" valign="top">

### Telegram WEB Proxy
Install the official `tproxy-server` relay from the panel, behind your own landing page.
Profiles, share links and QR codes, **a dedicated secret per client**, and MTProxy backends
the panel starts and firewalls for you.

</td>
</tr>
<tr>
<td valign="top">

### Clients
Traffic quotas, expiry dates, IP and HWID device limits, scheduled renewals, groups,
live online status, share links, QR codes and raw / Clash / JSON subscriptions.

</td>
<td valign="top">

### Many servers, one panel
Add a server with a **one-shot invite**: no copying API tokens around. Inbound sync,
cloning, mTLS between master and nodes, heartbeat alerts to Telegram and Discord.

</td>
</tr>
<tr>
<td valign="top">

### Routing
WARP, NordVPN and PIA outbounds, balancers with fallback chains, proxy chaining, and a
rule editor with browsable geosite / geoip categories.

</td>
<td valign="top">

### Operations
REST API with scoped tokens and a built-in reference, PWA install, backups, Telegram and
Discord bots, SQLite or PostgreSQL, 13 languages, light / dark / AMOLED themes.

</td>
</tr>
</table>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./media/screenshots/clients-dark.png">
    <img alt="Clients page" src="./media/screenshots/clients-light.png" width="900">
  </picture>
</p>

## How it fits together

```mermaid
flowchart LR
  Admin["Admin browser"] -->|HTTPS| Panel["FullBoard panel"]
  Panel -->|config + gRPC API| Xray["Xray-core"]
  Panel -->|systemd| Relay["tproxy-server + MTProxy"]
  Panel -->|mTLS API| Nodes["Other FullBoard nodes"]
  Users["Client apps"] -->|VLESS / Trojan / ...| Xray
  TG["Telegram apps"] -->|HTTPS / WebSocket| Relay
```

## Speed

Fresh servers usually ship with `cubic` + `fq_codel` and small socket buffers. On long routes that
caps a single connection well below the link. FullBoard writes
`/etc/sysctl.d/99-fullboard-network.conf` on install and update (BBR, `fq`, 32 MiB buffers, MTU
probing). For the fastest transport, use **VLESS + REALITY + Vision**. The full checklist is in
[Performance](docs/content/docs/en/operations/performance.mdx).

## Management

| Command | What it does |
| --- | --- |
| `fullboard` | Interactive menu |
| `fullboard start` / `stop` / `restart` / `status` | Control the service |
| `fullboard settings` | Show the panel address and settings |
| `fullboard log` | Recent logs |
| `fullboard update` | Update to the latest release |
| `fullboard uninstall` | Remove the panel |

Files: binary and Xray in `/usr/local/fullboard`, database in `/etc/fullboard`, logs in
`/var/log/fullboard`, unit `fullboard.service`.

<details>
<summary>Database: SQLite or PostgreSQL</summary>

SQLite (`/etc/fullboard/fullboard.db`) is the default and needs no setup. PostgreSQL is better for
many clients or nodes. The installer can set it up locally or use an existing DSN:

```
XUI_DB_TYPE=postgres
XUI_DB_DSN=postgres://xui:password@127.0.0.1:5432/xui?sslmode=disable
```

To move existing data, run `fullboard migrate-db --dsn "<dsn>"`. Then set the two variables in
`/etc/default/fullboard` and run `systemctl restart fullboard`.

</details>

<details>
<summary>Environment variables</summary>

| Variable | Description | Default |
| --- | --- | --- |
| `XUI_DB_TYPE` | `sqlite` or `postgres` | `sqlite` |
| `XUI_DB_DSN` | PostgreSQL connection string | — |
| `XUI_DB_FOLDER` | Folder for the SQLite file | `/etc/fullboard` |
| `XUI_INIT_WEB_BASE_PATH` | Initial web path of the panel | `/` |
| `XUI_PORT` | Override the panel port | — |
| `XUI_ENABLE_FAIL2BAN` | Fail2ban-based IP limits | `true` |
| `XUI_NET_TUNING` | BBR + fq + TCP buffers on install/update | `true` |
| `XUI_LOG_LEVEL` | `debug`, `info`, `warning`, `error` | `info` |
| `XUI_TUNNEL_HEALTH_MONITOR` | Probe a URL and restart Xray after repeated failures | `false` |
| `NODE_TOKEN_ENCRYPTION` | Node API tokens at rest: `off`, `migration`, `required` | `off` |

The full list is in the [environment variables reference](docs/content/docs/en/reference/env-vars.mdx).

</details>

**Platforms:** Ubuntu, Debian, Armbian, Fedora, CentOS / RHEL / Alma / Rocky / Oracle, Amazon Linux,
Arch, Manjaro, openSUSE, Alpine, Windows. Architectures: `amd64`, `386`, `arm64`, `armv7`, `armv6`,
`armv5`, `s390x`.

## Documentation

| | |
| --- | --- |
| [Installation](docs/content/docs/en/guide/installation.mdx) | Script, Docker, manual |
| [First login](docs/content/docs/en/guide/first-login.mdx) | Reach and harden the panel |
| [REALITY](docs/content/docs/en/config/reality.mdx) | VLESS + REALITY + Vision step by step |
| [Telegram WEB Proxy](docs/content/docs/en/operations/tg-web-proxy.mdx) | Relay, profiles, client secrets |
| [Multi-node](docs/content/docs/en/operations/multi-node.mdx) | Invites, sync, mTLS |
| [Performance](docs/content/docs/en/operations/performance.mdx) | BBR, transports, speed checklist |
| [Troubleshooting](docs/content/docs/en/help/troubleshooting.mdx) | Common problems and fixes |

## Contributing

Read the [contributing guide](CONTRIBUTING.md) before opening a pull request. To report a
vulnerability, see [SECURITY.md](SECURITY.md).

## Acknowledgments

- [3x-ui](https://github.com/MHSanaei/3x-ui), the project FullBoard grew out of.
- [Xray-core](https://github.com/XTLS/Xray-core) and [tproxy-server](https://github.com/telegramdesktop/tproxy-server).
- [Iran v2ray rules](https://github.com/chocolate4u/Iran-v2ray-rules) and [Russia v2ray rules](https://github.com/runetfreedom/russia-v2ray-rules-dat) (GPL-3.0).

## License

[GPL-3.0](LICENSE).
