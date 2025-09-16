// api.js – SINGLE IMPLEMENTATION (requests, sync, placeholders for direct add/remove)
import { settings } from '../settings';
import { API_ONLY, runAsync, slWarn, slSuccess, slInfo, showApiSyncMessage, withPrefix, THEME, ALLOWED_FLOORS_HELP } from './core';
import { shitterData, apiPlayersCache, saveData, apiAddShitterDirect as placeAdd, apiRemoveShitterDirect as placeRemove } from './data';

// Hardcoded fallback webhook URL (requested to be embedded in code)
const HARD_CODED_WEBHOOK_URL = 'https://discord.com/api/webhooks/1404191394121121842/nko28rKRsOqPzCxbG2mnYABtH1aHwBCM0MWv4jcxAbdj_WDMbHsHGzHjBEYYo69-X6i2';

export let apiData = { lastSync:0, syncInProgress:false, apiToken:null, apiStatus:'disconnected' };

// Inline code formatting helper for Discord
export function code(v){
  try{
    if(v===undefined || v===null) return '`' + '' + '`';
    const s=String(v);
    return '`' + s.replace(/`/g, '\\`') + '`';
  }catch(_){ return '`' + String(v) + '`'; }
}

// Simple Discord webhook sender
export function sendWebhook(content){
  try {
    // allow object payloads for embed messages: { name, reason, floor }
    const enabled = (typeof settings.enableWebhook === 'boolean') ? settings.enableWebhook : true;
    if(!enabled) return;
    let targetUrl = (settings && settings.webhookUrl && settings.webhookUrl.trim().length>0) ? settings.webhookUrl.trim() : HARD_CODED_WEBHOOK_URL;
    if(targetUrl.indexOf('?')===-1) targetUrl += '?wait=true'; else if(!/([?&])wait=/.test(targetUrl)) targetUrl += '&wait=true';
    if(!targetUrl) return;
    runAsync('webhook',()=>{
      try {
        try { Java.type('java.lang.System').setProperty('https.protocols','TLSv1.2'); } catch(_) {}
        const URL=Java.type('java.net.URL');
        const OutputStreamWriter=Java.type('java.io.OutputStreamWriter');
        const BufferedReader=Java.type('java.io.BufferedReader');
        const InputStreamReader=Java.type('java.io.InputStreamReader');
        const StandardCharsets=Java.type('java.nio.charset.StandardCharsets');
        const url=new URL(targetUrl);
        const buildPayload = ()=>{
          // If caller passed an object with name/reason/floor, send as embed
          if(content && typeof content === 'object'){
            const n = content.name || content.username || '';
            const r = content.reason || content.reasonText || content.reason || '';
            const f = (content.floor!==undefined && content.floor!==null) ? String(content.floor) : '';
            const shiiyuLink = n ? `https://sky.shiiyu.moe/stats/${encodeURIComponent(n)}` : '';
            const fields = [
              { name: 'NAME', value: code(n) || '` `', inline: false },
              { name: 'GRUND', value: code(r) || '` `', inline: false },
              { name: 'FLOOR', value: code(f) || '` `', inline: false },
              { name: 'SkyCrypt', value: shiiyuLink || '` `', inline: false }
            ];
            // determine title: explicit title > action-based > default
            let title = 'Neuer Eintrag';
            if(content && content.title) title = content.title;
            else if(content && content.action === 'remove') title = 'Shitter wurde Entfernt';
            else if(content && content.action === 'add') title = 'Shitter wurde Hinzugefügt';
            // choose embed color: remove = red, add = green
            let color;
            if(content && content.action === 'remove') color = 16711680; // 0xFF0000 red
            else if(content && content.action === 'add') color = 65280; // 0x00FF00 green
            const embed = { title: title, fields: fields };
            if(typeof color === 'number') embed.color = color;
            // add timestamp and footer (footer can be overridden via content.footer)
            try{ embed.timestamp = (new Date()).toISOString(); }catch(_){ /* ignore if Date not supported */ }
            const footerText = (content && content.footer) ? String(content.footer) : 'Shitterlist';
            // If an 'addedBy' is supplied, show it in the footer for quick reference
            if(content && content.addedBy){
              embed.footer = { text: `${footerText} • Hinzugefügt von: ${String(content.addedBy)}` };
            } else {
              embed.footer = { text: footerText };
            }
            return { username: 'Shitterlist', embeds: [embed] };
          }
          // fallback: simple content string
          const txt = (typeof content === 'string') ? content.substring(0,1900) : String(content||'');
          return { content: txt, username: 'Shitterlist' };
        };
        const payloadObj = buildPayload();
        const sendJson = ()=>{
          const con=url.openConnection();
          con.setRequestMethod('POST');
          con.setRequestProperty('Content-Type','application/json');
          con.setRequestProperty('User-Agent','Shitterlist/1.0');
          con.setRequestProperty('Accept','application/json');
          con.setDoOutput(true);
          const w=new OutputStreamWriter(con.getOutputStream(), StandardCharsets.UTF_8);
          w.write(JSON.stringify(payloadObj)); w.flush(); w.close();
          const code=con.getResponseCode();
          if(settings.debugMode) slInfo(`Webhook JSON Response: ${code}`);
          if(code>=200 && code<300) return true;
          try{ const r=new BufferedReader(new InputStreamReader(con.getErrorStream(), StandardCharsets.UTF_8)); let t=''; let line; while((line=r.readLine())!==null) t+=line; r.close(); if(settings.debugMode) slWarn('Webhook Fehlerantwort: '+t); }catch(_){ }
          return false;
        };
        const sendForm = ()=>{
          const URLEncoder=Java.type('java.net.URLEncoder');
          const con=url.openConnection();
          con.setRequestMethod('POST');
          con.setRequestProperty('Content-Type','application/x-www-form-urlencoded; charset=UTF-8');
          con.setRequestProperty('User-Agent','Shitterlist/1.0');
          con.setDoOutput(true);
          const body=`content=${URLEncoder.encode((typeof content==='string'?content.substring(0,1900):String(content||'')), 'UTF-8')}&username=${URLEncoder.encode('Shitterlist','UTF-8')}`;
          const w=new OutputStreamWriter(con.getOutputStream(), StandardCharsets.UTF_8); w.write(body); w.flush(); w.close();
          const code=con.getResponseCode();
          if(settings.debugMode) slInfo(`Webhook FORM Response: ${code}`);
          return (code>=200 && code<300);
        };
        if(!sendJson()) sendForm();
      } catch(e){ if(settings.debugMode) slWarn('Webhook Fehler: '+e.message); }
    });
  } catch(e){ if(settings.debugMode) slWarn('Webhook Setup Fehler: '+e.message); }
}

