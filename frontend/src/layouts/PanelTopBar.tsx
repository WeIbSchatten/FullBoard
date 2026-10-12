import { useMemo } from 'react';
import { Link, useLocation } from 'react-router';
import { useTranslation } from 'react-i18next';
import { SearchOutlined, UserOutlined } from '@ant-design/icons';

import { useCommandPalette } from '@/components/command-palette/useCommandPalette';
import './PanelTopBar.css';

const SHORTCUT_MODIFIER = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent) ? '⌘' : 'Ctrl';

const CRUMB_KEYS: { match: RegExp; titleKey: string }[] = [
  { match: /^\/?$/, titleKey: 'menu.dashboard' },
  { match: /^\/inbounds/, titleKey: 'menu.inbounds' },
  { match: /^\/clients/, titleKey: 'menu.clients' },
  { match: /^\/groups/, titleKey: 'menu.groups' },
  { match: /^\/nodes/, titleKey: 'menu.nodes' },
  { match: /^\/hosts/, titleKey: 'menu.hosts' },
  { match: /^\/tg-web-proxy/, titleKey: 'menu.tgWebProxy' },
  { match: /^\/outbound/, titleKey: 'menu.outbounds' },
  { match: /^\/routing/, titleKey: 'menu.routing' },
  { match: /^\/settings/, titleKey: 'menu.settings' },
  { match: /^\/xray/, titleKey: 'menu.xray' },
  { match: /^\/api-docs/, titleKey: 'menu.apiDocs' },
];

export default function PanelTopBar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { open: openCommandPalette } = useCommandPalette();

  const crumb = useMemo(() => {
    const hit = CRUMB_KEYS.find((c) => c.match.test(pathname));
    return t(hit?.titleKey || 'menu.dashboard');
  }, [pathname, t]);

  return (
    <header className="panel-topbar">
      <nav className="panel-topbar-crumbs" aria-label="Breadcrumb">
        <Link to="/" className="panel-topbar-crumb-root">
          FullBoard
        </Link>
        <span className="panel-topbar-crumb-sep" aria-hidden>
          /
        </span>
        <span className="panel-topbar-crumb-current">{crumb}</span>
      </nav>

      <div className="panel-topbar-actions">
        <button
          type="button"
          className="panel-topbar-search"
          onClick={openCommandPalette}
          aria-label={t('commandPalette.title') || 'Command Palette (Ctrl + K)'}
        >
          <SearchOutlined className="panel-topbar-search-icon" />
          <span className="panel-topbar-search-text">{t('commandPalette.search') || 'Search'}</span>
          <span className="panel-topbar-search-kbd">
            <kbd>{SHORTCUT_MODIFIER}</kbd>
            <kbd>K</kbd>
          </span>
        </button>

        <Link to="/settings#security" className="panel-topbar-user" title={t('menu.settings')}>
          <span className="panel-topbar-avatar" aria-hidden>
            <UserOutlined />
          </span>
          <span className="panel-topbar-user-name">Admin</span>
        </Link>
      </div>
    </header>
  );
}
