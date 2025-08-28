// events.js – SINGLE IMPLEMENTATION: chat filter, auto sync, cooldown cleanup, unload save
import { settings } from '../settings';
import { getActivePlayerList, loadData, saveData, shitterData } from './data';
import { syncWithAPI, apiData } from './api';
import { slInfo, formatMessage as withPrefix, THEME, runAsync } from './core';
import { triggerManualUpdateCheck, startAutoUpdater } from '../updater';

function isShitter(name){ return getActivePlayerList().some(p=>p.name.toLowerCase()===name.toLowerCase()); }

// Chat filter for standard chat pattern
register('chat',(username,message,event)=>{ if(!settings.enabled || !settings.chatFilter) return; const clean=username.replace(/§[0-9a-fk-or]/g,''); if(isShitter(clean)){ cancel(event); if(settings.debugMode) ChatLib.chat(withPrefix(`Nachricht von ${clean} gefiltert`,'warning')); } }).setCriteria('${username}: ${message}');

// Party/Dungeon join detection is handled exclusively in utils/party.js to avoid duplicates.

// Cooldown cleanup (warning cooldowns map)
let lastCooldownCleanup=0;
register('step',()=>{ const now=Date.now(); if(now-lastCooldownCleanup<60000) return; lastCooldownCleanup=now; if(!shitterData.warningCooldowns) shitterData.warningCooldowns={}; const cooldownMs=(settings.warningCooldown||60)*1000; const threshold=now-cooldownMs*3; let removed=0; Object.keys(shitterData.warningCooldowns).forEach(k=>{ if(shitterData.warningCooldowns[k]<threshold){ delete shitterData.warningCooldowns[k]; removed++; }}); if(removed>0 && settings.debugMode) slInfo(`Cooldown Cleanup: ${removed}`); }).setDelay(20);

// Auto sync scheduler
function startAutoSync(){ if(!settings.enableAPI || !settings.autoSync || !settings.syncInterval) return; const intervalMs=Math.max(1,settings.syncInterval)*60*1000; register('step',()=>{ if(!settings.enableAPI || !settings.autoSync) return; const now=Date.now(); if(now-apiData.lastSync>=intervalMs) syncWithAPI(); }).setDelay(60); }

// Initial load
loadData();
setTimeout(()=>{ if(settings.enableAPI && settings.autoSync) startAutoSync(); if(settings.checkUpdatesOnLoad) triggerManualUpdateCheck(); startAutoUpdater(); },3000);

// Save on unload
register('gameUnload',()=>{ saveData(); if(settings.debugMode) ChatLib.chat(withPrefix('Daten gespeichert','success')); });

// === Party Join Overview ===
function getJson(url) {
	try {
		const res = FileLib.getUrlContent(url);
		if (!res) return null;
		return JSON.parse(res);
	} catch (e) {
		return null;
	}
}
function dashedUuid(nodash) {
	if (!nodash || nodash.length !== 32) return null;
	return nodash.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
}
function fetchUUID(name) {
	const j = getJson(`https://api.mojang.com/users/profiles/minecraft/${name}`);
	return j && j.id ? dashedUuid(j.id) : null;
}
function getNetworkLevel(exp) {
	// Hypixel network level formula
	try {
		const e = Number(exp || 0);
		const lvl = (Math.sqrt(2 * e + 30625) - 175) / 50;
		return Math.max(1, Math.floor(lvl));
	} catch (_) { return null; }
}
function showPartyOverview(nameRaw) {
	const name = String(nameRaw).trim();
	if (!settings.showPartyJoinOverview || !name) return;
	runAsync('PartyOverview', () => {
		let uuid = null, netLevel = null, cata = null;

		// UUID
		try { uuid = fetchUUID(name); } catch(_) {}

		// Hypixel /player (network level) if key present
		try {
			if (uuid && settings.hypixelApiKey && settings.hypixelApiKey.length > 0) {
				const p = getJson(`https://api.hypixel.net/player?key=${settings.hypixelApiKey}&uuid=${uuid}`);
				if (p && p.success && p.player) {
					const exp = p.player.networkExp || p.player.networkExperience || 0;
					netLevel = getNetworkLevel(exp);
				}
			}
		} catch(_) {}

		// Shiiyu fallback for Catacombs level (fast and simple)
		try {
			const s = getJson(`https://sky.shiiyu.moe/api/v2/profile/${encodeURIComponent(name)}`);
			if (s && s.profiles && s.profiles.length) {
				const cur = s.profiles.find(p => p.current) || s.profiles[0];
				const cat = cur && cur.data && cur.data.dungeons && cur.data.dungeons.types && cur.data.dungeons.types.catacombs;
				if (cat && cat.level && typeof cat.level.level === 'number') cata = cat.level.level;
			}
		} catch(_) {}

		// Build compact line
		const parts = [];
		parts.push(`${THEME.header}${name}`);
		if (cata != null) parts.push(`${THEME.sep}| ${THEME.accent}Cata ${THEME.info}${cata}`);
		if (netLevel != null) parts.push(`${THEME.sep}| ${THEME.accent}NW ${THEME.info}${netLevel}`);

		if (parts.length) ChatLib.chat(parts.join(' '));
		else slInfo(withPrefix(`Keine Daten für ${name}`,'info'));
	});
}

// Party Finder join (Dungeon Group)
register('chat', (name, rest) => {
	try { showPartyOverview(name); } catch(_) {}
}).setCriteria('Party Finder > ${name} joined the dungeon group!${rest}');

// Regular party join
register('chat', (name) => {
	try { showPartyOverview(name); } catch(_) {}
}).setCriteria('Party > ${name} joined the party.');