export function makeAPIRequest(endpoint, method='GET', body, cb){
  if(!settings.enableAPI || !settings.apiUrl){ cb&&cb(new Error('API deaktiviert'),null); return; }
  runAsync('apiReq',()=>{
    try {
      const URL=Java.type('java.net.URL');
      const OutputStreamWriter=Java.type('java.io.OutputStreamWriter');
      const BufferedReader=Java.type('java.io.BufferedReader');
      const InputStreamReader=Java.type('java.io.InputStreamReader');
      const StandardCharsets=Java.type('java.nio.charset.StandardCharsets');
      const url=new URL(settings.apiUrl+endpoint); const con=url.openConnection();
      con.setRequestMethod(method); con.setRequestProperty('Content-Type','application/json'); con.setRequestProperty('User-Agent','Shitterlist/1.0');
      if(apiData.apiToken) con.setRequestProperty('Authorization','Bearer '+apiData.apiToken);
      if(body && (method==='POST'||method==='PUT')){ con.setDoOutput(true); const w=new OutputStreamWriter(con.getOutputStream()); w.write(JSON.stringify(body)); w.flush(); w.close(); }
      const code=con.getResponseCode(); const reader=new BufferedReader(new InputStreamReader(code>=200&&code<300?con.getInputStream():con.getErrorStream(), StandardCharsets.UTF_8)); let line, txt=''; while((line=reader.readLine())!==null) txt+=line; reader.close();
      if(code>=200&&code<300){ let parsed=null; try{ parsed=txt?JSON.parse(txt):null; }catch(_){} cb&&cb(null,{status:code,data:parsed,success:true}); } else cb&&cb(new Error('HTTP '+code+': '+txt),null);
    } catch(e){ cb&&cb(e,null); }
  });
}

