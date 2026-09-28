/**
 * Backup and export utilities.
 *
 * Legacy utterance-only snapshot utility. Database upgrades use
 * upgrade-backup.js for a complete raw recovery copy; portable full backups
 * use export.js. This utility is not a complete archive backup.
 */

const BACKUP_PREFIX = 'all-i-say-backup-';

function makeBackupKey(timestamp = new Date().toISOString()) {
  return `${BACKUP_PREFIX}${timestamp.replace(/[:.]/g, '-')}`;
}

export async function backupRepository(repository, timestamp = new Date().toISOString()) {
  const backup = {
    backupAt: timestamp,
    schemaVersion: await repository.getSchemaVersion(),
    utterances: await repository.listUtterances({ includeHistory: true, limit: Infinity })
  };

  const key = makeBackupKey(timestamp);
  const existing = localStorage.getItem(key);
  if (existing) throw new Error(`Backup for ${timestamp} already exists`);
  localStorage.setItem(key, JSON.stringify(backup));
  return { key, backup };
}

export function listBackups() {
  const backups = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith(BACKUP_PREFIX)) {
      try {
        const backup = JSON.parse(localStorage.getItem(key));
        backups.push({ key, backup });
      } catch (e) {
        console.error(`Failed to parse backup ${key}:`, e);
      }
    }
  }
  return backups.sort((a, b) => new Date(b.backup.backupAt) - new Date(a.backup.backupAt));
}

export function restoreBackup(key) {
  const data = localStorage.getItem(key);
  if (!data) throw new Error(`Backup ${key} not found`);
  try {
    return JSON.parse(data);
  } catch (error) {
    throw new Error(`Failed to parse backup ${key}: ${error.message}`);
  }
}

export function deleteBackup(key) {
  localStorage.removeItem(key);
}
