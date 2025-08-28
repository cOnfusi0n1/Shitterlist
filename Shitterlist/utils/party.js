// party.js – Minimal unified join -> check -> leader -> msg -> kick loop
import { settings } from '../settings';
import { safeCommand, sendCommandNow } from './core';
import { getActivePlayerList, isShitter as dataIsShitter } from './data';

// State for leader resolve callbacks
let partyLeader = null;
let resolving = false;
let lastLeaderAt = 0;
let leaderCbs = [];

// Tiny guards to collapse duplicate lines from the same event
const inFlight = {}; // key -> ts (per-player kick sequence guard)
const seenJoin = {}; // key -> ts (per-player recent join guard)

function now(){ return Date.now(); }

function setLeader(name){ partyLeader = name || null; lastLeaderAt = now(); }

// Local title warning (copied in lightweight form so this file is self-contained)
let lastTitleAt = 0;
function displayTitleWarningLocal(playerName, reason){
  try{
    if(settings && settings.showTitleWarning === false) return;
    const cooldownSec = (settings && settings.warningCooldown) ? settings.warningCooldown : 0;
    if(cooldownSec && (now() - lastTitleAt) < cooldownSec*1000) return;
    lastTitleAt = now();
    const title = '§c⚠ SHITTER DETECTED ⚠';
    const subtitle = `§f${playerName} §7(${reason||'Auto'})`;
    Client.showTitle(title, subtitle, 10, 80, 20);
  }catch(_){ }
}

function resolveLeader(cb){
  const me = Player.getName();
  if(partyLeader && (now() - lastLeaderAt) < 10000){ cb && cb(partyLeader); return; }
  leaderCbs.push(cb);
  if(resolving) return;
  resolving = true;
  // Fire a single /p list and wait for the leader line to arrive; fallback after 4s
  sendCommandNow('p list');
  setTimeout(()=>{
    if(!resolving) return;
    resolving = false;
    const cbs = leaderCbs.slice(); leaderCbs = [];
    cbs.forEach(fn=>{ try{ fn(partyLeader); }catch(_){} });
  }, 4000);
}

// Chat parsing for leader updates
register('chat', (raw) => {
  const line = raw.replace(/§./g,'').trim();
  const m = line.match(/^Party (?:Leader|Owner):\s+(?:\[[^\]]+\]\s*)?([A-Za-z0-9_]{1,16})\b/);
  if(m){ setLeader(m[1]); if(resolving){ const cbs=leaderCbs.slice(); leaderCbs=[]; resolving=false; cbs.forEach(fn=>{ try{ fn(partyLeader); }catch(_){} }); } return; }
  if(/^You are now the party leader\.?$/i.test(line) || /^Du bist jetzt der Partyleiter\.?$/i.test(line)){ setLeader(Player.getName()); return; }
  const p2=line.match(/promoted\s+(?:\[[^\]]+\]\s*)?([A-Za-z0-9_]{1,16})\s+to\s+(?:Party\s+)?(?:Leader|Owner)\.?$/i);
  if(p2){ setLeader(p2[1]); return; }
  const p3=line.match(/transferred\s+the\s+leadership\s+to\s+(?:\[[^\]]+\]\s*)?([A-Za-z0-9_]{1,16})\.?$/i);
  if(p3){ setLeader(p3[1]); return; }
  if(/^You are not in a party\./.test(line) || /^The party was disbanded/.test(line) || /^Du bist nicht in einer Party\./i.test(line)){
    setLeader(null);
  }
}).setCriteria('${raw}');

function findReason(name){
  const list = getActivePlayerList();
  const hit = list.find(p=>p.name.toLowerCase()===name.toLowerCase());
  return (hit && hit.reason) || 'Auto';
}

export function attemptAutoKick(playerName, reason, source='party'){
  if(!settings.autoPartyKick) return;
  const key = playerName.toLowerCase();
  // If a kick sequence is already in progress or just completed, don't start another
  if(inFlight[key] && now()-inFlight[key] < 5000) return;
  inFlight[key] = now();
  const me = Player.getName().toLowerCase();
  resolveLeader((leader)=>{
    if(!leader || leader.toLowerCase()!==me){ delete inFlight[key]; return; }
    // Sequence: msg then kick
    setTimeout(()=>{
      safeCommand(`pc Kicking ${playerName} - Reason: ${reason||'Auto'}`);
      setTimeout(()=>{ safeCommand(`p kick ${playerName}`); setTimeout(()=>{ delete inFlight[key]; }, 1200); }, 1000);
    }, 250);
  });
}

function handleJoin(player){
  const me = Player.getName().toLowerCase();
  if(!player || player.toLowerCase()===me) return;
  const key = player.toLowerCase();
  // Collapse duplicate identical lines for ~2s (party and dungeon announcements can come twice)
  if(seenJoin[key] && now()-seenJoin[key] < 2000) return;
  seenJoin[key] = now();
  // Check list
  const is = dataIsShitter(player);
  if(is){
  const reason = findReason(player);
  displayTitleWarningLocal(player, reason);
  attemptAutoKick(player, reason, 'join');
  }
}

// Join matchers (party + dungeon)
register('chat', (msg) => {
  if(settings && settings.enabled === false) return;
  const plain = msg.replace(/§[0-9a-fk-or]/g,'');
  const lower = plain.toLowerCase();
  // (name) joined your party OR joined the party
  let m = plain.match(/^(?:Party > )?(?:\[[^\]]+\]\s*)?([A-Za-z0-9_]{1,16}) (?:has )?joined (?:your|the) party[.!]$/i);
  if(m){ handleJoin(m[1]); return; }
  // (name) joined the dungeon group (with optional Party Finder > and trailing details)
  if(settings.dungeonWarnings && (lower.includes('joined the dungeon group') || lower.includes('ist der dungeongruppe beigetreten'))){
    m = plain.match(/^(?:Party Finder > )?(?:\[[^\]]+\]\s*)?([A-Za-z0-9_]{1,16}) (?:has )?joined the dungeon group/i)
      || plain.match(/^(?:Party Finder > )?(?:\[[^\]]+\]\s*)?([A-Za-z0-9_]{1,16}) ist der Dungeongruppe beigetreten/i);
    if(m){ handleJoin(m[1]); return; }
  }
}).setCriteria('${msg}');

// Expose for /sl testkick compatibility
const __g_party=(typeof globalThis!=='undefined')?globalThis:(typeof global!=='undefined'?global:this);
try { Object.assign(__g_party,{ attemptAutoKick, resolveLeader }); } catch(_) {}

// EOF