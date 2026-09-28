import { downloadArchiveExport, getLastBackupExport, importArchiveFromFile } from './services/export.js';
import { getStorageProtection, requestStorageProtection } from './services/durability.js';
import { registerOffline, offlineStatusText } from './services/offline.js';
import { backupAge, storageProtectionText } from './views/durability.js';

export function mountDurability(root,{
  exportBackup=downloadArchiveExport,readReceipt=getLastBackupExport,
  checkStorage=getStorageProtection,requestStorage=requestStorageProtection,
  importBackup=importArchiveFromFile,onImported=async()=>{},setupOffline=registerOffline
}={}){
  const find=id=>root.querySelector?.('#'+id);
  const backupButton=find('backupNow'),storageButton=find('requestStorageProtection');
  if(!backupButton||!storageButton)return;
  const message=find('backupMessage'),lastBackup=find('lastBackupExport'),retry=find('backupDownload');
  let busy=false,requesting=false,importing=false,delivery=null;
  const showProtection=state=>{
    find('storageProtection').textContent=storageProtectionText[state];
    storageButton.disabled=state==='granted'||state==='unsupported';
  };
  const refreshReceipt=async()=>{
    try{lastBackup.textContent=backupAge(await readReceipt());}
    catch{lastBackup.textContent='Backup history unavailable on this device';}
  };
  root.addEventListener('click',async event=>{
    if(event.target.closest?.('#backupNow')&&!busy){
      busy=true;backupButton.disabled=true;backupButton.textContent='Preparing backup…';
      retry.hidden=true;
      message.textContent='Preparing your full archive, including artifacts and preserved history.';
      try{
        const next=await exportBackup();
        if(delivery)setTimeout(delivery.release,60000);
        delivery=next;
        retry.href=next.url;retry.download=next.filename;retry.hidden=false;
        message.textContent='Backup download requested. Check that the file is saved in Files or Downloads; this app cannot confirm the save.';
        if(next.receiptSaved)lastBackup.textContent=backupAge(next.receipt);
        else message.textContent+=' The export time could not be remembered on this device.';
      }catch{
        message.textContent='Could not export the backup. Your archive is still on this device. Try again.';
      }finally{
        busy=false;backupButton.disabled=false;backupButton.textContent='Back up now';
      }
    }
    if(event.target.closest?.('#importBackup')&&!importing){
      const input=find('archiveImport'),status=find('importMessage'),button=find('importBackup');
      const file=input.files?.[0];
      if(!file){status.textContent='Choose an All I Say backup file first.';return;}
      importing=true;button.disabled=true;status.textContent='Checking and importing your backup…';
      try{
        const result=await importBackup(file);
        const added=Object.values(result.counts).reduce((sum,n)=>sum+n,0);
        status.textContent=`Import complete. ${added} records added. Existing words were preserved.`;
        input.value='';
        try{await onImported();}catch{status.textContent+=' Reload to refresh the view.';}
      }catch(error){
        status.textContent='Could not import this backup. No records were imported. '+(error instanceof SyntaxError?'The file is not valid JSON.':error.message||'Check the file and try again.');
      }finally{importing=false;button.disabled=false;}
    }
    if(event.target.closest?.('#requestStorageProtection')&&!requesting){
      requesting=true;storageButton.disabled=true;
      try{showProtection(await requestStorage());}
      finally{requesting=false;}
    }
  });
  refreshReceipt();
  checkStorage().then(showProtection);
  setupOffline(state=>{find('offlineStatus').textContent=offlineStatusText[state];});
}
