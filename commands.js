// commands.js – SINGLE IMPLEMENTATION
import { settings } from './settings';
import { slLog, slInfo, slWarn, showApiSyncMessage, ALLOWED_FLOORS_HELP, formatMessage, THEME } from './utils/core';
import { addShitter, removeShitter, removeShitterWithHistory, isShitter, getRandomShitter, getShitterStats, checkOnlineShitters, exportShitterlist, clearList, getActivePlayerList, getPlayerHistory } from './utils/data';
import { syncWithAPI, downloadFromAPI, uploadToAPI, getAPIStatusColor, apiData } from './utils/api';
import { performSelfUpdate, triggerManualUpdateCheck } from './updater';
import { attemptAutoKick } from './utils/party';
import { cleanPlayerName } from './utils/core';
import { getBreakdown, reclassAPIEntries } from './maintenance';

function addShitterWithCategory(username, category, reason){
  const categories={ toxic:'Toxisches Verhalten', scammer:'Scammer/Betrüger', griefer:'Griefer', cheater:'Cheater/Hacker', spammer:'Spammer', troll:'Troll', annoying:'Nerviger Spieler' };
  const full = categories[category]? (categories[category] + ': ' + reason) : (category + ': ' + reason); return addShitter(username, full);
}

// Cache the last known reason for removed players to support "silent re-add"
const lastRemovedReasons = {};

