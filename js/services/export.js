import { getArchive } from './archive.js';
import { exportAll, downloadExport } from '../storage/export.js';
import { importAll } from '../storage/import.js';

export async function exportArchive() {
  const archive = await getArchive();
  return exportAll(archive);
}

export async function downloadArchiveExport() {
  const payload = await exportArchive();
  downloadExport(payload);
}

export async function importArchiveFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async event => {
      try {
        const payload = JSON.parse(event.target.result);
        const archive = await getArchive();
        const result = await importAll(archive, payload);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
