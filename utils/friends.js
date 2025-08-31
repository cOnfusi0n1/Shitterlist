// friends.js — Friend notes: storage, commands and chat augmentation
import { settings } from '../settings';
import { slInfo, slWarn, slSuccess, THEME, withPrefix } from './core';

const NOTES_FILE = '.friend_notes.json';
let notes = {};

function loadNotes(){
  try{ const raw = FileLib.read('Shitterlist', NOTES_FILE); notes = raw?JSON.parse(raw):{}; }catch(e){ notes = {}; }
}
function saveNotes(){
  try{ FileLib.write('Shitterlist', NOTES_FILE, JSON.stringify(notes, null, 2)); }catch(e){ if(settings.debugMode) slWarn('Notes save failed: '+e.message); }
}

function key(name){ return String(name||'').toLowerCase(); }
export function getNote(name){ return notes[key(name)] || null; }
export function setNote(name, text){ if(!name) return false; notes[key(name)] = String(text||'').trim(); saveNotes(); return true; }
export function delNote(name){ if(!name) return false; const k=key(name); if(!(k in notes)) return false; delete notes[k]; saveNotes(); return true; }
export function listNotes(){ return Object.keys(notes).map(n=>({ name:n, note: notes[n] })); }

// Helper to create colored TextComponent
function tc(text){ return new TextComponent(ChatLib.addColor(String(text))); }

// Strip Minecraft color codes and invisible whitespace
function stripFormatting(s){ try{ return String(s||'').replace(/\u00A7[0-9a-fk-or]/gi,'').replace(/[\u0000-\u001F]/g,'').trim(); }catch(_){ return String(s||'').replace(/\u00A7[0-9a-fk-or]/gi,'').trim(); } }

// Try to extract the actual username from a display string: pick the longest alnum/_ token
function normalizePlayerName(s){ const cleaned = stripFormatting(s); const matches = cleaned.match(/[A-Za-z0-9_]{1,16}/g); if(!matches || !matches.length) return cleaned; // fallback
  // choose the longest candidate (usually the username)
  let best = matches[0]; for(let m of matches){ if(m.length>best.length) best=m; }
  return best;
}

// Local help helper (uses THEME colors)
function slHelp(cmd, desc){ ChatLib.chat(ChatLib.addColor(`${THEME.brand}${cmd} ${THEME.dim}- ${desc}`)); }

// Load at init
loadNotes();

// Debug helper: if debugMode is on, log any incoming line that looks like a friend entry
register('chat', (raw,event)=>{
  try{
    if(!settings.debugMode) return;
    let text='';
    try{
      if(typeof raw === 'string') text = raw;
      else if(raw && typeof raw.getTextComponents==='function'){
        const tcs = raw.getTextComponents(); for(let i=0;i<tcs.length;i++){ try{ if(typeof tcs[i].getText==='function') text+=tcs[i].getText(); else text+=String(tcs[i]); }catch(_){ text+=String(tcs[i]); } }
      } else text = String(raw);
    }catch(_){ text = String(raw); }
    const plain = text.replace(/\u00A7[0-9a-fk-or]/gi,'').trim();
    if(plain.match(/\bis in\b/i) || plain.match(/\bis currently offline\b/i)) slInfo(`[FriendDbg] ${plain}`);
  }catch(_){ }
});