register('command', (...args)=>{
  if(!args || args.length===0){
    slLog('general','Befehle:','info');
    // Colorized help using global palette
    slHelp('/sl add <name> <grund> <floor>', 'Spieler hinzufügen');
    slHelp('/sl remove <name>', 'Spieler entfernen');
    slHelp('/sl check <name>', 'Status prüfen');
    slHelp('/sl list', 'Liste anzeigen');
    slHelp('/sl search <term>', 'In Liste suchen');
    slHelp('/sl random', 'Zufälligen Shitter anzeigen');
    slHelp('/sl stats', 'Statistiken anzeigen');
    slHelp('/sl online', 'Online Shitter prüfen');
    slHelp('/sl export', 'Liste exportieren');
    slHelp('/sl players', 'Klickbare Spielerliste');
    slHelp('/sl quick <category> <name>', 'Schnell kategorisieren');

  slInfo('== API-Befehle ==');

    slHelp('/sl sync', 'Manueller API-Sync');
    slHelp('/sl upload', 'Lokale Daten hochladen');
    slHelp('/sl download', 'API-Daten herunterladen');
    slHelp('/sl apistatus', 'API-Status prüfen');
    slHelp('/sl testdetection <name>', 'Teste Spieler-Erkennung');
    slHelp('/sl testkick <name>', 'Teste Party-Kick');
    slHelp('/sl breakdown', 'Daten-Diagnose');
    slHelp('/sl reclass', 'Re-Klassifiziere [API] Einträge');
    slHelp('/sl toggle <setting>', 'Einstellung umschalten');
    slHelp('/sl reloadgui', 'Vigilance neu laden');
    slHelp('/sl testmessage <msg>', 'Chat Detection testen');
    slHelp('/sl update-now', 'Sofort updaten');
    slHelp('/sl checkupdate', 'Update-Check');

  // Show floors help once
  slInfo(ALLOWED_FLOORS_HELP);
    return;
  }
  const sub = args[0].toLowerCase();
  switch(sub){
    case 'add':{
  if(args.length<4){ slWarn('Usage: /sl add <username> <Grund> <Floor>'); return; }
      const name = args[1];
      let floor = args[args.length-1];
      const reason = args.slice(2, args.length-1).join(' ').trim();
  if(!reason){ slWarn('Grund darf nicht leer sein!'); return; }
  // Normalize and validate floor token (F1-F7 or M1-M7)
  if(!floor || /\s/.test(floor)) { slWarn('Erlaubte Floors: F1-F7 oder M1-M7'); return; }
  floor = String(floor).toUpperCase();
  if(!/^([FM][1-7])$/.test(floor)) { slWarn('Erlaubte Floors: F1-F7 oder M1-M7'); return; }
      addShitter(name, reason, floor);
      break; }
  case 'remove': if(args.length<2){ slWarn('Usage: /sl remove <username>'); return; } removeShitter(args[1]); break;
  case 'check': if(args.length<2){ slWarn('Usage: /sl check <username>'); return;} const info=getActivePlayerList().find(p=>p.name.toLowerCase()===args[1].toLowerCase()); if(info){ slWarn(args[1] + ' ist ein Shitter'); slWarn('Grund: ' + (info.reason||'Unknown'));} else slSuccess(args[1] + ' ist nicht in der Liste'); break;
    case 'list': {
      // Build a single multi-line message with a fixed chat line ID so it gets overridden on page changes
      const LIST_CHAT_ID = 99127001;
      const list=getActivePlayerList();
      const pageSize=10; const pageArg=args[1];
      const totalPages=Math.max(1, Math.ceil(list.length/pageSize));
      let page=parseInt(pageArg||'1'); if(isNaN(page)||page<1) page=1; if(page>totalPages) page=totalPages;

      if(!list.length){
        const emptyMsg = new Message(new TextComponent(withPrefix('Keine Einträge vorhanden.','info')))
          .setChatLineId(LIST_CHAT_ID);
        ChatLib.chat(emptyMsg);
        return;
      }

  const header = THEME.header + 'Shitter ' + THEME.dim + '(' + list.length + ')  ' + THEME.dim + 'Seite ' + page + '/' + totalPages;
      const start=(page-1)*pageSize;
      const pageItems = list.slice(start,start+pageSize);

      // Compose message with clickable names that run /pv <name>
      const msg = new Message(tc(header));
      pageItems.forEach(pl => {
        const id = pl.id || '?';
  const idBtn = tc('\n' + THEME.accent + '#' + id + ' ')
          .setHover('show_text', ChatLib.addColor(THEME.warning + 'Eintrag entfernen? Bestätigung folgt.\n' + THEME.dim + 'Klick: /sl confirmremove ' + pl.name))
          .setClick('run_command', '/sl confirmremove ' + pl.name);
        msg.addTextComponent(idBtn);
  msg.addTextComponent(tc(THEME.info));
        const nameBtn = tc(THEME.brand + pl.name)
          .setHover('show_text', ChatLib.addColor(THEME.accent + 'Klicken zum Öffnen: /pv ' + pl.name))
          .setClick('run_command', '/pv ' + pl.name);
        msg.addTextComponent(nameBtn);
        // Determine floor for display: use field or parse trailing [Fx] from reason
        let floorLabel = '';
        try {
          if(pl.floor) floorLabel = String(pl.floor);
          else if(pl.reason){ const m = String(pl.reason).match(/\[(?:F|M)\d+\]$/i); if(m) floorLabel = m[0].replace(/[\[\]]/g,''); }
        } catch(_) {}
    // Suffix with reason (+ optional floor)
    const suffix = floorLabel ? (' - ' + (pl.reason||'Keine Angabe') + ' [' + floorLabel + ']') : (' - ' + (pl.reason||'Keine Angabe'));
  msg.addTextComponent(tc(THEME.dim + suffix));
      });

      // Navigation (hover + click) appended to the same message so the whole block shares one ID
      if(totalPages>1){
        try {
          const parts = [];
          if(page>1){
            parts.push(tc('\n' + THEME.accent + '[< Zurück] ')
              .setHover('show_text', ChatLib.addColor(THEME.dim + 'Vorherige Seite (' + (page-1) + '/' + totalPages + ')'))
              .setClick('run_command', '/sl list ' + (page-1)));
          } else {
            // add a newline for consistent spacing even without back button
            parts.push(new TextComponent('\n'));
          }
          if(page<totalPages){
            parts.push(tc(THEME.success + '[Weiter >]')
              .setHover('show_text', ChatLib.addColor(THEME.dim + 'Nächste Seite (' + (page+1) + '/' + totalPages + ')'))
              .setClick('run_command', '/sl list ' + (page+1)));
          }
          if(parts.length){ parts.forEach(c=>msg.addTextComponent(c)); }
  } catch(e){ if(settings.debugMode) slWarn('Nav Error: '+e.message); }
      }

  msg.setChatLineId(LIST_CHAT_ID);
  ChatLib.chat(msg);
      break;
    }
    case 'confirmremove': {
  if(args.length<2){ slWarn('Usage: /sl confirmremove <username>'); return; }
      const name=args[1];
      const entry = getActivePlayerList().find(p=>p.name.toLowerCase()===name.toLowerCase());
  if(!entry){ slWarn(name + ' nicht gefunden.'); return; }
  const m = new Message(withPrefix('Wirklich entfernen: ','warning'),
            tc('&c' + entry.name).setHover('show_text', ChatLib.addColor('Grund: &f' + (entry.reason||'Keine Angabe'))));
      m.addTextComponent(new TextComponent('  '));
      m.addTextComponent(tc('&a[Ja, entfernen]')
        .setHover('show_text', ChatLib.addColor('&cEntfernen: ' + entry.name))
        .setClick('run_command', '/sl doremove ' + entry.name));
      m.addTextComponent(new TextComponent(' '));
      m.addTextComponent(tc('&7[Abbrechen]')
        .setHover('show_text', ChatLib.addColor('&7Abbruch, keine Aktion'))
        .setClick('run_command', '/sl canceled'));
      ChatLib.chat(m);
      break;
    }
    case 'doremove': {
  if(args.length<2){ slWarn('Usage: /sl doremove <username>'); return; }
      const name=args[1];
      const lower=name.toLowerCase();
      const entry = getActivePlayerList().find(p=>p.name.toLowerCase()===lower);
  if(!entry){ slWarn(name + ' nicht gefunden.'); return; }
      // Remember reason for silent re-add
      lastRemovedReasons[lower] = entry.reason || 'Keine Angabe';
      const ok = removeShitterWithHistory(name);
      if(ok){
  const back = new Message(withPrefix('Entfernt: ' + name + '.','success'));
        back.addTextComponent(tc('&e[Wieder hinzufügen]')
          .setHover('show_text', ChatLib.addColor('&7Gleicher Grund: &f' + lastRemovedReasons[lower]))
          .setClick('run_command', '/sl readdsilently ' + name));
        ChatLib.chat(back);
      }
      break;
    }
    case 'history': {
  if(args.length<2){ slWarn('Usage: /sl history <username>'); return; }
      const name = args[1];
      const hist = getPlayerHistory(name, 25);
  if(!hist || hist.length===0){ slInfo('Keine Historie für ' + name); return; }
  slInfo('Historie für ' + name + ' (' + hist.length + '):');
  hist.forEach(h=>{ const d = new Date(h.date).toLocaleString(); slInfo('• [' + d + '] ' + h.action.toUpperCase() + (h.reason?(' - ' + h.reason):'') + (h.floor?(' [Floor ' + h.floor + ']'):'')); });
      break; }
    case 'readdsilently': {
  if(args.length<2){ withPrefix('&cUsage: /sl readdsilently <username>'); return; }
      const name=args[1];
      const lower=name.toLowerCase();
      const reason = lastRemovedReasons[lower] || 'Keine Angabe';
      // Temporarily suppress "add" webhook (affects API_ONLY path)
      const prev = settings.webhookSendAdds;
      try { settings.webhookSendAdds = false; addShitter(name, reason); } finally { settings.webhookSendAdds = prev; }
  slSuccess('Wieder hinzugefügt: ' + name + ' (' + reason + ')');
      break;
    }
    case 'canceled': { slInfo('Aktion abgebrochen.'); break; }
    case 'search': {
      if(args.length<2){ slWarn('Usage: /sl search <term>'); return;} { const term=args.slice(1).join(' '); const matches=getActivePlayerList().filter(p=>p.name.toLowerCase().includes(term.toLowerCase())|| (p.reason||'').toLowerCase().includes(term.toLowerCase())); if(!matches.length){ slWarn('Keine Treffer für "' + term + '"'); return;} slSuccess('Suchergebnisse (' + matches.length + '):'); matches.forEach(p=>slInfo('• ' + p.name + ' (' + (p.reason||'') + ')')); } break;
    }
    case 'random': getRandomShitter(); break;
    case 'stats': getShitterStats(); break;
    case 'online': checkOnlineShitters(); break;
    case 'export': exportShitterlist(); break;
  case 'quick': if(args.length<3){ withPrefix('&cUsage: /sl quick <kategorie> <name> [grund]'); return;} addShitterWithCategory(args[2], args[1].toLowerCase(), args.slice(3).join(' ')||'Keine Angabe'); break;
  case 'clear': slWarn("Wirklich alle Einträge löschen? '/sl confirmclear'"); break;
    case 'confirmclear': clearList(); break;
  case 'players': {
      try {
        const tab = TabList.getNames();
        if (tab && tab.length) {
          slInfo('Klickbare Spielerliste:');
          const my = Player.getName();
          tab.slice(0, 20).forEach(n => {
            const cn = cleanPlayerName(n);
            if (cn !== my && cn.length > 0 && !cn.includes('Players')) {
              const is = isShitter(cn);
              const hover = is ? 'VON LISTE ENTFERNEN' : 'ZUR LISTE HINZUFÜGEN (Grund+Floor anpassen)';
              const clickType = is ? 'run_command' : 'suggest_command';
              const clickCmd = is ? ('/sl remove ' + cn) : ('/sl add ' + cn + ' Grund F7');
              const comp = new Message(
                ChatLib.addColor((is ? '&c●' : '&a●') + ' '),
                tc('&f' + cn).setHover('show_text', ChatLib.addColor(hover)).setClick(clickType, clickCmd)
              );
              ChatLib.chat(comp);
            }
          });
        } else slWarn('Keine Tab-Liste verfügbar');
      } catch (e) { slWarn('Fehler: ' + e.message); }
      break;
    }
    case 'sync':
      runApiOperation(syncWithAPI, 'Starte API-Synchronisation...', 'Synchronisation abgeschlossen.');
      break;
    case 'upload':
      runApiOperation(uploadToAPI, 'Starte Upload zur API...', 'Upload abgeschlossen.');
      break;
    case 'download':
      runApiOperation(downloadFromAPI, 'Starte Download von der API...', 'Download abgeschlossen.');
      break;
    case 'apistatus': {
  slInfo('API-Status:');
  slInfo('URL: ' + (settings.apiUrl || 'Nicht gesetzt'));
  const statusVal = (apiData && (apiData.status || apiData.apiStatus)) || 'Unbekannt';
      let color = '&7';
      try {
        const c = typeof getAPIStatusColor === 'function' ? (getAPIStatusColor(statusVal) || getAPIStatusColor()) : null;
        if (typeof c === 'string' && c.length > 0) color = c;
      } catch (_) {}
  slInfo('Status: ' + color + statusVal);
      // Optional metadata if exposed by utils/api
      try {
        const lastSync = apiData && (apiData.lastSync || apiData.lastSyncAt || apiData.lastCheckedAt);
        const lastUp = apiData && (apiData.lastUpload || apiData.lastUploadAt);
        const lastDown = apiData && (apiData.lastDownload || apiData.lastDownloadAt);

  if (lastSync) slInfo('Letzter Sync: ' + new Date(lastSync).toLocaleString());
  if (lastUp) slInfo('Letzter Upload: ' + new Date(lastUp).toLocaleString());
  if (lastDown) slInfo('Letzter Download: ' + new Date(lastDown).toLocaleString());
      } catch (_) {
        // ignore date formatting errors
      }
      break;
    }
    case 'breakdown': {
      const bd=getBreakdown();
      slInfo('Zähl-Diagnose:');
  slInfo('Gesamt: ' + bd.total);
  slInfo('API: ' + bd.api + ' | Lokal: ' + bd.local);
  if (bd.duplicates.length > 0) slWarn('Duplikate (' + bd.duplicates.length + '): ' + bd.duplicates.join(', '));
  else slInfo('Duplikate: Keine');
  if (bd.mismatch && settings.debugMode) slInfo('Hinweis: ' + bd.apiByReason + ' Einträge haben [API]-Reason aber nur ' + bd.apiBySource + ' source=api');
      break;
    }
  case 'reclass': { const changed = reclassAPIEntries(); if (changed > 0) slSuccess(String(changed) + ' Einträge reklassifiziert.'); else slInfo('Keine Änderungen.'); break; }
  case 'toggle': { if(args.length<2){ slWarn('Usage: /sl toggle <setting>'); slInfo('enabled, debug, joinwarnings, party, dungeon, title, sound, autopartykick, api, autoinstall'); return;} const setting=args[1].toLowerCase(); const map={ enabled:'enabled', debug:'debugMode', debugmode:'debugMode', joinwarnings:'showJoinWarnings', showjoinwarnings:'showJoinWarnings', party:'partyWarnings', partywarnings:'partyWarnings', dungeon:'dungeonWarnings', dungeonwarnings:'dungeonWarnings', title:'showTitleWarning', titlewarning:'showTitleWarning', showtitlewarning:'showTitleWarning', sound:'warningSound', warningsound:'warningSound', autopartykick:'autoPartyKick', partkick:'autoPartyKick', api:'enableAPI', enableapi:'enableAPI', autoinstall:'autoInstallUpdates', autoinstallupdates:'autoInstallUpdates' }; const key=map[setting]; if(!key){ slWarn('Unbekannte Einstellung: '+setting); break; } settings[key]=!settings[key]; slSuccess(`${key} => ${(settings[key]?'An':'Aus')}`); break; }
  case 'reloadgui': case 'reloadsettings': { slInfo('Reload der Vigilance Settings...'); try { ChatLib.command('ct load', true); slSuccess('Module neu geladen! Verwende /slconfig'); } catch(e){ slWarn('Reload fehlgeschlagen: '+e.message);} break; }
  case 'testmessage': { if(args.length<2){ slWarn('Usage: /sl testmessage <message>'); return;} const testMsg=args.slice(1).join(' '); slInfo('=== TEST MESSAGE ==='); if(testMsg.includes('joined the dungeon group!') && settings.dungeonWarnings){ const m=testMsg.match(/^(.+?) joined the dungeon group!/); if(m){ const name=m[1].trim().replace(/^Party Finder > /,''); slInfo(`Simulierter Spieler: ${name}`); slInfo(isShitter(name)?'Wäre erkannt worden':'Nicht erkannt'); } else slInfo('Kein Pattern erkannt'); } else slInfo('Kein Dungeon-Pattern oder deaktiviert'); break; }
  case 'testdetection': if(args.length<2){ slWarn('Usage: /sl testdetection <name>'); return;} const testU=args[1]; slInfo('=== TEST DETECTION ==='); slInfo(`Testing username: ${testU}`); slInfo(`isShitter: ${isShitter(testU)}`); break;
  case 'testkick': if(args.length<2){ withPrefix('&cUsage: /sl testkick <name>'); return;} attemptAutoKick(args[1], 'Test', 'party'); break;
    case 'update-now': performSelfUpdate(true); break;
    case 'checkupdate': triggerManualUpdateCheck(); break;
  default: slWarn('Unbekannter Befehl. /sl');
  }
}).setName('shitterlist').setAliases('sl');

