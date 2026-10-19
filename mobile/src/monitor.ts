import { Platform } from 'react-native';
import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

import { panelApi } from '@/api/panel';
import { LANG_PREF } from '@/i18n';
import { resolveLanguage, translate } from '@/i18n/translate';
import { healthAlerts, type HealthAlert, type HealthSnapshot } from '@/lib/health';
import { LEGACY_PANELS_PREF, PANELS_PREF, parseStored, type Panel } from '@/panels';
import { getPref, setPref } from '@/prefs';

export const MONITOR_TASK = 'we1ssboard-health';
export const MONITOR_PREF = 'we1ssboard.alerts';
const snapshotPref = (panelId: string) => `we1ssboard.health.${panelId}`;

async function snapshotOf(panel: Panel): Promise<HealthSnapshot> {
  const api = panelApi(panel);
  const [status, nodes] = await Promise.all([api.status(), api.nodes().catch(() => [])]);
  return {
    xrayRunning: status.xray.state === 'running',
    nodes: Object.fromEntries(
      nodes.filter((n) => n.enable).map((n) => [String(n.id), { name: n.name, online: n.status === 'online' }]),
    ),
  };
}

function alertText(lang: ReturnType<typeof resolveLanguage>, panel: string, a: HealthAlert): string {
  return translate(lang, `mobile.alerts.${a.kind}`, { panel, node: 'node' in a ? a.node : '' });
}

// Runs headless: no React tree, so it reads panels and language straight from storage.
export async function checkPanels(): Promise<void> {
  const [raw, legacy, savedLang] = await Promise.all([getPref(PANELS_PREF), getPref(LEGACY_PANELS_PREF), getPref(LANG_PREF)]);
  const lang = resolveLanguage(savedLang ?? Intl.DateTimeFormat().resolvedOptions().locale);
  for (const panel of parseStored(raw, legacy).panels) {
    let next: HealthSnapshot;
    try {
      next = await snapshotOf(panel);
    } catch {
      continue;
    }
    const stored = await getPref(snapshotPref(panel.id));
    const prev = stored ? (JSON.parse(stored) as HealthSnapshot) : undefined;
    for (const alert of healthAlerts(prev, next)) {
      await Notifications.scheduleNotificationAsync({
        content: { title: 'We1ssBoard', body: alertText(lang, panel.name, alert) },
        trigger: null,
      });
    }
    await setPref(snapshotPref(panel.id), JSON.stringify(next));
  }
}

if (Platform.OS !== 'web') {
  TaskManager.defineTask(MONITOR_TASK, async () => {
    try {
      await checkPanels();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export async function setAlertsEnabled(on: boolean): Promise<'ok' | 'denied'> {
  if (on) {
    const perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) return 'denied';
    await checkPanels();
    await BackgroundTask.registerTaskAsync(MONITOR_TASK, { minimumInterval: 15 });
  } else if (await TaskManager.isTaskRegisteredAsync(MONITOR_TASK)) {
    await BackgroundTask.unregisterTaskAsync(MONITOR_TASK);
  }
  await setPref(MONITOR_PREF, on ? '1' : null);
  return 'ok';
}
