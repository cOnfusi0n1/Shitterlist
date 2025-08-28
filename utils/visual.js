// visual.js – SINGLE IMPLEMENTATION (titles & sounds)
import { settings } from '../settings';
import { slInfo } from './core';

// Notification sound helper
export function playNotificationSound(type='warning') {
  try {
    if (type === 'warning' && settings.warningSound) World.playSound('note.pling', 1, 2);
    else if (type === 'success' && settings.successSound) World.playSound('note.pling', 1, 1.5);
  } catch (e) { if (settings.debugMode) slInfo('Sound Fehler: ' + e.message); }
}

// Custom join sound
export function playCustomJoinSound() {
  if (!settings.customJoinSoundEnabled) return;
  const evt = (settings.customJoinSoundEventName || '').trim(); if (!evt) return;
  const vol = Math.max(0, Math.min(100, settings.customJoinSoundVolume)) / 100;
  const pitch = Math.max(50, Math.min(200, settings.customJoinSoundPitch)) / 100;
  try { World.playSound(evt, vol, pitch); } catch (e) { if (settings.debugMode) slInfo('CustomSound Fehler: ' + e.message); }
}

// (Title now handled locally in party.js)

const __g_visual=(typeof globalThis!=='undefined')?globalThis:(typeof global!=='undefined'?global:this);
try { Object.assign(__g_visual, { playCustomJoinSound, playNotificationSound }); } catch(_) {}
