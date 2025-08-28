// maintenance.js – SINGLE IMPLEMENTATION: backup, cleanup, diagnostics
import { settings } from './settings';
import { shitterData, saveData } from './utils/data';
import { slInfo } from './utils/core';

const DAY_MS=86400000;

function autoBackupIfNeeded(){
  if(!settings.autoBackup) return; const now=Date.now();
  const today=new Date().toISOString().split('T')[0];
  const backupName=`backup_${today}.json`;
  if(FileLib.read('Shitterlist', backupName)) return; // one per day
  try { FileLib.write('Shitterlist', backupName, JSON.stringify(shitterData.players||[],null,2)); if(settings.debugMode) slInfo(`Backup erstellt: ${backupName}`); } catch(e){ if(settings.debugMode) slInfo('Backup Fehler: '+e.message); }
}

function autoCleanupOldEntries(){
  const days=settings.autoCleanupDays; if(!days||days<=0) return;
  const cutoff=Date.now()-days*DAY_MS;
  const before=shitterData.players.length;
  shitterData.players=shitterData.players.filter(p=>!p.dateAdded || p.dateAdded>=cutoff);
  const removed=before-shitterData.players.length;
  if(removed>0){ saveData(); slInfo(`Cleanup entfernte ${removed}`); }
}

export function getBreakdown(){
  const total=shitterData.players.length;
  const apiEntries=shitterData.players.filter(p=>p.source==='api');
  const localEntries=total-apiEntries.length;
  const seen={}; shitterData.players.forEach(p=>{ const k=p.name.toLowerCase(); seen[k]=(seen[k]||0)+1; });
  const duplicates=Object.keys(seen).filter(k=>seen[k]>1);
  const apiByReason=shitterData.players.filter(p=>(p.reason||'').startsWith('[API]')).length;
  return { total, api: apiEntries.length, local: localEntries, duplicates, apiByReason, mismatch: apiByReason!==apiEntries.length };
}

export function reclassAPIEntries(){ let changed=0; shitterData.players.forEach(p=>{ if((p.reason||'').startsWith('[API]') && p.source!=='api'){ p.source='api'; changed++; }}); if(changed){ saveData(); } return changed; }

// periodic every ~60s
register('step',()=>{ autoBackupIfNeeded(); autoCleanupOldEntries(); }).setDelay(60);

const __g_maint=(typeof globalThis!=='undefined')?globalThis:(typeof global!=='undefined'?global:this);
try { Object.assign(__g_maint,{ getBreakdown, reclassAPIEntries }); } catch(_) {}
if(settings.debugMode) slInfo('Maintenance Modul aktiv');