// --- Commands: /flnote add|rm|view|list ---
register('command', (...args)=>{
  try{
    const sub = (args&&args.length)?String(args[0]).toLowerCase():'help';
    if(sub==='add'){
      if(args.length<3){ withPrefix('&cUsage: /flnote add <name> <note>'); return; }
      const name = args[1]; const note = args.slice(2).join(' ');
      if(!note || note.trim().length===0){ slWarn('Note darf nicht leer sein'); return; }
      setNote(name, note);
      slSuccess(`Note gespeichert für ${name}`);
      return;
    }
    if(sub==='rm' || sub==='del'){
      if(args.length<2){ withPrefix('&cUsage: /flnote rm <name>'); return; }
      const name = args[1]; if(delNote(name)) slSuccess(`Note entfernt: ${name}`); else slWarn(`Keine Note für ${name}`);
      return;
    }
    if(sub==='view'){
      if(args.length<2){ withPrefix('&cUsage: /flnote view <name>'); return; }
      const name = args[1]; const n = getNote(name); if(n) slInfo(`${name}: ${n}`); else slWarn(`Keine Note für ${name}`); return;
    }
    if(sub==='list'){
      const all = listNotes(); if(!all.length){ slInfo('Keine Friend Notes'); return; }
      slInfo(`Friend Notes (${all.length}):`); all.slice(0,50).forEach(e=>slInfo(`• ${e.name}: ${e.note}`)); return;
    }
    if(sub==='scan' || sub==='showfl'){
      // Send /fl and collect the next few seconds of chat to display augmented friend list reliably
      slInfo('Scanne Freundesliste... Bitte warte ein paar Sekunden');
      const collected=[]; const start=Date.now();
      const h = register('chat', (raw,ev)=>{
        try{
          let text='';
          if(typeof raw==='string') text=raw;
          else if(raw && typeof raw.getTextComponents==='function'){
            const tcs=raw.getTextComponents(); for(let i=0;i<tcs.length;i++){ try{ if(typeof tcs[i].getText==='function') text+=tcs[i].getText(); else text+=String(tcs[i]); }catch(_){ text+=String(tcs[i]); } }
          } else text=String(raw);
          const plain = text.replace(/\u00A7[0-9a-fk-or]/gi,'').trim();
          if(!plain) return;
          if(plain.match(/\bis in\b/i) || plain.match(/\bis currently offline\b/i)) collected.push(plain);
        }catch(_){ }
      });
      ChatLib.command('fl', true);
      // stop collecting after 3500ms and display
      setTimeout(()=>{ try{ h.unregister(); if(!collected.length){ slWarn('Keine Friend‑Zeilen empfangen'); return; } slInfo('Friend List (augmented):'); collected.forEach(line=>{
            const inMatch = line.match(/^\s*(.+?)\s+is in\s+(.+)$/i);
            const offMatch = line.match(/^\s*(.+?)\s+is currently offline\s*$/i);
            const player = inMatch?inMatch[1]:offMatch[1]; const rest = inMatch?inMatch[2]:'is currently offline';
            const norm = normalizePlayerName(player); const note = getNote(norm);
            const out = `${player} ${rest}${note? ` [Note: ${note}]` : ''}`;
            slInfo(out);
      }); }catch(e){ slWarn('Scan Fehler: '+e.message); } },3500);
      return;
    }
    // help
    slInfo('Friend Notes Commands:');
    slHelp('/flnote add <name> <note>', 'Add/overwrite note');
    slHelp('/flnote rm <name>', 'Remove note');
    slHelp('/flnote view <name>', 'View note');
    slHelp('/flnote list', 'List notes');
  }catch(e){ slWarn('flnote Fehler: '+e.message); }
}).setName('flnote');

// --- Friend list detection ---
let _lastFriendHeader = 0;
// header example: "Friends (Page 1 of 2) >>"
// Header variants: match several common formats Hypixel may use
register('chat', (page,of,event)=>{ try{ _lastFriendHeader = Date.now(); }catch(_){} }).setCriteria('Friends (Page ${page} of ${of}) >>');
register('chat', (page,of,event)=>{ try{ _lastFriendHeader = Date.now(); }catch(_){} }).setCriteria('<< Friends (Page ${page} of ${of}) >>');
register('chat', (page,of,event)=>{ try{ _lastFriendHeader = Date.now(); }catch(_){} }).setCriteria('<< Friends (Page ${page} of ${of})');
register('chat', (page,of,event)=>{ try{ _lastFriendHeader = Date.now(); }catch(_){} }).setCriteria('Friends (Page ${page} of ${of})');

// Pattern: "<player> is in <rest>"
register('chat', (player,rest,event)=>{
  try{
    if(Date.now() - _lastFriendHeader > 5000) return; // only treat lines following a Friends header
    // Cancel original and replace, appending note visibly after the name (no hover)
    cancel(event);
    const norm = normalizePlayerName(player);
    const note = getNote(norm);
    const nameComp = tc(`${THEME.brand}${player}`)
      .setClick('run_command', `/pv ${norm}`);
    const msg = new Message(nameComp);
    const restComp = new TextComponent(ChatLib.addColor(' '+THEME.dim+rest));
    msg.addTextComponent(restComp);
    if(note){
      const noteComp = tc(' '+THEME.dim+`[${THEME.accent}Note${THEME.dim}: ${note}]`);
      msg.addTextComponent(noteComp);
    }
    ChatLib.chat(msg);
  }catch(e){ if(settings.debugMode) slWarn('Friend augment error: '+e.message); }
}).setCriteria('${player} is in ${rest}');

