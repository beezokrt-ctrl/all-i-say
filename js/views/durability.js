export function backupControls() {
  return (
    '<div class="backup-controls"><button id="backupNow" class="button-ghost" ' +
    'type="button">Back up now</button></div>'
  );
}

export function durabilityView() {
  return (
    (
      '<details id="archiveCare" class="archive-care"><summary>' +
      'Archive &amp; backups</summary><div class="archive-care-body">'
    ) +
    backupControls() +
    (
      '<p id="lastBackupExport" class="small">Checking backup history…</p>' +
      '<p id="backupMessage" class="small" role="status" aria-live="polite"></p>' +
      '<a id="backupDownload" class="backup-retry" hidden>Download this backup again</a>' +
      '<div class="import-controls"><label for="archiveImport">Import a backup</label>' +
      '<input id="archiveImport" type="file" accept=".json,application/json">' +
      '<button id="importBackup" type="button" class="button-ghost">' +
      'Import selected backup</button><p id="importMessage" class="small" role="status" ' +
      'aria-live="polite">Import adds records. Existing words are never replaced.</p></div>' +
      '<details><summary>Storage &amp; offline access</summary><p class="small">' +
      'Your archive lives in this browser on this device. Keep a backup file somewhere you ' +
      'can find it.</p><p id="storageProtection" class="small" role="status">' +
      'Checking storage protection…</p><button id="requestStorageProtection" ' +
      'class="button-ghost" type="button">Request storage protection</button>' +
      '<p id="offlineStatus" class="small" role="status">Checking offline access…</p>' +
      '<p class="small">On iPhone: open this page in Safari, use Share, then Add to Home ' +
      'Screen. Wait for “Ready for offline use” here before going offline. Keep using the ' +
      'same website address for this archive.</p></details></div></details>'
    )
  );
}

export function backupAge(receipt, now = Date.now()) {
  const date = Date.parse(receipt?.exportedAt);
  if (!Number.isFinite(date)) return "No backup exported on this device yet";
  if (date > now) return "Last backup exported " + new Date(date).toLocaleDateString();
  const days = Math.floor((now - date) / 86400000);
  return "Last backup exported " + (days === 0 ? "today" : days === 1 ? "1 day ago" : `${days} days ago`);
}

export const storageProtectionText = {
  granted: "Storage protection granted. Keep a separate backup too.",
  "best-effort": "Storage protection has not been granted. Your browser may clear local data.",
  denied: "This browser did not grant storage protection. Keep a backup file.",
  unsupported: "Storage protection requests are not supported here. Keep a backup file.",
  unavailable: "Could not check storage protection. Keep a backup file.",
};
