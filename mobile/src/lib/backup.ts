import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import type { Session } from '@/api/client';

// getDb streams a file, not the JSON envelope, so it bypasses apiRequest.
export async function shareDatabaseBackup(session: Session): Promise<void> {
  const dir = new Directory(Paths.cache, 'backups');
  if (!dir.exists) dir.create();
  const file = await File.downloadFileAsync(`${session.baseUrl}/panel/api/server/getDb`, dir, {
    headers: { Authorization: `Bearer ${session.token}` },
    idempotent: true,
  });
  await Sharing.shareAsync(file.uri, { mimeType: 'application/octet-stream', dialogTitle: file.name });
}
