[English](/README.md) | [Русский](/README.ru_RU.md)

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

**FullBoard** — веб-панель с открытым исходным кодом для управления серверами [Xray-core](https://github.com/XTLS/Xray-core). Единый многоязычный интерфейс для развёртывания, настройки и мониторинга множества прокси- и VPN-протоколов — от одного VPS до многоузловых инсталляций.

> [!IMPORTANT]
> Проект предназначен для личного использования. Не используйте его в незаконных целях.

## Возможности

- **Многопротокольные входящие подключения**: VLESS, VMess, Trojan, Shadowsocks, WireGuard, AmneziaWG, TUIC v5, Hysteria2, MTProto, HTTP, SOCKS (Mixed), Dokodemo-door / Tunnel и TUN.
- **Современные транспорты и защита**: TCP (Raw), mKCP, WebSocket, gRPC, HTTPUpgrade и XHTTP с TLS, XTLS и REALITY.
- **Встроенный AmneziaWG**: устойчивый к DPI WireGuard работает внутри панели на userspace-стеке — без модуля ядра, DKMS и дополнительных пакетов.
- **Собственный сервер TUIC v5**: QUIC-сервер внутри процесса с маршрутизацией Xray и учётом трафика по клиентам (BBR и New Reno).
- **MTProto-прокси**: FakeTLS-секреты, ad-tag и квоты для каждого клиента, применяются на лету без разрыва соединений.
- **Fallback**: несколько протоколов на одном порту (например, VLESS и Trojan на 443).
- **Управление клиентами**: квоты трафика, сроки действия, лимиты IP с доверенными адресами, лимиты устройств по HWID, плановое продление, онлайн-статус, ссылки, QR-коды и подписки.
- **Статистика трафика** по входящим, клиентам и исходящим подключениям со сбросом.
- **Несколько узлов**: управление множеством серверов из одной панели, включая клонирование входящих на другие узлы.
- **Исходящие и маршрутизация**: WARP, NordVPN, PIA, свои правила, балансировщики с цепочками fallback и цепочки прокси. Категории geosite/geoip доступны прямо из редактора правил.
- **Сервер подписок**: raw, JSON и Clash с выбором по User-Agent клиента, а также [свои шаблоны страницы](docs/custom-subscription-templates.md).
- **Боты Telegram и Discord** для удалённого мониторинга и управления.
- **REST API** с ограниченными по правам и сроку токенами и встроенным справочником API.
- **Устанавливаемая панель (PWA)** для рабочего стола и телефона.
- **Хранилище**: SQLite (по умолчанию) или PostgreSQL.
- **13 языков интерфейса**, тёмная и светлая темы.
- **Интеграция с Fail2ban** для ограничения IP по клиентам.

## Быстрый старт

```bash
bash <(curl -Ls https://raw.githubusercontent.com/WeIbSchatten/FullBoard/main/install.sh)
```

Установка конкретного релиза — добавьте его тег:

```bash
bash <(curl -Ls https://raw.githubusercontent.com/WeIbSchatten/FullBoard/main/install.sh) v3.7.0
```

Установка сборки **dev** (последний pre-release из `main`) — передайте `dev-latest`:

```bash
bash <(curl -Ls https://raw.githubusercontent.com/WeIbSchatten/FullBoard/main/install.sh) dev-latest
```

Установщик генерирует случайные логин, пароль и путь доступа. После установки выполните `fullboard`, чтобы открыть меню управления: запуск/остановка службы, просмотр и сброс учётных данных, SSL-сертификаты и многое другое.

Каждый файл релиза сопровождается `.sha256`. И `install.sh`, и механизм обновления проверяют архив и прерываются при несовпадении.

Полная документация (установка, настройка, эксплуатация, справочник API) находится в папке [`docs/`](docs/).

### Автоматическая установка

Установщик умеет работать **без вопросов** (например, из cloud-init). Задайте `XUI_NONINTERACTIVE=1` или запустите без TTY — он сгенерирует случайные учётные данные и запишет их в `/etc/fullboard/install-result.env`. См. [`deploy/`](deploy/):

- [Cloud-init user-data](deploy/cloud-init/) для любого облака
- [Заметки по Hetzner Cloud](deploy/marketplace/hetzner/)

### Управление

| Команда | Назначение |
| --- | --- |
| `fullboard` | Интерактивное меню |
| `fullboard start` / `stop` / `restart` | Управление службой |
| `fullboard status` | Статус службы |
| `fullboard settings` | Текущие настройки панели |
| `fullboard log` | Последние логи |
| `fullboard update` | Обновление до последнего релиза |
| `fullboard uninstall` | Удаление панели |

Пути: бинарник и ресурсы Xray — `/usr/local/fullboard`, база и состояние — `/etc/fullboard`, логи — `/var/log/fullboard`, служба — `fullboard.service`.

## Поддерживаемые платформы

**ОС:** Ubuntu, Debian, Armbian, Fedora, CentOS, RHEL, AlmaLinux, Rocky Linux, Oracle Linux, Amazon Linux, Virtuozzo, Arch, Manjaro, Parch, openSUSE (Tumbleweed / Leap), Alpine и Windows.

**Архитектуры:** `amd64` · `386` · `arm64` (aarch64) · `armv7` · `armv6` · `armv5` · `s390x`.

## База данных

FullBoard поддерживает два бэкенда, выбор делается при установке:

- **SQLite** (по умолчанию): один файл `/etc/fullboard/fullboard.db`. Без настройки, подходит для небольших и средних инсталляций.
- **PostgreSQL**: рекомендуется для большого числа клиентов и нескольких узлов. Установщик может поставить PostgreSQL локально или использовать DSN существующего сервера.

Бэкенд выбирается переменными окружения (установщик записывает их в `/etc/default/fullboard`):

```
XUI_DB_TYPE=postgres
XUI_DB_DSN=postgres://xui:password@127.0.0.1:5432/xui?sslmode=disable
```

### Перенос SQLite в PostgreSQL

```bash
fullboard migrate-db --dsn "postgres://xui:password@127.0.0.1:5432/xui?sslmode=disable"
# затем задайте XUI_DB_TYPE и XUI_DB_DSN в /etc/default/fullboard и перезапустите:
systemctl restart fullboard
```

Исходный файл SQLite не изменяется; удалите его вручную после проверки нового бэкенда.

## Docker

```bash
docker compose up -d
```

По умолчанию используется SQLite. Чтобы подключить встроенный сервис PostgreSQL, раскомментируйте две строки `XUI_DB_*` в `docker-compose.yml` и запустите с профилем:

```bash
docker compose --profile postgres up -d
```

Образ включает Fail2ban (включён по умолчанию) для **лимитов IP** по клиентам. Блокировка выполняется через `iptables`, что требует capability `NET_ADMIN`. В `docker-compose.yml` она уже выдана; при запуске через `docker run` добавьте её сами, иначе блокировки только логируются:

```bash
docker run -d --cap-add=NET_ADMIN --cap-add=NET_RAW -p 2053:2053 -v $PWD/db/:/etc/fullboard/ ghcr.io/weibschatten/fullboard
```

## Переменные окружения

| Переменная | Описание | По умолчанию |
| --- | --- | --- |
| `XUI_DB_TYPE` | Бэкенд БД: `sqlite` или `postgres` | `sqlite` |
| `XUI_DB_DSN` | Строка подключения PostgreSQL | — |
| `XUI_DB_FOLDER` | Каталог файла SQLite | `/etc/fullboard` |
| `XUI_DB_MAX_OPEN_CONNS` | Макс. открытых соединений (пул PostgreSQL) | — |
| `XUI_DB_MAX_IDLE_CONNS` | Макс. простаивающих соединений (пул PostgreSQL) | — |
| `XUI_INIT_WEB_BASE_PATH` | Начальный URI-путь панели | `/` |
| `XUI_PORT` | Переопределение порта панели | — |
| `XUI_ENABLE_FAIL2BAN` | Ограничение IP через Fail2ban | `true` |
| `XUI_LOG_LEVEL` | Уровень логов (`debug`, `info`, `warning`, `error`) | `info` |
| `XUI_DEBUG` | Режим отладки | `false` |
| `XUI_TUNNEL_HEALTH_MONITOR` | Проверка URL и перезапуск Xray после серии сбоев (перезапуск отключает всех клиентов) | `false` |
| `XUI_TUNNEL_HEALTH_PROXY` | Прокси для проверки, например локальный inbound (`socks5://127.0.0.1:1080`) | — |
| `XUI_TUNNEL_HEALTH_URL` | Проверяемый URL | `https://www.cloudflare.com/cdn-cgi/trace` |
| `XUI_TUNNEL_HEALTH_INTERVAL` | Интервал проверок | `30s` |
| `XUI_TUNNEL_HEALTH_TIMEOUT` | Таймаут проверки | `10s` |
| `XUI_TUNNEL_HEALTH_FAILURES` | Сбоев подряд до перезапуска | `3` |
| `XUI_TUNNEL_HEALTH_COOLDOWN` | Минимальная пауза между перезапусками | `5m` |
| `NODE_TOKEN_ENCRYPTION` | Шифрование токенов узлов: `off`, `migration` или `required` | `off` |
| `XUI_NODE_TOKEN_KEY_FILE` | JSON-связка ключей (режим `0600`) | `/etc/fullboard/node_token_key.json` |
| `XUI_NODE_TOKEN_KEY` | Один base64-ключ 32 байта, если файл ключей недоступен | — |

Полный список — в [справочнике переменных окружения](docs/content/docs/ru/reference/env-vars.mdx).

## Языки интерфейса

English · فارسی · العربية · 中文（简体） · 中文（繁體） · Español · Русский · Українська · Türkçe · Tiếng Việt · 日本語 · Bahasa Indonesia · Português (Brasil)

## Участие в разработке

Мы рады вкладу. Перед созданием issue или pull request прочитайте [руководство](/CONTRIBUTING.md). Об уязвимостях — см. [SECURITY.md](/SECURITY.md).

## Благодарности

- [Iran v2ray rules](https://github.com/chocolate4u/Iran-v2ray-rules) (GPL-3.0): расширенные правила маршрутизации с иранскими доменами, акцент на безопасность и блокировку рекламы.
- [Russia v2ray rules](https://github.com/runetfreedom/russia-v2ray-rules-dat) (GPL-3.0): автоматически обновляемые правила на основе данных о заблокированных в России доменах и адресах.

## Лицензия

FullBoard распространяется по лицензии [GNU General Public License v3.0](/LICENSE).
