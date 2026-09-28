import { getArchive } from './archive.js';
import { exportAll, downloadExport } from '../storage/export.js';
import { importAll } from '../storage/import.js';

export async function exportArchive({archive}={}) {
  return exportAll(archive||await getArchive());
}

export async function downloadArchiveExport({archive,download=downloadExport}={}) {
  const repository=archive||await getArchive();
  const payload=await exportAll(repository);
  const filename=`all-i-say-backup-${payload.exportedAt.replace(/[:.]/g,'-')}.json`;
  const delivery=await download(payload,filename);
  const receipt={filename,exportedAt:payload.exportedAt,requestedAt:new Date().toISOString()};
  try{
    await repository.recordBackupExport(receipt);
    return {...delivery,receipt,receiptSaved:true};
  }catch{
    // A failed metadata write does not undo an already requested download.
    return {...delivery,receipt,receiptSaved:false};
  }
}

export async function getLastBackupExport({archive}={}) {
  const repository=archive||await getArchive();
  return repository.getLastBackupExport();
}

export async function importArchiveFromFile(file,{archive}={}) {
  const payload=JSON.parse(await file.text());
  const repository=archive||await getArchive();
  return importAll(repository,payload,{conflict:'skip'});
}