// Pattern: "<player> is currently offline"
register('chat', (player,event)=>{
  try{
    if(Date.now() - _lastFriendHeader > 5000) return;
    // Cancel original and replace, append note visibly after the name (no hover)
    cancel(event);
    const norm = normalizePlayerName(player);
    const note = getNote(norm);
    const nameComp = tc(`${THEME.brand}${player}`)
      .setClick('run_command', `/pv ${norm}`);
    const msg = new Message(nameComp);
    const restComp = tc(' '+THEME.warning+'is currently offline');
    msg.addTextComponent(restComp);
    if(note){
      const noteComp = tc(' '+THEME.dim+`[${THEME.accent}Note${THEME.dim}: ${note}]`);
      msg.addTextComponent(noteComp);
    }
    ChatLib.chat(msg);
  }catch(e){ if(settings.debugMode) slWarn('Friend offline augment error: '+e.message); }
}).setCriteria('${player} is currently offline');

// Export helpers for other modules
try{ const __g=(typeof globalThis!=='undefined')?globalThis:(typeof global!=='undefined'?global:this); Object.assign(__g,{ getFriendNote:getNote, setFriendNote:setNote, delFriendNote:delNote, listFriendNotes:listNotes }); }catch(_){ }

// Fallback: catch messages that weren't matched by criteria (various formats) and try to augment friend lines
// Robust fallback: handle different register('chat') signatures (msg, msg+event, event)
register('chat', (...args)=>{
  try{
    let event = null; let raw = null;
    if(args.length===1){ // could be event or raw string
      const a = args[0];
      if(a && typeof a.getMessage==='function'){ event = a; raw = a.getMessage(); }
      else raw = a;
    } else if(args.length>=2){ raw = args[0]; event = args[1]; }

    if(!raw) return;

    // build plain text from raw which may be a Message-like object or string
    let parts = [];
    try{
      if(typeof raw === 'string') parts.push(raw);
      else if(raw && typeof raw.getTextComponents==='function'){
        const tcs = raw.getTextComponents();
        for(let i=0;i<tcs.length;i++){ const c=tcs[i]; try{ if(typeof c.getText==='function') parts.push(c.getText()); else if(typeof c.getString==='function') parts.push(c.getString()); else parts.push(String(c)); }catch(_){ parts.push(String(c)); } }
      } else if(raw && typeof raw.getSiblings==='function'){
        const tcs = raw.getSiblings(); for(let i=0;i<tcs.length;i++){ parts.push(String(tcs[i])); }
      } else {
        parts.push(String(raw));
      }
    }catch(_){ parts.push(String(raw)); }

    const plain = parts.join('').replace(/\u00A7[0-9a-fk-or]/gi,'').trim();
    if(!plain) return;
    if(plain.length>200) return; // avoid huge lines

    const inMatch = plain.match(/^\s*(.+?)\s+is in\s+(.+)$/i);
    const offMatch = plain.match(/^\s*(.+?)\s+is currently offline\s*$/i);
    if(!inMatch && !offMatch) return;

    // matched a friend line
    const playerDisplay = inMatch?inMatch[1]:offMatch[1];
    const rest = inMatch?inMatch[2]:'is currently offline';
    const norm = normalizePlayerName(playerDisplay);
    const note = getNote(norm);

    if(event) try{ cancel(event); }catch(_){ }

    const nameComp = tc(`${THEME.brand}${playerDisplay}`).setClick('run_command', `/pv ${norm}`);
    const msgOut = new Message(nameComp);
    msgOut.addTextComponent(new TextComponent(ChatLib.addColor(' '+THEME.dim+rest)));
    if(note) msgOut.addTextComponent(tc(' '+THEME.dim+`[${THEME.accent}Note${THEME.dim}: ${note}]`));
    ChatLib.chat(msgOut);

    if(settings.debugMode) slInfo(`[FriendAug] fallback matched: '${playerDisplay}' -> norm='${norm}' note=${note? 'yes':'no'}`);
  }catch(e){ if(settings.debugMode) slWarn('Friend fallback error: '+e.message); }
});
