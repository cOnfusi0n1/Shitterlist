// bonzo.js – listens for Bonzo's mask save message and responds in party chat
import { settings } from '../settings';
import { safeCommand } from './core';

// Simple duplicate suppression: don't reply more than once per 2000ms for identical messages
const lastSeen = { ts: 0 };

function now(){ return Date.now(); }

// Regex trigger to watch for (without formatting codes).
// Accepts small spacing variations and is case-insensitive.
const TRIGGER_RE = /^Your\s+⚚\s*Bonzo's Mask\s+saved your life!?$/i;

register('chat', (raw) => {
  try{
  if(!settings || settings.enabled === false) return;
  if(typeof settings.bonzoResponder !== 'undefined' && !settings.bonzoResponder) return;
    // Normalize text: strip formatting color codes
    let text = '';
    if(typeof raw === 'string') text = raw;
    else if(raw && typeof raw.getTextComponents === 'function'){
      const tcs = raw.getTextComponents();
      for(let i=0;i<tcs.length;i++){
        try{ if(typeof tcs[i].getText === 'function') text += tcs[i].getText(); else text += String(tcs[i]); }catch(_){ text += String(tcs[i]); }
      }
    } else text = String(raw);
    const plain = text.replace(/§[0-9a-fk-or]/gi,'').trim();
  if(!TRIGGER_RE.test(plain)) return;
    // Debounce identical triggers for 2s
    const nowTs = now();
    if(lastSeen.ts && (nowTs - lastSeen.ts) < 2000) return;
    lastSeen.ts = nowTs;
    // Send party chat message
    safeCommand('pc Bonzo Procced');
  }catch(e){ if(settings && settings.debugMode) ChatLib.chat('&c[bonzo] Error: ' + e); }
}).setCriteria('${raw}');

// EOF
