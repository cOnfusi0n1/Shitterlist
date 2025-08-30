// data.js – SINGLE CONSOLIDATED IMPLEMENTATION
// Provides: shitterData, apiPlayersCache, CRUD, utility queries & stats
import { settings } from '../settings';
import { API_ONLY, slInfo, slSuccess, slWarn, cleanPlayerName, showApiSyncMessage, runAsync, withPrefix, THEME, ALLOWED_FLOORS_HELP } from './core';

// Persistent structure (extended fields kept for compatibility)
export let shitterData = { players: [], version:'1.2.1', warningCooldowns:{}, lastBackup:0, lastSync:0, history: [] };
export let apiPlayersCache = []; // Used when API_ONLY

export function getActivePlayerList(){ return API_ONLY ? apiPlayersCache : shitterData.players; }

export function loadData(){
  try {
    // If running in API_ONLY mode, don't load local file - rely on remote API as source of truth.
    if(API_ONLY){
      const __g=(typeof globalThis!=='undefined')?globalThis:(typeof global!=='undefined'?global:this);
      if(settings.enableAPI && settings.apiUrl && __g.downloadFromAPI) setTimeout(()=>__g.downloadFromAPI(()=>{}), 500);
      return;
    }
    // Non-API mode: load local cached data file
    const raw = FileLib.read('Shitterlist', '.data.json');
    if(raw){ const parsed=JSON.parse(raw); shitterData = Object.assign({}, shitterData, parsed, { players: (parsed.players||[]) }); }
    slSuccess(`${shitterData.players.length} Spieler geladen`);
  } catch(e){ slWarn('Ladefehler: '+e.message); }
}

export function saveData(){ if(API_ONLY) return; try { FileLib.write('Shitterlist', '.data.json', JSON.stringify(shitterData,null,2)); } catch(e){ if(settings.debugMode) slWarn('Speicherfehler: '+e.message); } }

function normName(n){ return settings.caseSensitive ? n : n.toLowerCase(); }

// Placeholder (API overrides bind these in api.js when in API_ONLY add/remove direct to API)
export function apiAddShitterDirect(){ return null; }
export function apiRemoveShitterDirect(){ return false; }

export function addShitter(username, reason='Manual', floor){
  if(!username) return null;
  if(API_ONLY){
    const __g=(typeof globalThis!=='undefined')?globalThis:(typeof global!=='undefined'?global:this);
    const fn=__g.apiAddShitterDirect||apiAddShitterDirect; // fallback to placeholder
  const res=fn(username, reason, floor);
    if(!res) {
      slWarn(`API Add fehlgeschlagen oder bereits vorhanden: ${username}`);
      return res;
    }
    slInfo(`API Add ausstehend: ${username}`);
    // Auto-Entfernung für Test-Einträge nach X Minuten
    try {
      const mins = (settings && typeof settings.testAutoRemoveMinutes==='number') ? settings.testAutoRemoveMinutes|0 : 0;
      if(mins>0 && reason && /test/i.test(String(reason))){
        slInfo(`Auto-Entfernung geplant in ${mins} Min: ${username}`);
        runAsync('autoRemoveTest',()=>{
          try { Java.type('java.lang.Thread').sleep(Math.max(1, mins)*60000); } catch(_){}
          try { removeShitter(username); } catch(e){ if(settings.debugMode) slWarn('Auto-Remove Fehler: '+e.message); }
        });
      }
    } catch(_){}
    return res;
  }
  const cleaned = cleanPlayerName(username);
  const existing = shitterData.players.find(p=>normName(p.name)===normName(cleaned));
  if(existing){
    let changed=false;
    if(reason && reason!==existing.reason){ existing.reason=reason; changed=true; }
    if(floor && floor!==existing.floor){ existing.floor=floor; changed=true; }
    if(changed){ existing.updatedAt=Date.now(); saveData(); slSuccess(`Aktualisiert: ${cleaned}`);} else { slInfo(`Unverändert: ${cleaned}`); }
  // record update in history
  try{ shitterData.history.push({ name: cleaned, action: 'update', reason: existing.reason, floor: existing.floor || null, date: Date.now(), id: existing.id }); saveData(); } catch(_){}
    return existing;
  }
  if(shitterData.players.length >= settings.maxListSize){ slWarn('Maximale Listengröße erreicht'); return null; }
  const entry={ id:Math.random().toString(36).substring(2,11), name:cleaned, reason, floor, severity:1, category:'general', source:'local', dateAdded:Date.now(), updatedAt:Date.now() };
  shitterData.players.push(entry); saveData(); slSuccess(`Hinzugefügt: ${cleaned}`);
  // record add in history
  try{ shitterData.history.push({ name: cleaned, action: 'add', reason: entry.reason, floor: entry.floor || null, date: Date.now(), id: entry.id }); saveData(); } catch(_){}
  try {
    const mins = (settings && typeof settings.testAutoRemoveMinutes==='number') ? settings.testAutoRemoveMinutes|0 : 0;
    if(mins>0 && reason && /test/i.test(String(reason))){
      slInfo(`Auto-Entfernung geplant in ${mins} Min: ${cleaned}`);
      runAsync('autoRemoveTestLocal',()=>{
        try { Java.type('java.lang.Thread').sleep(Math.max(1, mins)*60000); } catch(_){}
        try { removeShitter(cleaned); } catch(e){ if(settings.debugMode) slWarn('Auto-Remove Fehler: '+e.message); }
      });
    }
  } catch(_){}
  return entry;
}

