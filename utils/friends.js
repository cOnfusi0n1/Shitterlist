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

// Local help helper (uses THEME colors)
function slHelp(cmd, desc){ ChatLib.chat(ChatLib.addColor(`${THEME.brand}${cmd} ${THEME.dim}- ${desc}`)); }

// Load at init
loadNotes();

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
    const note = getNote(player);
    const nameComp = tc(`${THEME.brand}${player}`)
      .setClick('run_command', `/pv ${player}`);
    const msg = new Message(nameComp);
    if(note){
      const noteComp = tc(' '+THEME.dim+`[${THEME.accent}Note${THEME.dim}: ${note}]`);
      msg.addTextComponent(noteComp);
    }
    const restComp = new TextComponent(ChatLib.addColor(' '+THEME.dim+rest));
    msg.addTextComponent(restComp);
    ChatLib.chat(msg);
  }catch(e){ if(settings.debugMode) slWarn('Friend augment error: '+e.message); }
}).setCriteria('${player} is in ${rest}');

// Pattern: "<player> is currently offline"
register('chat', (player,event)=>{
  try{
    if(Date.now() - _lastFriendHeader > 5000) return;
    // Cancel original and replace, append note visibly after the name (no hover)
    cancel(event);
    const note = getNote(player);
    const nameComp = tc(`${THEME.brand}${player}`)
      .setClick('run_command', `/pv ${player}`);
    const msg = new Message(nameComp);
    if(note){
      const noteComp = tc(' '+THEME.dim+`[${THEME.accent}Note${THEME.dim}: ${note}]`);
      msg.addTextComponent(noteComp);
    }
    const restComp = tc(' '+THEME.warning+'is currently offline');
    msg.addTextComponent(restComp);
    ChatLib.chat(msg);
  }catch(e){ if(settings.debugMode) slWarn('Friend offline augment error: '+e.message); }
}).setCriteria('${player} is currently offline');

// Export helpers for other modules
try{ const __g=(typeof globalThis!=='undefined')?globalThis:(typeof global!=='undefined'?global:this); Object.assign(__g,{ getFriendNote:getNote, setFriendNote:setNote, delFriendNote:delNote, listFriendNotes:listNotes }); }catch(_){ }