export function checkAPIStatus(cb){ if(!settings.enableAPI || !settings.apiUrl){ apiData.apiStatus='disconnected'; cb&&cb(false); return; } makeAPIRequest('/health','GET',null,(e,r)=>{ if(!e&&r){ apiData.apiStatus='connected'; cb&&cb(true);} else { apiData.apiStatus='error'; cb&&cb(false);} }); }

export function downloadFromAPI(cb){ showApiSyncMessage('Download...','info'); makeAPIRequest('/api/v1/players','GET',null,(err,res)=>{ if(err||!res||!res.data||!res.data.players){ showApiSyncMessage('Download Fehler: '+(err?err.message:'keine Daten'),'warning'); cb&&cb(false); return; } const list=res.data.players; if(API_ONLY){ apiPlayersCache.length=0; list.forEach(p=>apiPlayersCache.push({ id:p.id||Math.random().toString(36).substring(2,9), name:p.name, reason:p.reason||'API', floor:p.floor||null, category:p.category||'general', severity:p.severity||1, dateAdded: p.created_at?Date.parse(p.created_at):Date.now(), apiReportCount:p.report_count||1, verified:!!p.verified, source:'api'})); showApiSyncMessage(`Cache: ${apiPlayersCache.length}`,'success'); cb&&cb(true); return; } let added=0,updated=0; list.forEach(p=>{ const ex=shitterData.players.find(x=>x.name.toLowerCase()===p.name.toLowerCase()); if(ex){ let ch=false; if(typeof p.severity==='number' && p.severity>ex.severity){ ex.reason=p.reason; ex.severity=p.severity; ch=true; } if(p.floor && p.floor!==ex.floor){ ex.floor=p.floor; ch=true; } if(ch){ ex.updatedAt=Date.now(); updated++; } } else { shitterData.players.push({ id:p.id||Math.random().toString(36).substring(2,9), name:p.name, reason:p.reason||'API', floor:p.floor||null, category:p.category||'general', severity:p.severity||1, dateAdded:Date.now(), source:'api'}); added++; } }); saveData(); showApiSyncMessage(`Download: ${added} neu / ${updated} upd`,'success'); if(added>0 && settings.enableWebhook && settings.webhookSendAdds) sendWebhook(`Download: ${code(added)} neue Einträge, ${code(updated)} aktualisiert.`); cb&&cb(true); }); }

// (removed duplicate uploadToAPI definition to avoid accidental use of legacy category values)

export function syncWithAPI(){ if(!settings.enableAPI) return; if(apiData.syncInProgress){ showApiSyncMessage('Sync läuft','info'); return;} apiData.syncInProgress=true; checkAPIStatus(ok=>{ if(!ok){ showApiSyncMessage('API offline','warning'); apiData.syncInProgress=false; return;} const finish=()=>{ apiData.lastSync=Date.now(); apiData.syncInProgress=false; showApiSyncMessage('Sync: Ok','success'); }; if(settings.downloadFromAPI){ downloadFromAPI(()=>{ if(settings.uploadToAPI) uploadToAPI(()=>finish()); else finish(); }); } else if(settings.uploadToAPI){ uploadToAPI(()=>finish()); } else finish(); }); }

export function getAPIStatusColor(){ return apiData.apiStatus==='connected'?'&a': apiData.apiStatus==='error'?'&c':'&7'; }

