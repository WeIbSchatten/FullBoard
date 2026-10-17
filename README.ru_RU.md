<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./media/brand/fullboard-logo-dark.svg">
    <img alt="FullBoard" src="./media/brand/fullboard-logo-light.svg" height="56">
  </picture>
</p>

<p align="center">
  <b>Одна спокойная монохромная панель для Xray-core, Telegram WEB Proxy и всех ваших серверов.</b>
</p>

<p align="center">
  <a href="https://github.com/WeIbSchatten/FullBoard/releases"><img src="https://img.shields.io/github/v/release/WeIbSchatten/FullBoard?style=flat-square&color=111111&label=release" alt="Release"></a>
  <a href="https://github.com/WeIbSchatten/FullBoard/actions"><img src="https://img.shields.io/github/actions/workflow/status/WeIbSchatten/FullBoard/release.yml?style=flat-square&color=111111" alt="Build"></a>
  <a href="https://www.gnu.org/licenses/gpl-3.0.en.html"><img src="https://img.shields.io/badge/license-GPL--3.0-111111?style=flat-square" alt="License"></a>
  <a href="https://pkg.go.dev/github.com/WeIbSchatten/FullBoard/v3"><img src="https://img.shields.io/badge/go-reference-111111?style=flat-square" alt="Go Reference"></a>
</p>

<p align="center">
  <a href="./README.md">English</a> · <b>Русский</b>
  &nbsp;|&nbsp;
  <a href="#быстрый-старт">Быстрый старт</a> ·
  <a href="#возможности">Возможности</a> ·
  <a href="./docs/content/docs/ru/index.mdx">Документация</a>
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./media/screenshots/overview-dark.png">
    <img alt="Обзор FullBoard" src="./media/screenshots/overview-light.png" width="900">
  </picture>
</p>