// Keep GUI command, no THEME needed
register('command', ()=>{
  try{
    if(settings && typeof settings.openGUI === 'function'){
      settings.openGUI();
      return;
    }
    // Fallback: helpful message if Vigilance integration not available
    ChatLib.chat(withPrefix('GUI konnte nicht geöffnet werden. Versuche `/sl reloadgui` um die Einstellungen neu zu laden.','warning'));
  }catch(e){
    ChatLib.chat(withPrefix('Fehler beim Öffnen der GUI: ' + (e && e.message ? e.message : String(e)), 'warning'));
  }
}).setName('slconfig').setAliases('shitterlistconfig','slgui');
register('command',()=>{ ChatLib.chat(withPrefix('Modul ist geladen und funktionsfähig!','success')); ChatLib.chat(withPrefix('Verwende /slconfig für Settings','info')); }).setName('sltest');

// === Global Shitterlist color palette and helpers ===
const SL_COLORS = {
  prefix: '&8[&6Shitterlist&8]&r ',
  info: '&7',
  success: '&a',
  warning: '&6',
  error: '&c'
};

// Note: prefix normalization is handled centrally in utils/core.js (formatMessage/slPrefix)

// Delegate withPrefix to core.formatMessage for consistent prefixing
function withPrefix(msg, type = 'info') {
  return formatMessage(msg, type);
}
// Helper to build a TextComponent with colors applied
function tc(text) {
  return new TextComponent(ChatLib.addColor(String(text)));
}
// Helper for colorized help lines
function slHelp(cmd, desc) {
  ChatLib.chat(ChatLib.addColor(`&b${cmd} &8- &7${desc}`));
}

