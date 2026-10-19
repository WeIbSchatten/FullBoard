import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { InboundsSection } from '@/components/connections/InboundsSection';
import { BalancersSection, DnsSection, OutboundsSection, RoutingSection } from '@/components/connections/Sections';
import { WebProxySection } from '@/components/connections/WebProxySection';
import { Chips } from '@/components/Pickers';
import { Screen } from '@/components/ui';
import { useT } from '@/i18n';

type Section = 'inbounds' | 'outbounds' | 'routing' | 'balancers' | 'dns' | 'webproxy';

// Mirrors the panel's "Connections" hub: one tab, a chip per section.
export default function Connections() {
  const t = useT();
  const qc = useQueryClient();
  const [section, setSection] = useState<Section>('inbounds');
  const [refreshing, setRefreshing] = useState(false);
  const sections: { value: Section; label: string }[] = [
    { value: 'inbounds', label: t('menu.inbounds') },
    { value: 'outbounds', label: t('menu.outbounds') },
    { value: 'routing', label: t('menu.routing') },
    { value: 'balancers', label: t('pages.xray.Balancers') },
    { value: 'dns', label: 'DNS' },
    { value: 'webproxy', label: t('menu.tgWebProxy') },
  ];
  return (
    <Screen
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        void qc.invalidateQueries().finally(() => setRefreshing(false));
      }}
    >
      <Chips options={sections} value={section} onChange={setSection} />
      {section === 'inbounds' && <InboundsSection />}
      {section === 'outbounds' && <OutboundsSection />}
      {section === 'routing' && <RoutingSection />}
      {section === 'balancers' && <BalancersSection />}
      {section === 'dns' && <DnsSection />}
      {section === 'webproxy' && <WebProxySection />}
    </Screen>
  );
}