**FullBoard** — self-hosted веб-панель для серверов [Xray-core](https://github.com/XTLS/Xray-core):
спокойный интерфейс, официальный релей **Telegram WEB Proxy** с отдельными секретами для клиентов,
подключение узлов по одноразовому приглашению и управление множеством серверов из одного места.

> [!IMPORTANT]
> Проект предназначен для личного использования. Не используйте его в незаконных целях.

## Быстрый старт

```bash
bash <(curl -Ls https://raw.githubusercontent.com/WeIbSchatten/FullBoard/main/install.sh)
```

Установщик:

- скачает последний релиз и проверит `.sha256`;
- сгенерирует случайные логин, пароль и секретный путь панели;
- поставит systemd-службу с защищённой песочницей;
- настроит Fail2ban для лимитов IP по клиентам.

Дальше откройте выведенный адрес или выполните `fullboard` для меню управления.

<details>
<summary>Другие способы установки</summary>

```bash
# конкретный релиз
bash <(curl -Ls https://raw.githubusercontent.com/WeIbSchatten/FullBoard/main/install.sh) v1.4.6

# сборка dev из main
bash <(curl -Ls https://raw.githubusercontent.com/WeIbSchatten/FullBoard/main/install.sh) dev-latest

# Docker (по умолчанию SQLite; встроенный PostgreSQL — с --profile postgres)
docker compose up -d
```

Установка без вопросов (cloud-init и т. п.): задайте `XUI_NONINTERACTIVE=1` или запускайте без TTY.
Учётные данные будут записаны в `/etc/fullboard/install-result.env`. См. [`deploy/`](deploy/).

</details>

## Возможности

<table>
<tr>
<td width="50%" valign="top">

### Протоколы
VLESS + REALITY / XTLS-Vision, VMess, Trojan, Shadowsocks, WireGuard, **AmneziaWG**
(внутри процесса, без модуля ядра), **TUIC v5**, Hysteria2, MTProto, SOCKS / HTTP, Tunnel и TUN.
Транспорты: Raw, XHTTP, WebSocket, gRPC, HTTPUpgrade, mKCP.

</td>
<td width="50%" valign="top">

### Telegram WEB Proxy
Официальный релей `tproxy-server` ставится из панели и работает за вашим сайтом-заглушкой.
Профили, ссылки и QR-коды, **отдельный секрет каждому клиенту**, MTProxy-бэкенды панель
запускает и закрывает файрволом сама.

</td>
</tr>
<tr>
<td valign="top">

### Клиенты
Квоты трафика, сроки действия, лимиты IP и устройств (HWID), плановое продление, группы,
онлайн-статус, ссылки, QR-коды и подписки raw / Clash / JSON.

</td>
<td valign="top">

### Много серверов — одна панель
Сервер добавляется по **одноразовому приглашению**, без копирования API-токенов.
Синхронизация и клонирование инбаундов, mTLS между главной панелью и узлами, уведомления
о падении узлов в Telegram и Discord.

</td>
</tr>
<tr>
<td valign="top">

### Маршрутизация
Исходящие WARP, NordVPN и PIA, балансировщики с цепочками fallback, цепочки прокси и редактор
правил с категориями geosite / geoip.

</td>
<td valign="top">

### Эксплуатация
REST API с ограниченными токенами и встроенным справочником, PWA, резервные копии, боты
Telegram и Discord, SQLite или PostgreSQL, 13 языков, светлая / тёмная / AMOLED темы.

</td>
</tr>
</table>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./media/screenshots/clients-dark.png">
    <img alt="Страница клиентов" src="./media/screenshots/clients-light.png" width="900">
  </picture>
</p>

## Как всё связано

```mermaid
flowchart LR
  Admin["Браузер админа"] -->|HTTPS| Panel["Панель FullBoard"]
  Panel -->|конфиг + gRPC API| Xray["Xray-core"]
  Panel -->|systemd| Relay["tproxy-server + MTProxy"]
  Panel -->|mTLS API| Nodes["Другие узлы FullBoard"]
  Users["Клиентские приложения"] -->|VLESS / Trojan / ...| Xray
  TG["Приложения Telegram"] -->|HTTPS / WebSocket| Relay
```

## Скорость

Самый быстрый транспорт — **VLESS + REALITY + Vision** при прямом подключении. Будет ли BBR быстрее
стандартного `cubic`, зависит от маршрута, поэтому FullBoard сам TCP-настройки не меняет: сравните оба
варианта по шагам из раздела [Производительность](docs/content/docs/ru/operations/performance.mdx)
и оставьте лучший (BBR включается одним пунктом в меню `fullboard`).

## Управление

| Команда | Назначение |
| --- | --- |
| `fullboard` | Интерактивное меню |
| `fullboard start` / `stop` / `restart` / `status` | Управление службой |
| `fullboard settings` | Адрес и настройки панели |
| `fullboard log` | Последние логи |
| `fullboard update` | Обновление до последнего релиза |
| `fullboard uninstall` | Удаление панели |

Файлы: бинарник и Xray — `/usr/local/fullboard`, база — `/etc/fullboard`, логи —
`/var/log/fullboard`, служба — `fullboard.service`.

<details>
<summary>База данных: SQLite или PostgreSQL</summary>

SQLite (`/etc/fullboard/fullboard.db`) используется по умолчанию и не требует настройки.
PostgreSQL лучше подходит для большого числа клиентов или узлов. Установщик может поставить его
локально или подключиться к существующему по DSN:

```
XUI_DB_TYPE=postgres
XUI_DB_DSN=postgres://xui:password@127.0.0.1:5432/xui?sslmode=disable
```

Чтобы перенести данные, выполните `fullboard migrate-db --dsn "<dsn>"`. Затем пропишите обе
переменные в `/etc/default/fullboard` и выполните `systemctl restart fullboard`.

</details>

<details>
<summary>Переменные окружения</summary>

| Переменная | Описание | По умолчанию |
| --- | --- | --- |
| `XUI_DB_TYPE` | `sqlite` или `postgres` | `sqlite` |
| `XUI_DB_DSN` | Строка подключения PostgreSQL | — |
| `XUI_DB_FOLDER` | Каталог файла SQLite | `/etc/fullboard` |
| `XUI_INIT_WEB_BASE_PATH` | Начальный путь панели | `/` |
| `XUI_PORT` | Переопределение порта панели | — |
| `XUI_ENABLE_FAIL2BAN` | Лимиты IP через Fail2ban | `true` |
| `XUI_NET_TUNING` | `true` — записать BBR + fq при установке и обновлении | `false` |
| `XUI_LOG_LEVEL` | `debug`, `info`, `warning`, `error` | `info` |
| `XUI_TUNNEL_HEALTH_MONITOR` | Проверка URL и перезапуск Xray после серии сбоев | `false` |
| `NODE_TOKEN_ENCRYPTION` | Шифрование токенов узлов: `off`, `migration`, `required` | `off` |

Полный список — в [справочнике переменных окружения](docs/content/docs/ru/reference/env-vars.mdx).

</details>

**Платформы:** Ubuntu, Debian, Armbian, Fedora, CentOS / RHEL / Alma / Rocky / Oracle, Amazon Linux,
Arch, Manjaro, openSUSE, Alpine, Windows. Архитектуры: `amd64`, `386`, `arm64`, `armv7`, `armv6`,
`armv5`, `s390x`.

## Документация

| | |
| --- | --- |
| [Установка](docs/content/docs/ru/guide/installation.mdx) | Скрипт, Docker, вручную |
| [Первый вход](docs/content/docs/ru/guide/first-login.mdx) | Открыть и защитить панель |
| [REALITY](docs/content/docs/ru/config/reality.mdx) | VLESS + REALITY + Vision по шагам |
| [Telegram WEB Proxy](docs/content/docs/ru/operations/tg-web-proxy.mdx) | Релей, профили, секреты клиентов |
| [Несколько узлов](docs/content/docs/ru/operations/multi-node.mdx) | Приглашения, синхронизация, mTLS |
| [Производительность](docs/content/docs/ru/operations/performance.mdx) | BBR, транспорты, чек-лист скорости |
| [Решение проблем](docs/content/docs/ru/help/troubleshooting.mdx) | Частые проблемы и решения |

## Участие в разработке

Перед pull request прочитайте [руководство](CONTRIBUTING.md). Об уязвимостях сообщайте по
инструкции в [SECURITY.md](SECURITY.md).

## Благодарности

- [Xray-core](https://github.com/XTLS/Xray-core) и [tproxy-server](https://github.com/telegramdesktop/tproxy-server).
- [Iran v2ray rules](https://github.com/chocolate4u/Iran-v2ray-rules) и [Russia v2ray rules](https://github.com/runetfreedom/russia-v2ray-rules-dat) (GPL-3.0).

## Лицензия

[GPL-3.0](LICENSE).
