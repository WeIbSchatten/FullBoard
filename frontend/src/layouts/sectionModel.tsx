import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ApartmentOutlined,
  CloudServerOutlined,
  ClusterOutlined,
  CodeOutlined,
  DatabaseOutlined,
  DiscordOutlined,
  MailOutlined,
  MessageOutlined,
  SafetyOutlined,
  SettingOutlined,
  SwapOutlined,
} from '@ant-design/icons';

import { useAllSettings } from '@/api/queries/useAllSettings';
import type { SectionNavItem } from '@/components/ui/SectionNav';

// Shared by the sidebar submenus and the in-page section switchers.
export function useSettingsSections(): SectionNavItem[] {
  const { t } = useTranslation();
  const { allSetting } = useAllSettings();
  const showSubFormats = !!(allSetting.subJsonEnable || allSetting.subClashEnable);
  const showSubBalancers = !!allSetting.subJsonEnable;
  return useMemo(() => {
    const items: SectionNavItem[] = [
      { key: 'general', icon: <SettingOutlined />, label: t('pages.settings.panelSettings') },
      { key: 'security', icon: <SafetyOutlined />, label: t('pages.settings.securitySettings') },
      { key: 'telegram', icon: <MessageOutlined />, label: t('pages.settings.TGBotSettings') },
      { key: 'email', icon: <MailOutlined />, label: t('pages.settings.emailSettings') },
      { key: 'discord', icon: <DiscordOutlined />, label: t('pages.settings.discordSettings') },
      {
        key: 'subscription',
        icon: <CloudServerOutlined />,
        label: t('pages.settings.subSettings'),
      },
    ];
    if (showSubFormats) {
      items.push({
        key: 'subscription-formats',
        icon: <CodeOutlined />,
        label: t('menu.subFormats'),
      });
    }
    if (showSubBalancers) {
      items.push({
        key: 'subscription-balancers',
        icon: <ApartmentOutlined />,
        label: t('pages.settings.subBalancers.menu'),
      });
    }
    return items;
  }, [t, showSubFormats, showSubBalancers]);
}

export function useXraySections(): SectionNavItem[] {
  const { t } = useTranslation();
  return useMemo(
    () => [
      { key: 'basic', icon: <SettingOutlined />, label: t('pages.xray.basicTemplate') },
      { key: 'routing', icon: <SwapOutlined />, label: t('pages.xray.Routings') },
      { key: 'balancer', icon: <ClusterOutlined />, label: t('pages.xray.Balancers') },
      { key: 'dns', icon: <DatabaseOutlined />, label: 'DNS' },
      { key: 'advanced', icon: <CodeOutlined />, label: t('pages.xray.advancedTemplate') },
    ],
    [t],
  );
}
