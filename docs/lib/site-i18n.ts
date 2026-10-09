import type { Locale } from './i18n';

// UI strings for the marketing chrome (landing page hero/features/footer + the
// shared navbar labels). The docs *pages* are translated as MDX under
// content/docs/{locale}; this covers the React-rendered home page and nav that
// can't live in MDX. English is the source; ru falls back to en.
//
// Convention matches the docs: translate prose only — product/protocol names
// (FullBoard, Xray, VLESS, REALITY, x25519, Docker, REST API, …) stay in Latin.
export interface SiteMessages {
  tagline: string;
  getStarted: string;
  viewOnGitHub: string;
  documentation: string;
  donate: string;
  docs: string;
  stars: string;
  forks: string;
  latest: string;
  copyCommand: string;
  copied: string;
  featuresHeading: string;
  featuresSubtitle: string;
  // Order matches the icon list in components/home/features.tsx.
  features: { title: string; description: string }[];
  // Footer license line: `{app} — {before}<a>GPL-3.0</a>{after}` (spacing baked in).
  licenseBefore: string;
  licenseAfter: string;
}

const en: SiteMessages = {
  tagline: 'Advanced web panel for managing Xray-core servers',
  getStarted: 'Get started',
  viewOnGitHub: 'View on GitHub',
  documentation: 'Documentation',
  donate: 'Donate',
  docs: 'Docs',
  stars: 'stars',
  forks: 'forks',
  latest: 'latest',
  copyCommand: 'Copy install command',
  copied: 'Copied',
  featuresHeading: 'Everything you need to run Xray',
  featuresSubtitle:
    'A modern, fast control panel for Xray-core — built for operators who want power without the command-line grind.',
  features: [
    {
      title: 'Every major protocol',
      description:
        'VLESS, VMess, Trojan, Shadowsocks, WireGuard, Hysteria2, SOCKS, HTTP and Dokodemo-door — managed from one panel.',
    },
    {
      title: 'REALITY & XTLS-Vision',
      description:
        'First-class support for VLESS + REALITY with x25519 keys, short IDs and the xtls-rprx-vision flow for stealth and speed.',
    },
    {
      title: 'Clients & traffic control',
      description:
        'Per-client traffic quotas, expiry dates, IP limits and live online status, with one-click share links and QR codes.',
    },
    {
      title: 'Multi-node & subscriptions',
      description:
        'Coordinate multiple servers, managed hosts and external proxies, and serve VLESS / Clash / JSON subscriptions.',
    },
    {
      title: 'Telegram & Discord bots',
      description:
        'Built-in Telegram and Discord notifications for traffic caps, expiry warnings and system load, plus admin actions.',
    },
    {
      title: 'Self-hosted & scriptable',
      description:
        'A single Go binary or Docker image, an SQLite/PostgreSQL backend, and a full REST API for automation.',
    },
  ],
  licenseBefore: 'released under the ',
  licenseAfter: ' license.',
};

const ru: SiteMessages = {
  tagline: 'Продвинутая веб-панель для управления серверами Xray-core',
  getStarted: 'Начать',
  viewOnGitHub: 'Открыть на GitHub',
  documentation: 'Документация',
  donate: 'Поддержать',
  docs: 'Документация',
  stars: 'звёзд',
  forks: 'форков',
  latest: 'последняя',
  copyCommand: 'Скопировать команду установки',
  copied: 'Скопировано',
  featuresHeading: 'Всё необходимое для запуска Xray',
  featuresSubtitle:
    'Современная и быстрая панель управления для Xray-core — создана для администраторов, которым нужна мощь без возни с командной строкой.',
  features: [
    {
      title: 'Все основные протоколы',
      description:
        'VLESS, VMess, Trojan, Shadowsocks, WireGuard, Hysteria2, SOCKS, HTTP и Dokodemo-door — под управлением из одной панели.',
    },
    {
      title: 'REALITY и XTLS-Vision',
      description:
        'Первоклассная поддержка VLESS + REALITY с ключами x25519, short ID и потоком xtls-rprx-vision для скрытности и скорости.',
    },
    {
      title: 'Клиенты и контроль трафика',
      description:
        'Квоты трафика по клиентам, даты окончания, лимиты IP и статус «онлайн» в реальном времени, плюс ссылки-подписки и QR-коды в один клик.',
    },
    {
      title: 'Мультинода и подписки',
      description:
        'Координация нескольких серверов, управляемых хостов и внешних прокси, а также выдача подписок VLESS / Clash / JSON.',
    },
    {
      title: 'Telegram- и Discord-боты',
      description:
        'Встроенные уведомления Telegram и Discord о лимитах трафика, истечении срока и нагрузке системы, а также действия администратора.',
    },
    {
      title: 'Свой хостинг и скрипты',
      description:
        'Один бинарный файл Go или Docker-образ, бэкенд SQLite/PostgreSQL и полноценный REST API для автоматизации.',
    },
  ],
  licenseBefore: 'распространяется под лицензией ',
  licenseAfter: '.',
};

const messages: Record<Locale, SiteMessages> = { en, ru };

export function getSiteMessages(lang: string): SiteMessages {
  return messages[lang as Locale] ?? en;
}
