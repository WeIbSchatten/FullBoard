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

**FullBoard**, [Xray-core](https://github.com/XTLS/Xray-core) sunucularını yönetmek için açık kaynaklı bir web panelidir. Tek bir VPS'ten çok düğümlü kurulumlara kadar birçok proxy ve VPN protokolünü kurmak, yapılandırmak ve izlemek için çok dilli tek bir arayüz sunar.

> [!IMPORTANT]
> Bu proje kişisel kullanım içindir. Yasa dışı amaçlarla kullanmayın.

## Özellikler

- **Çok protokollü inbound'lar**: VLESS, VMess, Trojan, Shadowsocks, WireGuard, AmneziaWG, TUIC v5, Hysteria2, MTProto, HTTP, SOCKS (Mixed), Dokodemo-door / Tunnel ve TUN.
- **Modern taşıma ve güvenlik**: TCP (Raw), mKCP, WebSocket, gRPC, HTTPUpgrade ve XHTTP; TLS, XTLS ve REALITY ile.
- **Yerleşik AmneziaWG**: DPI'ya dayanıklı WireGuard, panel içinde kullanıcı alanı ağ yığınında çalışır; çekirdek modülü, DKMS veya ek paket gerekmez.
- **Yerel TUIC v5 sunucusu**: Xray yönlendirmesi ve istemci bazlı trafik sayımı olan süreç içi QUIC sunucusu (BBR ve New Reno).
- **MTProto proxy'leri**: istemci başına FakeTLS gizli anahtarları, ad-tag'ler ve kotalar; bağlantılar kopmadan canlı uygulanır.
- **Fallback**: tek portta birden çok protokol (ör. 443'te VLESS ve Trojan).
- **İstemci yönetimi**: trafik kotaları, son kullanma tarihleri, güvenilir adres istisnalı IP limitleri, HWID cihaz limitleri, zamanlanmış yenileme, çevrimiçi durum, paylaşım bağlantıları, QR kodlar ve abonelikler.
- **Trafik istatistikleri**: inbound, istemci ve outbound bazında, sıfırlama ile.
- **Çoklu düğüm**: birçok sunucuyu tek panelden yönetin, inbound'ları diğer düğümlere kopyalayın.
- **Outbound ve yönlendirme**: WARP, NordVPN, PIA, özel kurallar, fallback zincirli yük dengeleyiciler ve proxy zincirleme. geosite/geoip kategorileri kural düzenleyiciden görüntülenebilir.
- **Abonelik sunucusu**: istemcinin User-Agent'ına göre raw, JSON ve Clash çıktısı, ayrıca [özel sayfa şablonları](docs/custom-subscription-templates.md).
- **Telegram ve Discord botları** ile uzaktan izleme ve yönetim.
- **REST API**: kapsamlı, isteğe bağlı süreli token'lar ve panel içi API referansı.
- **Kurulabilir panel (PWA)** masaüstü ve mobil için.
- **Depolama**: SQLite (varsayılan) veya PostgreSQL.
- **13 arayüz dili**, koyu ve açık tema.
- **Fail2ban entegrasyonu** ile istemci bazlı IP limitleri.

## Ekran görüntüleri

<details>
<summary>Genişletmek için tıklayın</summary>

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

## Hızlı başlangıç

```bash
bash <(curl -Ls https://raw.githubusercontent.com/WeIbSchatten/FullBoard/main/install.sh)
```

Belirli bir sürümü kurmak için etiketini ekleyin:

```bash
bash <(curl -Ls https://raw.githubusercontent.com/WeIbSchatten/FullBoard/main/install.sh) v3.7.0
```

**dev** derlemesi (`main` dalındaki en son ön sürüm) için `dev-latest` verin:

```bash
bash <(curl -Ls https://raw.githubusercontent.com/WeIbSchatten/FullBoard/main/install.sh) dev-latest
```

Kurulum rastgele kullanıcı adı, parola ve erişim yolu üretir. Ardından yönetim menüsünü açmak için `fullboard` çalıştırın: servisi başlatma/durdurma, kimlik bilgilerini görme veya sıfırlama, SSL sertifikaları ve dahası.

Her sürüm dosyası bir `.sha256` ile yayınlanır. `install.sh` ve güncelleyici arşivi doğrular, uyuşmazlıkta durur.

Tam dokümantasyon (kurulum, yapılandırma, işletim, API referansı) [`docs/`](docs/) klasöründedir.

### Gözetimsiz kurulum

Kurulum **etkileşimsiz** de çalışır (ör. cloud-init). `XUI_NONINTERACTIVE=1` ayarlayın veya TTY olmadan çalıştırın; rastgele kimlik bilgileri üretip `/etc/fullboard/install-result.env` dosyasına yazar. Bkz. [`deploy/`](deploy/):

- Her bulut için [Cloud-init user-data](deploy/cloud-init/)
- [Hetzner Cloud notları](deploy/marketplace/hetzner/)

### Yönetim

| Komut | İşlev |
| --- | --- |
| `fullboard` | Etkileşimli menü |
| `fullboard start` / `stop` / `restart` | Servisi yönet |
| `fullboard status` | Servis durumu |
| `fullboard settings` | Mevcut panel ayarları |
| `fullboard log` | Son günlükler |
| `fullboard update` | En son sürüme güncelle |
| `fullboard uninstall` | Paneli kaldır |

Yollar: ikili dosya ve Xray kaynakları `/usr/local/fullboard`, veritabanı ve durum `/etc/fullboard`, günlükler `/var/log/fullboard`, servis `fullboard.service`.

## Desteklenen platformlar

**İşletim sistemleri:** Ubuntu, Debian, Armbian, Fedora, CentOS, RHEL, AlmaLinux, Rocky Linux, Oracle Linux, Amazon Linux, Virtuozzo, Arch, Manjaro, Parch, openSUSE (Tumbleweed / Leap), Alpine ve Windows.

**Mimariler:** `amd64` · `386` · `arm64` (aarch64) · `armv7` · `armv6` · `armv5` · `s390x`.

## Veritabanı

FullBoard kurulum sırasında seçilen iki arka ucu destekler:

- **SQLite** (varsayılan): `/etc/fullboard/fullboard.db` tek dosya. Kurulum gerektirmez, küçük ve orta ölçek için idealdir.
- **PostgreSQL**: çok sayıda istemci veya çoklu düğüm için önerilir. Kurulum PostgreSQL'i yerel kurabilir veya mevcut bir sunucunun DSN'ini kullanabilir.

Arka uç ortam değişkenleriyle seçilir (kurulum bunları `/etc/default/fullboard` dosyasına yazar):

```
XUI_DB_TYPE=postgres
XUI_DB_DSN=postgres://xui:password@127.0.0.1:5432/xui?sslmode=disable
```

### SQLite'tan PostgreSQL'e geçiş

```bash
fullboard migrate-db --dsn "postgres://xui:password@127.0.0.1:5432/xui?sslmode=disable"
# ardından /etc/default/fullboard içinde XUI_DB_TYPE ve XUI_DB_DSN ayarlayıp yeniden başlatın:
systemctl restart fullboard
```

Kaynak SQLite dosyasına dokunulmaz; yeni arka ucu doğruladıktan sonra elle silin.

## Docker

```bash
docker compose up -d
```

Varsayılan kurulum SQLite kullanır. Dahili PostgreSQL servisi için `docker-compose.yml` içindeki iki `XUI_DB_*` satırının yorumunu kaldırıp profil ile başlatın:

```bash
docker compose --profile postgres up -d
```

İmaj, istemci bazlı **IP limitleri** için Fail2ban içerir (varsayılan açık). Engelleme `iptables` ile yapılır ve `NET_ADMIN` yetkisi gerekir. `docker-compose.yml` bunu zaten verir; `docker run` kullanıyorsanız kendiniz ekleyin, yoksa engellemeler yalnızca günlüğe yazılır:

```bash
docker run -d --cap-add=NET_ADMIN --cap-add=NET_RAW -p 2053:2053 -v $PWD/db/:/etc/fullboard/ ghcr.io/weibschatten/fullboard
```

## Ortam değişkenleri

| Değişken | Açıklama | Varsayılan |
| --- | --- | --- |
| `XUI_DB_TYPE` | Veritabanı: `sqlite` veya `postgres` | `sqlite` |
| `XUI_DB_DSN` | PostgreSQL bağlantı dizesi | — |
| `XUI_DB_FOLDER` | SQLite dosyasının dizini | `/etc/fullboard` |
| `XUI_DB_MAX_OPEN_CONNS` | Maks. açık bağlantı (PostgreSQL havuzu) | — |
| `XUI_DB_MAX_IDLE_CONNS` | Maks. boşta bağlantı (PostgreSQL havuzu) | — |
| `XUI_INIT_WEB_BASE_PATH` | Panelin ilk URI yolu | `/` |
| `XUI_PORT` | Panel portunu geçersiz kıl | — |
| `XUI_ENABLE_FAIL2BAN` | Fail2ban ile IP limiti | `true` |
| `XUI_LOG_LEVEL` | Günlük seviyesi (`debug`, `info`, `warning`, `error`) | `info` |
| `XUI_DEBUG` | Hata ayıklama modu | `false` |
| `XUI_TUNNEL_HEALTH_MONITOR` | URL'yi yoklar, tekrarlanan hatalardan sonra Xray'i yeniden başlatır (tüm istemciler kopar) | `false` |
| `XUI_TUNNEL_HEALTH_PROXY` | Yoklama proxy'si, ör. yerel inbound (`socks5://127.0.0.1:1080`) | — |
| `XUI_TUNNEL_HEALTH_URL` | Yoklanan URL | `https://www.cloudflare.com/cdn-cgi/trace` |
| `XUI_TUNNEL_HEALTH_INTERVAL` | Yoklama aralığı | `30s` |
| `XUI_TUNNEL_HEALTH_TIMEOUT` | Yoklama zaman aşımı | `10s` |
| `XUI_TUNNEL_HEALTH_FAILURES` | Yeniden başlatmadan önceki ardışık hata sayısı | `3` |
| `XUI_TUNNEL_HEALTH_COOLDOWN` | Yeniden başlatmalar arası minimum süre | `5m` |
| `NODE_TOKEN_ENCRYPTION` | Düğüm token şifrelemesi: `off`, `migration` veya `required` | `off` |
| `XUI_NODE_TOKEN_KEY_FILE` | JSON anahtarlık (mod `0600`) | `/etc/fullboard/node_token_key.json` |
| `XUI_NODE_TOKEN_KEY` | Anahtar dosyası yüklenemezse tek base64 32 bayt anahtar | — |

Tam liste [ortam değişkenleri referansında](docs/content/docs/en/reference/env-vars.mdx).

## Diller

English · فارسی · العربية · 中文（简体） · 中文（繁體） · Español · Русский · Українська · Türkçe · Tiếng Việt · 日本語 · Bahasa Indonesia · Português (Brasil)

## Katkı

Katkılar memnuniyetle karşılanır. Issue veya pull request açmadan önce [katkı rehberini](/CONTRIBUTING.md) okuyun. Güvenlik açıkları için [SECURITY.md](/SECURITY.md).

## Teşekkürler

- [Iran v2ray rules](https://github.com/chocolate4u/Iran-v2ray-rules) (GPL-3.0): İran alan adları içeren, güvenlik ve reklam engelleme odaklı yönlendirme kuralları.
- [Russia v2ray rules](https://github.com/runetfreedom/russia-v2ray-rules-dat) (GPL-3.0): Rusya'da engellenen alan adı ve adreslere göre otomatik güncellenen kurallar.

## Lisans

FullBoard, [GNU General Public License v3.0](/LICENSE) ile lisanslanmıştır.
