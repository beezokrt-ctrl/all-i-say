/**
 * Full-archive export and import.
 *
 * The export format is the canonical portable representation of the archive.
 * It is versioned independently of the internal storage schema.
 */

const EXPORT_FORMAT_VERSION = 1;

export async function exportAll(repository) {
  return {
    exportFormatVersion: EXPORT_FORMAT_VERSION,
    schemaVersion: await repository.getSchemaVersion(),
    exportedAt: new Date().toISOString(),
    utterances: await repository.listUtterances({ status: undefined, limit: Infinity })
  };
}

export function exportAsJSON(exportPayload) {
  return JSON.stringify(exportPayload, null, 2);
}

export function downloadExport(payload, filename = `all-i-say-export-${new Date().toISOString().slice(0, 10)}.json`) {
  const data = exportAsJSON(payload);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
