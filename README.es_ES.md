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

**FullBoard** es un panel web de código abierto para administrar servidores [Xray-core](https://github.com/XTLS/Xray-core). Ofrece una interfaz multilingüe para desplegar, configurar y supervisar una amplia gama de protocolos proxy y VPN, desde un único VPS hasta despliegues con varios nodos.

> [!IMPORTANT]
> Este proyecto está pensado para uso personal. No lo utilices con fines ilegales.

## Características

- **Inbounds multiprotocolo**: VLESS, VMess, Trojan, Shadowsocks, WireGuard, AmneziaWG, TUIC v5, Hysteria2, MTProto, HTTP, SOCKS (Mixed), Dokodemo-door / Tunnel y TUN.
- **Transportes y seguridad modernos**: TCP (Raw), mKCP, WebSocket, gRPC, HTTPUpgrade y XHTTP, con TLS, XTLS y REALITY.
- **AmneziaWG integrado**: WireGuard resistente a DPI dentro del panel sobre una pila de red en espacio de usuario, sin módulo del kernel, DKMS ni paquetes extra.
- **Servidor TUIC v5 nativo**: servidor QUIC en proceso con enrutamiento de Xray y contabilidad de tráfico por cliente (BBR y New Reno).
- **Proxies MTProto**: secretos FakeTLS, ad-tags y cuotas por cliente, aplicados en vivo sin cortar conexiones.
- **Fallbacks**: varios protocolos en un mismo puerto (por ejemplo VLESS y Trojan en 443).
- **Gestión por cliente**: cuotas de tráfico, fechas de caducidad, límites de IP con direcciones de confianza, límites de dispositivos HWID, renovaciones programadas, estado en línea, enlaces, códigos QR y suscripciones.
- **Estadísticas de tráfico** por inbound, cliente y outbound, con reinicio.
- **Multinodo**: administra muchos servidores desde un panel, incluida la clonación de inbounds a otros nodos.
- **Outbounds y enrutamiento**: WARP, NordVPN, PIA, reglas personalizadas, balanceadores con cadenas de fallback y encadenamiento de proxies. Las categorías geosite/geoip se exploran desde el editor de reglas.
- **Servidor de suscripciones**: salida raw, JSON y Clash según el User-Agent del cliente, más [plantillas de página personalizadas](docs/custom-subscription-templates.md).
- **Bots de Telegram y Discord** para supervisión y gestión remotas.
- **API REST** con tokens con alcance y caducidad opcional, y referencia de API en el panel.
- **Panel instalable (PWA)** para escritorio y móvil.
- **Almacenamiento**: SQLite (predeterminado) o PostgreSQL.
- **13 idiomas** con temas claro y oscuro.
- **Integración con Fail2ban** para aplicar límites de IP por cliente.

## Capturas de pantalla

<details>
<summary>Haz clic para expandir</summary>

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

## Inicio rápido

```bash
bash <(curl -Ls https://raw.githubusercontent.com/WeIbSchatten/FullBoard/main/install.sh)
```

Para instalar una versión concreta, añade su etiqueta:

```bash
bash <(curl -Ls https://raw.githubusercontent.com/WeIbSchatten/FullBoard/main/install.sh) v3.7.0
```

Para la compilación **dev** (último pre-release de `main`), usa `dev-latest`:

```bash
bash <(curl -Ls https://raw.githubusercontent.com/WeIbSchatten/FullBoard/main/install.sh) dev-latest
```

El instalador genera un usuario, contraseña y ruta de acceso aleatorios. Después ejecuta `fullboard` para abrir el menú de gestión: iniciar/detener el servicio, ver o restablecer credenciales, gestionar certificados SSL y más.

Cada archivo de release incluye un `.sha256`. Tanto `install.sh` como el actualizador verifican el archivo y se detienen si no coincide.

La documentación completa (instalación, configuración, operación y referencia de API) está en la carpeta [`docs/`](docs/).

### Instalación desatendida

El instalador funciona **sin interacción** (por ejemplo desde cloud-init). Define `XUI_NONINTERACTIVE=1` o ejecútalo sin TTY: genera credenciales aleatorias y las guarda en `/etc/fullboard/install-result.env`. Consulta [`deploy/`](deploy/):

- [Cloud-init user-data](deploy/cloud-init/) para cualquier proveedor
- [Notas para Hetzner Cloud](deploy/marketplace/hetzner/)

### Gestión

| Comando | Función |
| --- | --- |
| `fullboard` | Menú interactivo |
| `fullboard start` / `stop` / `restart` | Controlar el servicio |
| `fullboard status` | Estado del servicio |
| `fullboard settings` | Ajustes actuales del panel |
| `fullboard log` | Registros recientes |
| `fullboard update` | Actualizar a la última versión |
| `fullboard uninstall` | Eliminar el panel |

Rutas: binario y recursos de Xray en `/usr/local/fullboard`, base de datos y estado en `/etc/fullboard`, registros en `/var/log/fullboard`, servicio `fullboard.service`.

## Plataformas compatibles

**Sistemas operativos:** Ubuntu, Debian, Armbian, Fedora, CentOS, RHEL, AlmaLinux, Rocky Linux, Oracle Linux, Amazon Linux, Virtuozzo, Arch, Manjaro, Parch, openSUSE (Tumbleweed / Leap), Alpine y Windows.

**Arquitecturas:** `amd64` · `386` · `arm64` (aarch64) · `armv7` · `armv6` · `armv5` · `s390x`.

## Base de datos

FullBoard admite dos backends, elegidos durante la instalación:

- **SQLite** (predeterminado): un único archivo en `/etc/fullboard/fullboard.db`. Sin configuración, ideal para despliegues pequeños y medianos.
- **PostgreSQL**: recomendado para muchos clientes o varios nodos. El instalador puede instalarlo localmente o usar el DSN de un servidor existente.

El backend se elige con variables de entorno (el instalador las escribe en `/etc/default/fullboard`):

```
XUI_DB_TYPE=postgres
XUI_DB_DSN=postgres://xui:password@127.0.0.1:5432/xui?sslmode=disable
```

### Migrar de SQLite a PostgreSQL

```bash
fullboard migrate-db --dsn "postgres://xui:password@127.0.0.1:5432/xui?sslmode=disable"
# después define XUI_DB_TYPE y XUI_DB_DSN en /etc/default/fullboard y reinicia:
systemctl restart fullboard
```

El archivo SQLite original no se modifica; elimínalo cuando hayas verificado el nuevo backend.

## Docker

```bash
docker compose up -d
```

Por defecto se usa SQLite. Para el servicio PostgreSQL incluido, descomenta las dos líneas `XUI_DB_*` de `docker-compose.yml` y arranca con el perfil:

```bash
docker compose --profile postgres up -d
```

La imagen incluye Fail2ban (activo por defecto) para los **límites de IP** por cliente. Bloquea con `iptables`, lo que requiere la capacidad `NET_ADMIN`. `docker-compose.yml` ya la concede; con `docker run` añádela tú, o los bloqueos solo se registrarán:

```bash
docker run -d --cap-add=NET_ADMIN --cap-add=NET_RAW -p 2053:2053 -v $PWD/db/:/etc/fullboard/ ghcr.io/weibschatten/fullboard
```

## Variables de entorno

| Variable | Descripción | Predeterminado |
| --- | --- | --- |
| `XUI_DB_TYPE` | Backend: `sqlite` o `postgres` | `sqlite` |
| `XUI_DB_DSN` | Cadena de conexión de PostgreSQL | — |
| `XUI_DB_FOLDER` | Directorio del archivo SQLite | `/etc/fullboard` |
| `XUI_DB_MAX_OPEN_CONNS` | Máx. conexiones abiertas (pool PostgreSQL) | — |
| `XUI_DB_MAX_IDLE_CONNS` | Máx. conexiones inactivas (pool PostgreSQL) | — |
| `XUI_INIT_WEB_BASE_PATH` | Ruta URI inicial del panel | `/` |
| `XUI_PORT` | Sobrescribe el puerto del panel | — |
| `XUI_ENABLE_FAIL2BAN` | Límites de IP mediante Fail2ban | `true` |
| `XUI_LOG_LEVEL` | Nivel de registro (`debug`, `info`, `warning`, `error`) | `info` |
| `XUI_DEBUG` | Modo depuración | `false` |
| `XUI_TUNNEL_HEALTH_MONITOR` | Sondea una URL y reinicia Xray tras fallos repetidos (desconecta a todos los clientes) | `false` |
| `XUI_TUNNEL_HEALTH_PROXY` | Proxy del sondeo, p. ej. un inbound local (`socks5://127.0.0.1:1080`) | — |
| `XUI_TUNNEL_HEALTH_URL` | URL sondeada | `https://www.cloudflare.com/cdn-cgi/trace` |
| `XUI_TUNNEL_HEALTH_INTERVAL` | Intervalo entre sondeos | `30s` |
| `XUI_TUNNEL_HEALTH_TIMEOUT` | Tiempo límite por sondeo | `10s` |
| `XUI_TUNNEL_HEALTH_FAILURES` | Fallos seguidos antes de reiniciar | `3` |
| `XUI_TUNNEL_HEALTH_COOLDOWN` | Espera mínima entre reinicios | `5m` |
| `NODE_TOKEN_ENCRYPTION` | Cifrado de tokens de nodos: `off`, `migration` o `required` | `off` |
| `XUI_NODE_TOKEN_KEY_FILE` | Llavero JSON (modo `0600`) | `/etc/fullboard/node_token_key.json` |
| `XUI_NODE_TOKEN_KEY` | Una clave base64 de 32 bytes si no se puede cargar el llavero | — |

La lista completa está en la [referencia de variables de entorno](docs/content/docs/en/reference/env-vars.mdx).

## Idiomas

English · فارسی · العربية · 中文（简体） · 中文（繁體） · Español · Русский · Українська · Türkçe · Tiếng Việt · 日本語 · Bahasa Indonesia · Português (Brasil)

## Contribuir

Las contribuciones son bienvenidas. Lee la [guía de contribución](/CONTRIBUTING.md) antes de abrir un issue o pull request. Para vulnerabilidades, consulta [SECURITY.md](/SECURITY.md).

## Agradecimientos

- [Iran v2ray rules](https://github.com/chocolate4u/Iran-v2ray-rules) (GPL-3.0): reglas de enrutamiento con dominios iraníes integrados, centradas en seguridad y bloqueo de anuncios.
- [Russia v2ray rules](https://github.com/runetfreedom/russia-v2ray-rules-dat) (GPL-3.0): reglas actualizadas automáticamente según dominios y direcciones bloqueados en Rusia.

## Licencia

FullBoard se distribuye bajo la [GNU General Public License v3.0](/LICENSE).