export function removeShitter(username){ if(!username) return false; if(API_ONLY){ const __g=(typeof globalThis!=='undefined')?globalThis:(typeof global!=='undefined'?global:this); const fn=__g.apiRemoveShitterDirect||apiRemoveShitterDirect; const ok=fn(username); if(ok) slSuccess(`${username} (API) entfernt`); else slWarn(`${username} nicht in API Cache`); return ok; } const before=shitterData.players.length; const target=normName(username); shitterData.players = shitterData.players.filter(p=>normName(p.name)!==target); const removed = before!==shitterData.players.length; if(removed){ saveData(); slSuccess(`${username} entfernt`);} else slWarn(`${username} nicht gefunden`); return removed; }

// Enhanced remove that records history (used by commands)
export function removeShitterWithHistory(username){
  if(!username) return false;
  const targetNorm = normName(username);
  const found = shitterData.players.find(p=>normName(p.name)===targetNorm);
  const ok = removeShitter(username);
  if(ok && found){
    try{ shitterData.history.push({ name: found.name, action: 'remove', reason: found.reason || null, floor: found.floor || null, date: Date.now(), id: found.id }); saveData(); } catch(_){}
  }
  return ok;
}

export function getPlayerHistory(name, limit=25){ if(!name) return []; try{ const low = normName(cleanPlayerName(name)||name); return (shitterData.history||[]).filter(h=>normName(h.name)===low).sort((a,b)=>b.date-a.date).slice(0, Math.max(1, limit)); } catch(e){ return []; } }

export function clearList(){ if(API_ONLY){ slWarn('API-Only: kein lokales Löschen'); return; } shitterData.players=[]; saveData(); slSuccess('Liste geleert'); }

export function isShitter(username){ if(!username) return false; const clean=cleanPlayerName(username); const list=getActivePlayerList(); if(API_ONLY && list.length===0 && settings.enableAPI && settings.apiUrl){ if(!isShitter._pending || Date.now()-isShitter._pending>3000){ isShitter._pending=Date.now(); showApiSyncMessage('Cache leer – lade API...','info'); const __g=(typeof globalThis!=='undefined')?globalThis:(typeof global!=='undefined'?global:this); if(__g.downloadFromAPI) __g.downloadFromAPI(()=>{}); } } return list.some(p=>p.name.toLowerCase()===clean.toLowerCase()); }

export function getRandomShitter(){ const list=getActivePlayerList(); if(!list.length){ slWarn('Liste leer'); return null; } const p=list[Math.floor(Math.random()*list.length)]; slInfo(`Random: &c${p.name} &7(${p.reason})`); return p; }
export function exportShitterlist(){ try { const arr=getActivePlayerList(); FileLib.write('Shitterlist','shitterlist_export.json', JSON.stringify(arr,null,2)); slSuccess(`Export (${arr.length}) erstellt`);} catch(e){ slWarn('Export Fehler: '+e.message);} }
export function checkOnlineShitters(){ try { const tab=(TabList.getNames()||[]).map(n=>cleanPlayerName(n)).filter(Boolean); const list=getActivePlayerList(); const online=list.filter(p=>tab.some(t=>t.toLowerCase()===p.name.toLowerCase())); if(!online.length){ slInfo('Keine Shitter online'); return;} slWarn(`Online (${online.length}): ${online.map(o=>o.name).join(', ')}`); } catch(e){ slWarn('Online Check Fehler: '+e.message);} }
export function getShitterStats(){
  const list = getActivePlayerList();
  if(!list.length){ slWarn('Keine Statistiken'); return; }
  const reasonStats = {};
  list.forEach(p=>{ reasonStats[p.reason] = (reasonStats[p.reason]||0) + 1; });
  const dates = list.map(p=>p.dateAdded).sort((a,b)=>a-b);
  const oldest = new Date(dates[0]).toLocaleDateString();
  const newest = new Date(dates[dates.length-1]).toLocaleDateString();
  slInfo('&lStatistiken:');
  slInfo(`Gesamt: ${list.length}`);
  slInfo(`Ältester: ${oldest}`);
  slInfo(`Neuester: ${newest}`);
  slInfo('Top Gründe:');
  Object.entries(reasonStats).sort(([,a],[,b])=>b-a).slice(0,5).forEach(([r,c])=>slInfo(`• ${r}: ${c}`));
}

// Expose legacy globals (Rhino safe)
const __g_data=(typeof globalThis!=='undefined')?globalThis:(typeof global!=='undefined'?global:this);
try { Object.assign(__g_data,{ shitterData, apiPlayersCache, loadData, saveData, addShitter, removeShitter, clearList, getActivePlayerList, exportShitterlist, getRandomShitter, checkOnlineShitters, isShitter }); } catch(_) {}

// Auto-load on module init
loadData();
