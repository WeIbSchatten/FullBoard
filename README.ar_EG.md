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

**FullBoard** لوحة تحكم ويب مفتوحة المصدر لإدارة خوادم [Xray-core](https://github.com/XTLS/Xray-core). توفر واجهة واحدة متعددة اللغات لنشر وتهيئة ومراقبة مجموعة واسعة من بروتوكولات البروكسي و VPN، من خادم VPS واحد حتى عمليات النشر متعددة العقد.

> [!IMPORTANT]
> هذا المشروع مخصص للاستخدام الشخصي. لا تستخدمه لأغراض غير قانونية.

## المميزات

- **مداخل متعددة البروتوكولات**: VLESS و VMess و Trojan و Shadowsocks و WireGuard و AmneziaWG و TUIC v5 و Hysteria2 و MTProto و HTTP و SOCKS (Mixed) و Dokodemo-door / Tunnel و TUN.
- **وسائل نقل وأمان حديثة**: TCP (Raw) و mKCP و WebSocket و gRPC و HTTPUpgrade و XHTTP مع TLS و XTLS و REALITY.
- **AmneziaWG مدمج**: WireGuard مقاوم لـ DPI يعمل داخل اللوحة على مكدس شبكة في مساحة المستخدم، دون وحدة نواة أو DKMS أو حزم إضافية.
- **خادم TUIC v5 أصلي**: خادم QUIC داخل العملية مع توجيه Xray واحتساب الحركة لكل عميل (BBR و New Reno).
- **بروكسي MTProto**: أسرار FakeTLS و ad-tag وحصص لكل عميل، تُطبّق مباشرة دون قطع الاتصالات.
- **Fallback**: عدة بروتوكولات على منفذ واحد (مثل VLESS و Trojan على 443).
- **إدارة العملاء**: حصص الحركة، تواريخ الانتهاء، حدود IP مع استثناء العناوين الموثوقة، حدود أجهزة HWID، تجديد مجدول، حالة الاتصال، روابط مشاركة، رموز QR واشتراكات.
- **إحصائيات الحركة** لكل مدخل وعميل ومخرج، مع إمكانية التصفير.
- **تعدد العقد**: إدارة عدة خوادم من لوحة واحدة، بما في ذلك نسخ المداخل إلى عقد أخرى.
- **المخارج والتوجيه**: WARP و NordVPN و PIA وقواعد مخصصة وموازنات حمل مع سلاسل fallback وتسلسل البروكسي. يمكن تصفح فئات geosite/geoip من محرر القواعد.
- **خادم الاشتراكات**: مخرجات raw و JSON و Clash حسب User-Agent العميل، إضافة إلى [قوالب صفحات مخصصة](docs/custom-subscription-templates.md).
- **بوتات Telegram و Discord** للمراقبة والإدارة عن بُعد.
- **REST API** برموز محددة الصلاحيات واختيارية الانتهاء، ومرجع API داخل اللوحة.
- **لوحة قابلة للتثبيت (PWA)** لسطح المكتب والهاتف.
- **التخزين**: SQLite (افتراضي) أو PostgreSQL.
- **13 لغة للواجهة** مع سمات داكنة وفاتحة.
- **تكامل مع Fail2ban** لفرض حدود IP لكل عميل.

## لقطات الشاشة

<details>
<summary>انقر للتوسيع</summary>

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

## البدء السريع

</div>

```bash
bash <(curl -Ls https://raw.githubusercontent.com/WeIbSchatten/FullBoard/main/install.sh)
```

<div dir="rtl">

لتثبيت إصدار محدد، أضف وسمه:

</div>

```bash
bash <(curl -Ls https://raw.githubusercontent.com/WeIbSchatten/FullBoard/main/install.sh) v3.7.0
```

<div dir="rtl">

لتثبيت نسخة **dev** (أحدث إصدار تجريبي من فرع `main`)، مرّر `dev-latest`:

</div>

```bash
bash <(curl -Ls https://raw.githubusercontent.com/WeIbSchatten/FullBoard/main/install.sh) dev-latest
```

<div dir="rtl">

يولّد المثبّت اسم مستخدم وكلمة مرور ومسار وصول عشوائية. بعد التثبيت شغّل `fullboard` لفتح قائمة الإدارة: تشغيل/إيقاف الخدمة، عرض بيانات الدخول أو إعادة تعيينها، إدارة شهادات SSL والمزيد.

يُنشر كل ملف إصدار مع ملف `.sha256`. يتحقق كل من `install.sh` والمحدّث من الأرشيف ويتوقف عند عدم التطابق.

التوثيق الكامل (التثبيت، التهيئة، التشغيل، مرجع API) موجود في مجلد [`docs/`](docs/).

### التثبيت التلقائي

يعمل المثبّت أيضًا **دون تفاعل** (مثلًا من cloud-init). اضبط `XUI_NONINTERACTIVE=1` أو شغّله دون TTY، فيولّد بيانات دخول عشوائية ويكتبها في `/etc/fullboard/install-result.env`. راجع [`deploy/`](deploy/):

- [Cloud-init user-data](deploy/cloud-init/) لأي مزود سحابي
- [ملاحظات Hetzner Cloud](deploy/marketplace/hetzner/)

### الإدارة

| الأمر | الوظيفة |
| --- | --- |
| `fullboard` | قائمة الإدارة التفاعلية |
| `fullboard start` / `stop` / `restart` | التحكم في الخدمة |
| `fullboard status` | حالة الخدمة |
| `fullboard settings` | إعدادات اللوحة الحالية |
| `fullboard log` | أحدث السجلات |
| `fullboard update` | التحديث إلى أحدث إصدار |
| `fullboard uninstall` | إزالة اللوحة |

المسارات: الملف التنفيذي وموارد Xray في `/usr/local/fullboard`، قاعدة البيانات والحالة في `/etc/fullboard`، السجلات في `/var/log/fullboard`، الخدمة `fullboard.service`.

## المنصات المدعومة

**أنظمة التشغيل:** Ubuntu و Debian و Armbian و Fedora و CentOS و RHEL و AlmaLinux و Rocky Linux و Oracle Linux و Amazon Linux و Virtuozzo و Arch و Manjaro و Parch و openSUSE (Tumbleweed / Leap) و Alpine و Windows.

**المعماريات:** `amd64` · `386` · `arm64` (aarch64) · `armv7` · `armv6` · `armv5` · `s390x`.

## قاعدة البيانات

يدعم FullBoard واجهتين خلفيتين تُختاران أثناء التثبيت:

- **SQLite** (افتراضي): ملف واحد في `/etc/fullboard/fullboard.db`. دون إعداد، مناسب للنشر الصغير والمتوسط.
- **PostgreSQL**: موصى به لعدد كبير من العملاء أو عدة عقد. يمكن للمثبّت تثبيته محليًا أو استخدام DSN لخادم موجود.

تُختار الواجهة الخلفية عبر متغيرات البيئة (يكتبها المثبّت في `/etc/default/fullboard`):

</div>

```
XUI_DB_TYPE=postgres
XUI_DB_DSN=postgres://xui:password@127.0.0.1:5432/xui?sslmode=disable
```

<div dir="rtl">

### الترحيل من SQLite إلى PostgreSQL

</div>

```bash
fullboard migrate-db --dsn "postgres://xui:password@127.0.0.1:5432/xui?sslmode=disable"
# then set XUI_DB_TYPE and XUI_DB_DSN in /etc/default/fullboard and restart:
systemctl restart fullboard
```

<div dir="rtl">

يبقى ملف SQLite الأصلي دون تغيير؛ احذفه يدويًا بعد التحقق من الواجهة الجديدة.

## Docker

</div>

```bash
docker compose up -d
```

<div dir="rtl">

الإعداد الافتراضي يستخدم SQLite. لاستخدام خدمة PostgreSQL المرفقة، أزل التعليق عن سطري `XUI_DB_*` في `docker-compose.yml` وشغّل مع الملف الشخصي:

</div>

```bash
docker compose --profile postgres up -d
```

<div dir="rtl">

تتضمن الصورة Fail2ban (مفعّل افتراضيًا) لفرض **حدود IP** لكل عميل. يتم الحظر عبر `iptables` ويتطلب صلاحية `NET_ADMIN`. يمنحها `docker-compose.yml` مسبقًا؛ عند استخدام `docker run` أضفها بنفسك، وإلا سيُسجَّل الحظر دون تطبيقه:

</div>

```bash
docker run -d --cap-add=NET_ADMIN --cap-add=NET_RAW -p 2053:2053 -v $PWD/db/:/etc/fullboard/ ghcr.io/weibschatten/fullboard
```

<div dir="rtl">

## متغيرات البيئة

| المتغير | الوصف | الافتراضي |
| --- | --- | --- |
| `XUI_DB_TYPE` | قاعدة البيانات: `sqlite` أو `postgres` | `sqlite` |
| `XUI_DB_DSN` | سلسلة اتصال PostgreSQL | — |
| `XUI_DB_FOLDER` | مجلد ملف SQLite | `/etc/fullboard` |
| `XUI_DB_MAX_OPEN_CONNS` | أقصى عدد للاتصالات المفتوحة (تجمع PostgreSQL) | — |
| `XUI_DB_MAX_IDLE_CONNS` | أقصى عدد للاتصالات الخاملة (تجمع PostgreSQL) | — |
| `XUI_INIT_WEB_BASE_PATH` | مسار URI الأولي للوحة | `/` |
| `XUI_PORT` | تجاوز منفذ اللوحة | — |
| `XUI_ENABLE_FAIL2BAN` | حدود IP عبر Fail2ban | `true` |
| `XUI_LOG_LEVEL` | مستوى السجل (`debug`، `info`، `warning`، `error`) | `info` |
| `XUI_DEBUG` | وضع التصحيح | `false` |
| `XUI_TUNNEL_HEALTH_MONITOR` | فحص URL وإعادة تشغيل Xray بعد إخفاقات متكررة (يقطع جميع العملاء) | `false` |
| `XUI_TUNNEL_HEALTH_PROXY` | بروكسي الفحص، مثل مدخل محلي (`socks5://127.0.0.1:1080`) | — |
| `XUI_TUNNEL_HEALTH_URL` | عنوان الفحص | `https://www.cloudflare.com/cdn-cgi/trace` |
| `XUI_TUNNEL_HEALTH_INTERVAL` | الفاصل بين الفحوص | `30s` |
| `XUI_TUNNEL_HEALTH_TIMEOUT` | مهلة كل فحص | `10s` |
| `XUI_TUNNEL_HEALTH_FAILURES` | عدد الإخفاقات المتتالية قبل إعادة التشغيل | `3` |
| `XUI_TUNNEL_HEALTH_COOLDOWN` | أدنى مدة بين عمليات إعادة التشغيل | `5m` |
| `NODE_TOKEN_ENCRYPTION` | تشفير رموز العقد: `off` أو `migration` أو `required` | `off` |
| `XUI_NODE_TOKEN_KEY_FILE` | حلقة مفاتيح JSON (صلاحية `0600`) | `/etc/fullboard/node_token_key.json` |
| `XUI_NODE_TOKEN_KEY` | مفتاح base64 واحد بطول 32 بايت عند تعذّر تحميل ملف المفاتيح | — |

القائمة الكاملة في [مرجع متغيرات البيئة](docs/content/docs/en/reference/env-vars.mdx).

## اللغات

English · فارسی · العربية · 中文（简体） · 中文（繁體） · Español · Русский · Українська · Türkçe · Tiếng Việt · 日本語 · Bahasa Indonesia · Português (Brasil)

## المساهمة

المساهمات مرحب بها. اقرأ [دليل المساهمة](/CONTRIBUTING.md) قبل فتح issue أو pull request. للمشكلات الأمنية راجع [SECURITY.md](/SECURITY.md).

## شكر وتقدير

- [Iran v2ray rules](https://github.com/chocolate4u/Iran-v2ray-rules) (GPL-3.0): قواعد توجيه محسّنة مع نطاقات إيرانية مدمجة، تركّز على الأمان وحجب الإعلانات.
- [Russia v2ray rules](https://github.com/runetfreedom/russia-v2ray-rules-dat) (GPL-3.0): قواعد تُحدَّث تلقائيًا بناءً على النطاقات والعناوين المحجوبة في روسيا.

## الترخيص

يُرخَّص FullBoard بموجب [GNU General Public License v3.0](/LICENSE).

</div>