// Helper: Run API operation (supports both callback-based and Promise-based utils/api functions)
function runApiOperation(opFn, startMsg, doneMsg) {
  if (!settings.enableAPI) {
  withPrefix('&cAPI ist nicht aktiviert');
    return;
  }
  if (startMsg) showApiSyncMessage(startMsg, 'info');

  try {
    let settled = false;
    const cb = (...cbArgs) => {
      settled = true;
      if (doneMsg) showApiSyncMessage(doneMsg, 'success');
      if (cbArgs && cbArgs.length) {
        const msg = cbArgs.filter(Boolean).map(String).join(' ');
        if (msg) slInfo('API', msg);
      }
    };

    const ret = opFn(cb);

    if (ret && typeof ret.then === 'function') {
      ret
        .then((res) => {
          if (doneMsg) showApiSyncMessage(doneMsg, 'success');
          if (res && typeof res === 'object') {
            const info = res.message || res.statusText || '';
            if (info) slInfo('API', String(info));
          }
        })
        .catch((err) => {
          const msg = (err && (err.message || err.statusText)) || String(err || 'Unbekannter Fehler');
          slWarn('API', `Fehler: ${msg}`);
        });
    } else {
      if (!settled && !doneMsg) slInfo('API', 'Vorgang gestartet.');
    }
  } catch (e) {
    slWarn('API', `Fehler: ${e && e.message ? e.message : String(e)}`);
  }
}