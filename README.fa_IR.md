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

<div dir="rtl">

**FullBoard** یک پنل وب متن‌باز برای مدیریت سرورهای [Xray-core](https://github.com/XTLS/Xray-core) است. این پنل یک رابط چندزبانه برای راه‌اندازی، پیکربندی و پایش طیف گسترده‌ای از پروتکل‌های پراکسی و VPN فراهم می‌کند؛ از یک VPS تا استقرارهای چندنودی.

> [!IMPORTANT]
> این پروژه برای استفاده شخصی است. از آن برای مقاصد غیرقانونی استفاده نکنید.

## ویژگی‌ها

- **ورودی‌های چندپروتکلی**: VLESS، VMess، Trojan، Shadowsocks، WireGuard، AmneziaWG، TUIC v5، Hysteria2، MTProto، HTTP، SOCKS (Mixed)، Dokodemo-door / Tunnel و TUN.
- **انتقال و امنیت مدرن**: TCP (Raw)، mKCP، WebSocket، gRPC، HTTPUpgrade و XHTTP همراه با TLS، XTLS و REALITY.
- **AmneziaWG داخلی**: WireGuard مقاوم در برابر DPI درون پنل روی پشته شبکه فضای کاربر اجرا می‌شود؛ بدون ماژول کرنل، DKMS یا بسته اضافی.
- **سرور بومی TUIC v5**: سرور QUIC درون‌فرایندی با مسیریابی Xray و حسابداری ترافیک برای هر کاربر (BBR و New Reno).
- **پراکسی MTProto**: کلید FakeTLS، ad-tag و سهمیه جداگانه برای هر کاربر که بدون قطع اتصال‌ها اعمال می‌شود.
- **Fallback**: چند پروتکل روی یک پورت (مثلاً VLESS و Trojan روی 443).
- **مدیریت کاربران**: سهمیه ترافیک، تاریخ انقضا، محدودیت IP با استثنای آدرس‌های مورد اعتماد، محدودیت دستگاه HWID، تمدید زمان‌بندی‌شده، وضعیت آنلاین، لینک اشتراک‌گذاری، کد QR و اشتراک.
- **آمار ترافیک** برای هر ورودی، کاربر و خروجی، با امکان بازنشانی.
- **چندنودی**: مدیریت چند سرور از یک پنل، از جمله کپی ورودی‌ها روی نودهای دیگر.
- **خروجی و مسیریابی**: WARP، NordVPN، PIA، قوانین سفارشی، متعادل‌کننده بار با زنجیره fallback و زنجیره پراکسی. دسته‌های geosite/geoip از ویرایشگر قوانین قابل مشاهده‌اند.
- **سرور اشتراک**: خروجی raw، JSON و Clash بر اساس User-Agent کلاینت، به‌همراه [قالب‌های صفحه سفارشی](docs/custom-subscription-templates.md).
- **ربات‌های Telegram و Discord** برای پایش و مدیریت از راه دور.
- **REST API** با توکن‌های دارای دامنه دسترسی و انقضای اختیاری، و مرجع API داخل پنل.
- **پنل قابل نصب (PWA)** برای دسکتاپ و موبایل.
- **ذخیره‌سازی**: SQLite (پیش‌فرض) یا PostgreSQL.
- **۱۳ زبان رابط کاربری** با تم تیره و روشن.
- **یکپارچگی با Fail2ban** برای اعمال محدودیت IP هر کاربر.

## تصاویر

<details>
<summary>برای نمایش کلیک کنید</summary>

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

## شروع سریع

</div>

```bash
bash <(curl -Ls https://raw.githubusercontent.com/WeIbSchatten/FullBoard/main/install.sh)
```

<div dir="rtl">

برای نصب یک نسخه مشخص، برچسب آن را اضافه کنید:

</div>

```bash
bash <(curl -Ls https://raw.githubusercontent.com/WeIbSchatten/FullBoard/main/install.sh) v3.7.0
```

<div dir="rtl">

برای نصب نسخه **dev** (آخرین پیش‌انتشار شاخه `main`)، `dev-latest` را بدهید:

</div>

```bash
bash <(curl -Ls https://raw.githubusercontent.com/WeIbSchatten/FullBoard/main/install.sh) dev-latest
```

<div dir="rtl">

نصب‌کننده نام کاربری، رمز عبور و مسیر دسترسی تصادفی می‌سازد. پس از نصب، دستور `fullboard` را اجرا کنید تا منوی مدیریت باز شود: شروع/توقف سرویس، مشاهده یا بازنشانی اطلاعات ورود، مدیریت گواهی SSL و موارد دیگر.

هر فایل انتشار همراه با یک فایل `.sha256` منتشر می‌شود. `install.sh` و به‌روزرسان، آرشیو را بررسی می‌کنند و در صورت عدم تطابق متوقف می‌شوند.

مستندات کامل (نصب، پیکربندی، عملیات و مرجع API) در پوشه [`docs/`](docs/) قرار دارد.

### نصب خودکار

نصب‌کننده به‌صورت **غیرتعاملی** هم اجرا می‌شود (مثلاً از cloud-init). مقدار `XUI_NONINTERACTIVE=1` را تنظیم کنید یا بدون TTY اجرا کنید؛ اطلاعات ورود تصادفی ساخته و در `/etc/fullboard/install-result.env` نوشته می‌شود. پوشه [`deploy/`](deploy/) را ببینید:

- [Cloud-init user-data](deploy/cloud-init/) برای هر ارائه‌دهنده ابری
- [نکات Hetzner Cloud](deploy/marketplace/hetzner/)

### مدیریت

| دستور | کاربرد |
| --- | --- |
| `fullboard` | منوی مدیریت تعاملی |
| `fullboard start` / `stop` / `restart` | کنترل سرویس |
| `fullboard status` | وضعیت سرویس |
| `fullboard settings` | تنظیمات فعلی پنل |
| `fullboard log` | لاگ‌های اخیر |
| `fullboard update` | به‌روزرسانی به آخرین نسخه |
| `fullboard uninstall` | حذف پنل |

مسیرها: فایل اجرایی و منابع Xray در `/usr/local/fullboard`، پایگاه داده و وضعیت در `/etc/fullboard`، لاگ‌ها در `/var/log/fullboard`، سرویس `fullboard.service`.

## پلتفرم‌های پشتیبانی‌شده

**سیستم‌عامل‌ها:** Ubuntu، Debian، Armbian، Fedora، CentOS، RHEL، AlmaLinux، Rocky Linux، Oracle Linux، Amazon Linux، Virtuozzo، Arch، Manjaro، Parch، openSUSE (Tumbleweed / Leap)، Alpine و Windows.

**معماری‌ها:** `amd64` · `386` · `arm64` (aarch64) · `armv7` · `armv6` · `armv5` · `s390x`.

## پایگاه داده

FullBoard از دو پشتیبان پشتیبانی می‌کند که هنگام نصب انتخاب می‌شوند:

- **SQLite** (پیش‌فرض): یک فایل در `/etc/fullboard/fullboard.db`. بدون نیاز به تنظیم، مناسب استقرارهای کوچک و متوسط.
- **PostgreSQL**: برای تعداد زیاد کاربر یا چند نود توصیه می‌شود. نصب‌کننده می‌تواند PostgreSQL را محلی نصب کند یا از DSN یک سرور موجود استفاده کند.

پشتیبان با متغیرهای محیطی انتخاب می‌شود (نصب‌کننده آن‌ها را در `/etc/default/fullboard` می‌نویسد):

</div>

```
XUI_DB_TYPE=postgres
XUI_DB_DSN=postgres://xui:password@127.0.0.1:5432/xui?sslmode=disable
```

<div dir="rtl">

### انتقال از SQLite به PostgreSQL

</div>

```bash
fullboard migrate-db --dsn "postgres://xui:password@127.0.0.1:5432/xui?sslmode=disable"
# then set XUI_DB_TYPE and XUI_DB_DSN in /etc/default/fullboard and restart:
systemctl restart fullboard
```

<div dir="rtl">

فایل SQLite مبدأ دست‌نخورده باقی می‌ماند؛ پس از اطمینان از پشتیبان جدید، آن را دستی حذف کنید.

## Docker

</div>

```bash
docker compose up -d
```

<div dir="rtl">

حالت پیش‌فرض از SQLite استفاده می‌کند. برای سرویس PostgreSQL همراه، دو خط `XUI_DB_*` را در `docker-compose.yml` از حالت توضیح خارج کنید و با profile اجرا کنید:

</div>

```bash
docker compose --profile postgres up -d
```

<div dir="rtl">

ایمیج شامل Fail2ban (به‌صورت پیش‌فرض فعال) برای **محدودیت IP** کاربران است. مسدودسازی با `iptables` انجام می‌شود و به قابلیت `NET_ADMIN` نیاز دارد. `docker-compose.yml` آن را فراهم می‌کند؛ اگر از `docker run` استفاده می‌کنید خودتان اضافه کنید، وگرنه مسدودسازی فقط ثبت می‌شود:

</div>

```bash
docker run -d --cap-add=NET_ADMIN --cap-add=NET_RAW -p 2053:2053 -v $PWD/db/:/etc/fullboard/ ghcr.io/weibschatten/fullboard
```

<div dir="rtl">

## متغیرهای محیطی

| متغیر | توضیح | پیش‌فرض |
| --- | --- | --- |
| `XUI_DB_TYPE` | پشتیبان پایگاه داده: `sqlite` یا `postgres` | `sqlite` |
| `XUI_DB_DSN` | رشته اتصال PostgreSQL | — |
| `XUI_DB_FOLDER` | پوشه فایل SQLite | `/etc/fullboard` |
| `XUI_DB_MAX_OPEN_CONNS` | حداکثر اتصال باز (استخر PostgreSQL) | — |
| `XUI_DB_MAX_IDLE_CONNS` | حداکثر اتصال بیکار (استخر PostgreSQL) | — |
| `XUI_INIT_WEB_BASE_PATH` | مسیر URI اولیه پنل | `/` |
| `XUI_PORT` | تغییر پورت پنل | — |
| `XUI_ENABLE_FAIL2BAN` | محدودیت IP با Fail2ban | `true` |
| `XUI_LOG_LEVEL` | سطح لاگ (`debug`، `info`، `warning`، `error`) | `info` |
| `XUI_DEBUG` | حالت اشکال‌زدایی | `false` |
| `XUI_TUNNEL_HEALTH_MONITOR` | بررسی یک URL و راه‌اندازی مجدد Xray پس از خطاهای پیاپی (همه کاربران قطع می‌شوند) | `false` |
| `XUI_TUNNEL_HEALTH_PROXY` | پراکسی بررسی، مثلاً یک ورودی محلی (`socks5://127.0.0.1:1080`) | — |
| `XUI_TUNNEL_HEALTH_URL` | URL مورد بررسی | `https://www.cloudflare.com/cdn-cgi/trace` |
| `XUI_TUNNEL_HEALTH_INTERVAL` | فاصله بین بررسی‌ها | `30s` |
| `XUI_TUNNEL_HEALTH_TIMEOUT` | مهلت هر بررسی | `10s` |
| `XUI_TUNNEL_HEALTH_FAILURES` | تعداد خطای پیاپی پیش از راه‌اندازی مجدد | `3` |
| `XUI_TUNNEL_HEALTH_COOLDOWN` | حداقل فاصله بین راه‌اندازی‌های مجدد | `5m` |
| `NODE_TOKEN_ENCRYPTION` | رمزنگاری توکن نودها: `off`، `migration` یا `required` | `off` |
| `XUI_NODE_TOKEN_KEY_FILE` | دسته‌کلید JSON (مجوز `0600`) | `/etc/fullboard/node_token_key.json` |
| `XUI_NODE_TOKEN_KEY` | یک کلید base64 سی‌ودو بایتی، در صورت در دسترس نبودن فایل کلید | — |

فهرست کامل در [مرجع متغیرهای محیطی](docs/content/docs/fa/reference/env-vars.mdx) است.

## زبان‌ها

English · فارسی · العربية · 中文（简体） · 中文（繁體） · Español · Русский · Українська · Türkçe · Tiếng Việt · 日本語 · Bahasa Indonesia · Português (Brasil)

## مشارکت

از مشارکت استقبال می‌شود. پیش از ثبت issue یا pull request، [راهنمای مشارکت](/CONTRIBUTING.md) را بخوانید. برای مسائل امنیتی [SECURITY.md](/SECURITY.md) را ببینید.

## قدردانی

- [Iran v2ray rules](https://github.com/chocolate4u/Iran-v2ray-rules) (GPL-3.0): قوانین مسیریابی پیشرفته با دامنه‌های ایرانی، با تمرکز بر امنیت و مسدودسازی تبلیغات.
- [Russia v2ray rules](https://github.com/runetfreedom/russia-v2ray-rules-dat) (GPL-3.0): قوانین به‌روزشونده خودکار بر اساس دامنه‌ها و آدرس‌های مسدودشده در روسیه.

## مجوز

FullBoard تحت مجوز [GNU General Public License v3.0](/LICENSE) منتشر شده است.

</div>
