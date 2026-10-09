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

**FullBoard** 是一个用于管理 [Xray-core](https://github.com/XTLS/Xray-core) 服务器的开源 Web 控制面板。它提供统一的多语言界面，用于部署、配置和监控多种代理与 VPN 协议，适用于从单台 VPS 到多节点部署的各种场景。

> [!IMPORTANT]
> 本项目仅供个人使用，请勿用于任何非法用途。

## 功能

- **多协议入站**：VLESS、VMess、Trojan、Shadowsocks、WireGuard、AmneziaWG、TUIC v5、Hysteria2、MTProto、HTTP、SOCKS（Mixed）、Dokodemo-door / Tunnel 和 TUN。
- **现代传输与安全**：TCP（Raw）、mKCP、WebSocket、gRPC、HTTPUpgrade 和 XHTTP，支持 TLS、XTLS 和 REALITY。
- **内置 AmneziaWG**：抗 DPI 的 WireGuard 在面板内的用户态网络栈上运行，无需内核模块、DKMS 或额外软件包。
- **原生 TUIC v5 服务器**：进程内 QUIC 服务器，支持 Xray 路由和按客户端统计流量（BBR 与 New Reno）。
- **MTProto 代理**：每个客户端独立的 FakeTLS 密钥、ad-tag 和配额，实时生效且不中断现有连接。
- **回落（Fallback）**：在同一端口上提供多种协议（例如 443 端口同时提供 VLESS 和 Trojan）。
- **客户端管理**：流量配额、到期时间、带可信地址豁免的 IP 限制、HWID 设备限制、定期续期、在线状态、分享链接、二维码和订阅。
- **流量统计**：按入站、客户端和出站统计，并可重置。
- **多节点**：在一个面板中管理多台服务器，可将入站克隆到其他节点。
- **出站与路由**：WARP、NordVPN、PIA、自定义路由规则、带回落链的负载均衡器以及出站代理链。可在规则编辑器中直接浏览内置的 geosite/geoip 分类。
- **订阅服务器**：根据客户端 User-Agent 输出 raw、JSON 或 Clash 格式，并支持[自定义页面模板](docs/custom-subscription-templates.md)。
- **Telegram 与 Discord 机器人**，用于远程监控和管理。
- **REST API**：支持限定权限、可设置过期时间的令牌，并内置 API 参考文档。
- **可安装的面板（PWA）**，适用于桌面和手机。
- **存储**：SQLite（默认）或 PostgreSQL。
- **13 种界面语言**，支持深色和浅色主题。
- **Fail2ban 集成**，用于执行按客户端的 IP 限制。

## 截图

<details>
<summary>点击展开</summary>

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

## 快速开始

```bash
bash <(curl -Ls https://raw.githubusercontent.com/WeIbSchatten/FullBoard/main/install.sh)
```

安装指定版本时，在末尾加上版本标签：

```bash
bash <(curl -Ls https://raw.githubusercontent.com/WeIbSchatten/FullBoard/main/install.sh) v3.7.0
```

安装 **dev** 构建（`main` 分支最新的预发布版本）时，传入 `dev-latest`：

```bash
bash <(curl -Ls https://raw.githubusercontent.com/WeIbSchatten/FullBoard/main/install.sh) dev-latest
```

安装程序会生成随机的用户名、密码和访问路径。安装完成后运行 `fullboard` 打开管理菜单，可启动/停止服务、查看或重置登录凭据、管理 SSL 证书等。

每个发布文件都附带 `.sha256` 校验文件。`install.sh` 和更新程序都会校验压缩包，不匹配时终止。

完整文档（安装、配置、运维和 API 参考）位于 [`docs/`](docs/) 目录。

### 无人值守安装

安装程序支持**非交互模式**（例如在 cloud-init 中）。设置 `XUI_NONINTERACTIVE=1` 或在无 TTY 环境下运行，它会生成随机凭据并写入 `/etc/fullboard/install-result.env`。参见 [`deploy/`](deploy/)：

- 适用于任意云平台的 [Cloud-init user-data](deploy/cloud-init/)
- [Hetzner Cloud 说明](deploy/marketplace/hetzner/)

### 管理

| 命令 | 作用 |
| --- | --- |
| `fullboard` | 交互式管理菜单 |
| `fullboard start` / `stop` / `restart` | 控制服务 |
| `fullboard status` | 查看服务状态 |
| `fullboard settings` | 查看当前面板设置 |
| `fullboard log` | 查看最近日志 |
| `fullboard update` | 更新到最新版本 |
| `fullboard uninstall` | 卸载面板 |

路径：程序和 Xray 资源位于 `/usr/local/fullboard`，数据库和状态位于 `/etc/fullboard`，日志位于 `/var/log/fullboard`，服务单元为 `fullboard.service`。

## 支持的平台

**操作系统：** Ubuntu、Debian、Armbian、Fedora、CentOS、RHEL、AlmaLinux、Rocky Linux、Oracle Linux、Amazon Linux、Virtuozzo、Arch、Manjaro、Parch、openSUSE（Tumbleweed / Leap）、Alpine 和 Windows。

**架构：** `amd64` · `386` · `arm64`（aarch64）· `armv7` · `armv6` · `armv5` · `s390x`。

## 数据库

FullBoard 支持两种后端，在安装时选择：

- **SQLite**（默认）：单个文件 `/etc/fullboard/fullboard.db`。无需配置，适合中小规模部署。
- **PostgreSQL**：推荐用于客户端较多或多节点的场景。安装程序可以在本地安装 PostgreSQL，也可以使用现有服务器的 DSN。

后端通过环境变量选择（安装程序会写入 `/etc/default/fullboard`）：

```
XUI_DB_TYPE=postgres
XUI_DB_DSN=postgres://xui:password@127.0.0.1:5432/xui?sslmode=disable
```

### 从 SQLite 迁移到 PostgreSQL

```bash
fullboard migrate-db --dsn "postgres://xui:password@127.0.0.1:5432/xui?sslmode=disable"
# 然后在 /etc/default/fullboard 中设置 XUI_DB_TYPE 和 XUI_DB_DSN 并重启：
systemctl restart fullboard
```

源 SQLite 文件不会被修改；确认新后端正常后可手动删除。

## Docker

```bash
docker compose up -d
```

默认使用 SQLite。如需使用内置的 PostgreSQL 服务，请取消注释 `docker-compose.yml` 中的两行 `XUI_DB_*`，并使用 profile 启动：

```bash
docker compose --profile postgres up -d
```

镜像内置 Fail2ban（默认启用），用于执行按客户端的 **IP 限制**。封禁通过 `iptables` 实现，需要 `NET_ADMIN` 权限。`docker-compose.yml` 已授予该权限；若使用 `docker run`，请自行添加，否则封禁只会被记录而不会生效：

```bash
docker run -d --cap-add=NET_ADMIN --cap-add=NET_RAW -p 2053:2053 -v $PWD/db/:/etc/fullboard/ ghcr.io/weibschatten/fullboard
```

## 环境变量

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `XUI_DB_TYPE` | 数据库后端：`sqlite` 或 `postgres` | `sqlite` |
| `XUI_DB_DSN` | PostgreSQL 连接字符串 | — |
| `XUI_DB_FOLDER` | SQLite 数据库文件目录 | `/etc/fullboard` |
| `XUI_DB_MAX_OPEN_CONNS` | 最大打开连接数（PostgreSQL 连接池） | — |
| `XUI_DB_MAX_IDLE_CONNS` | 最大空闲连接数（PostgreSQL 连接池） | — |
| `XUI_INIT_WEB_BASE_PATH` | 面板初始 URI 路径 | `/` |
| `XUI_PORT` | 覆盖面板监听端口 | — |
| `XUI_ENABLE_FAIL2BAN` | 启用基于 Fail2ban 的 IP 限制 | `true` |
| `XUI_LOG_LEVEL` | 日志级别（`debug`、`info`、`warning`、`error`） | `info` |
| `XUI_DEBUG` | 调试模式 | `false` |
| `XUI_TUNNEL_HEALTH_MONITOR` | 探测 URL，连续失败后重启 Xray（重启会断开所有客户端） | `false` |
| `XUI_TUNNEL_HEALTH_PROXY` | 探测使用的代理，例如本地入站（`socks5://127.0.0.1:1080`） | — |
| `XUI_TUNNEL_HEALTH_URL` | 探测的 URL | `https://www.cloudflare.com/cdn-cgi/trace` |
| `XUI_TUNNEL_HEALTH_INTERVAL` | 探测间隔 | `30s` |
| `XUI_TUNNEL_HEALTH_TIMEOUT` | 单次探测超时 | `10s` |
| `XUI_TUNNEL_HEALTH_FAILURES` | 触发重启的连续失败次数 | `3` |
| `XUI_TUNNEL_HEALTH_COOLDOWN` | 两次重启之间的最短间隔 | `5m` |
| `NODE_TOKEN_ENCRYPTION` | 节点令牌静态加密：`off`、`migration` 或 `required` | `off` |
| `XUI_NODE_TOKEN_KEY_FILE` | JSON 密钥环（权限 `0600`） | `/etc/fullboard/node_token_key.json` |
| `XUI_NODE_TOKEN_KEY` | 无法加载密钥文件时使用的单个 base64 32 字节密钥 | — |

完整列表见[环境变量参考](docs/content/docs/zh/reference/env-vars.mdx)。

## 界面语言

English · فارسی · العربية · 中文（简体） · 中文（繁體） · Español · Русский · Українська · Türkçe · Tiếng Việt · 日本語 · Bahasa Indonesia · Português (Brasil)

## 参与贡献

欢迎贡献。提交 issue 或 pull request 前请阅读[贡献指南](/CONTRIBUTING.md)。安全问题请参见 [SECURITY.md](/SECURITY.md)。

## 致谢

- [Iran v2ray rules](https://github.com/chocolate4u/Iran-v2ray-rules)（GPL-3.0）：内置伊朗域名的增强路由规则，注重安全与广告拦截。
- [Russia v2ray rules](https://github.com/runetfreedom/russia-v2ray-rules-dat)（GPL-3.0）：基于俄罗斯被封锁域名和地址数据自动更新的路由规则。

## 许可证

FullBoard 基于 [GNU General Public License v3.0](/LICENSE) 授权。