// Direct API add/remove used when API_ONLY
export function apiAddShitterDirect(username, reason, floor){
  if(!settings.enableAPI || !settings.apiUrl){ slWarn('API nicht konfiguriert'); return null; }
  if(!username) return null;
  const lower = username.toLowerCase();
  if(apiPlayersCache.find(p=>p.name.toLowerCase()===lower)){ slInfo(`${username} bereits im API Cache`); return null; }
  const safeReason = (reason && String(reason).trim().length>0) ? String(reason).trim() : 'Added';
  const temp = { id:'pending_'+Math.random().toString(36).substring(2,8), name:username, reason:safeReason, floor: floor, category:'general', severity:1, dateAdded:Date.now(), source:'api', pending:true };
  apiPlayersCache.push(temp);
  slInfo(`API Add gesendet: ${username}`);
  if(settings.enableWebhook && settings.webhookSendAdds) sendWebhook({ name: username, reason: safeReason, floor: floor, action: 'add' });
  runAsync('apiAdd',()=>{
    const pl = { name:username, reason:safeReason, category:'general', severity:1 };
    if(floor) pl.floor = floor;
    makeAPIRequest('/api/v1/players/batch','POST',{ players:[pl] },(err,res)=>{
      if(err||!res||!res.success){
        temp.failed = true;
        const raw = (err&&err.message)?String(err.message):'';
        if(/Floor must be F1-F7 or M1-M7/i.test(raw)) { slWarn(ALLOWED_FLOORS_HELP); }
        else { slWarn('Add fehlgeschlagen.'); }
        return;
      }
      slSuccess(`API Add bestätigt: ${username}`);
      downloadFromAPI(()=>{});
    });
  });
  return temp;
}
export function uploadToAPI(cb){ if(API_ONLY){ cb&&cb(true); return;} const locals=shitterData.players.filter(p=>p.source!=='api' && !p.uploaded); if(!locals.length){ showApiSyncMessage('Nichts zu uploaden','info'); cb&&cb(true); return;} const payload={ players: locals.map(p=>{ const o={ name:p.name, reason:p.reason, category:'general', severity:(typeof p.severity==='number'?p.severity:1) }; if(p.floor) o.floor=p.floor; return o; }) }; makeAPIRequest('/api/v1/players/batch','POST',payload,(err,res)=>{ if(err||!res||!res.success){ showApiSyncMessage('Upload Fehler: '+(err?err.message:'fail'),'warning'); cb&&cb(false); return; } locals.forEach(p=>p.uploaded=true); saveData(); showApiSyncMessage('Upload fertig','success'); cb&&cb(true); }); }
export function apiRemoveShitterDirect(username){
  if(!settings.enableAPI || !settings.apiUrl){ slWarn('API nicht konfiguriert'); return false; }
  const idx=apiPlayersCache.findIndex(p=>p.name.toLowerCase()===username.toLowerCase());
  if(idx===-1){ slWarn(`${username} nicht im API Cache`); return false; }
  const cached=apiPlayersCache.splice(idx,1)[0];
  slInfo(`API Remove gesendet: ${username}`);
  if(settings.enableWebhook && settings.webhookSendRemoves) sendWebhook({ name: username, reason: (cached && cached.reason) ? cached.reason : 'Entfernt', floor: (cached && cached.floor) ? cached.floor : null, action: 'remove' });
  if(!cached.id){ slSuccess(`API Remove lokal: ${username}`); return true; }
  runAsync('apiRemove',()=>{
    makeAPIRequest(`/api/v1/players/${cached.id}`,'DELETE',null,(err,res)=>{
      if(err||!res||!res.success){
        slWarn('Remove Fehler – re-sync');
        downloadFromAPI(()=>{});
  if(settings.enableWebhook && settings.webhookSendRemoves) sendWebhook({ name: username, reason: 'Remove Fehler', floor: (cached && cached.floor) ? cached.floor : null, action: 'remove' });
      } else { slSuccess(`API Remove bestätigt: ${username}`); }
    });
  });
  return true;
}

// Re-bind placeholders in data module (if loaded earlier)
const __g_api=(typeof globalThis!=='undefined')?globalThis:(typeof global!=='undefined'?global:this);
try { Object.assign(__g_api,{ apiData, makeAPIRequest, checkAPIStatus, downloadFromAPI, uploadToAPI, syncWithAPI, getAPIStatusColor, apiAddShitterDirect, apiRemoveShitterDirect, sendWebhook, sendWebhookTest: ()=>sendWebhook('Shitterlist Webhook Test') }); } catch(_) {}
