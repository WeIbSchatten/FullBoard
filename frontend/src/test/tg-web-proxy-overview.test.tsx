import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import type { ModalApi } from '@/pages/tg-web-proxy/types';

import OverviewTab from '@/pages/tg-web-proxy/OverviewTab';
import type { RelayStatus } from '@/generated/types';
import { renderWithProviders } from './test-utils';

const healthy = {
  supported: true,
  platform: 'linux/amd64',
  binaryInstalled: true,
  binaryPath: '/usr/local/bin/tproxy-server',
  configPath: '/etc/tproxy-server/config.json',
  profilesPath: '/etc/tproxy-server/profiles.json',
  configExists: true,
  profilesExists: true,
  profilesMode: '0400',
  profilesModeOk: true,
  profileCount: 1,
  hostname: 'proxy.example.com',
  basePath: '',
  configError: '',
  units: [
    {
      unit: 'tproxy-server',
      activeState: 'active',
      subState: 'running',
      unitFileState: 'enabled',
      mainPid: 1,
      since: '',
      controllable: true,
    },
  ],
  admin: {
    address: '127.0.0.1:8081',
    reachable: true,
    healthy: true,
    ready: true,
    readyDetail: '',
    error: '',
    metrics: {},
  },
  job: { kind: '', unit: '', state: 'idle', exitCode: null, startedAt: 0, log: '' },
  caddyEncode: { path: '/etc/caddy/Caddyfile', exists: true, needsFix: false },
  usesWebSocket: false,
  backends: { managed: [] },
} as unknown as RelayStatus;

describe('TG Web Proxy overview', () => {
  // Owners kept losing the service controls: a healthy relay folded them away.
  it('always shows the service controls, even when the relay is healthy', () => {
    renderWithProviders(<OverviewTab status={healthy} modal={{} as unknown as ModalApi} />);
    expect(screen.getByText('tproxy-server')).toBeTruthy();
    expect(screen.queryByRole('button', { expanded: false })).toBeNull();
  });
});
