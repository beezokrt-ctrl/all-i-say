export async function exportAll(repository) {
  return {
    exportFormatVersion: 1,
    schemaVersion: await repository.getSchemaVersion(),
    exportedAt: new Date().toISOString(),
    utterances: await repository.listUtterances({ status: undefined, limit: Infinity })
  };
}

export function downloadExport(payload, filename = `all-i-say-export-${new Date().toISOString().slice(0, 10)}.json`) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
