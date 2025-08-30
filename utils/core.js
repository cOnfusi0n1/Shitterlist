// core.js – CLEAN SINGLE IMPLEMENTATION
// Provides: logging, async helper, rate-limited command queue, utilities, constants
import { settings } from '../settings';

// ========= Logging =========
function ts(){ return settings.showTimestamps ? `&7[${new Date().toLocaleTimeString()}] ` : ''; }

// Global, hardcoded colors for the entire module
export const THEME = {
	bracket: '&7',
	brand:   '&b',
	sep:     '&7',
	info:    '&b',
	success: '&a',
	warning: '&c',
	header:  '&9',
	accent:  '&e',
	dim:     '&7',
};

// Colored prefix using THEME
export function slPrefix(){
	if(!settings.showPrefix) return '';
	// Allow custom prefix from settings (full color codes allowed). If empty, use default themed prefix.
	if(settings.messagePrefix && String(settings.messagePrefix).trim().length>0){
		return ChatLib.addColor(String(settings.messagePrefix)) + ' ';
	}
	return `${THEME.bracket}[${THEME.brand}Shitterlist${THEME.bracket}] `;
}

function normalizeUmlauts(t){ if(!t) return t; return t.replace(/Ã¼/g,'ü').replace(/Ãœ/g,'Ü').replace(/Ã¶/g,'ö').replace(/Ã–/g,'Ö').replace(/Ã¤/g,'ä').replace(/Ã„/g,'Ä').replace(/ÃŸ/g,'ß'); }
// All formatted messages use the global THEME
export function formatMessage(msg, type='info') {
	const col = THEME[type] || '&f';
	return ts() + slPrefix() + col + normalizeUmlauts(msg);
}

// Convenience alias used across the module
export function withPrefix(text, type='info') {
	return formatMessage(text, type);
}

export function slLog(channel,msg,level='info'){ const enabled={general:()=>settings.showGeneralMessages,warning:()=>settings.showWarningMessages,api:()=>settings.showApiSyncMessages,debug:()=>settings.debugMode}; if(!(enabled[channel]||enabled.general)()) return; ChatLib.chat(formatMessage(msg,level)); }
export const slInfo   = m=>slLog('general',m,'info');
export const slSuccess= m=>slLog('general',m,'success');
export const slWarn   = m=>slLog('warning',m,'warning');
export const showApiSyncMessage=(m,t='info')=>slLog('api',m,t);

// ========= Async (Java Thread wrapper) =========
let __asyncInit=false, __Thread, __Runnable; export function runAsync(label,fn){ try{ if(!__asyncInit){ __Thread=Java.type('java.lang.Thread'); __Runnable=Java.type('java.lang.Runnable'); __asyncInit=true; } new __Thread(new __Runnable({ run(){ try{ fn(); }catch(e){ if(settings.debugMode) slWarn(`[Async ${label}] ${e}`); } } })).start(); }catch(e){ try{ fn(); }catch(_){} } }

// ========= Rate‑limited Command Queue =========
const COMMAND_DELAY_MS = 1200; // higher to satisfy server cooldowns and avoid 'slow down'
const __queue=[]; let __last=0;
export function safeCommand(cmd){ if(!cmd) return; __queue.push(cmd); }
// Send a command immediately (bypasses queue) – use sparingly
export function sendCommandNow(cmd){
	if(!cmd) return;
	try{
		if(settings.debugMode) ChatLib.chat(`&8[CMD:NOW] /${cmd}`);
		// Primary path
		ChatLib.say('/'+cmd);
	// Bump queue timer so subsequent queued commands respect spacing
	try{ __last = Date.now(); }catch(_){}
	}catch(e){
	try{ ChatLib.command(cmd,true); try{ __last = Date.now(); }catch(_){} }catch(e2){ if(settings.debugMode) slWarn('CmdNow Fehler (fallback): '+e2.message); }
		if(settings.debugMode) slWarn('CmdNow Fehler: '+e.message);
	}
}
register('tick',()=>{
	if(!__queue.length) return;
	const now=Date.now();
	if(now-__last<COMMAND_DELAY_MS) return;
	const next=__queue.shift();
	if(settings.debugMode) ChatLib.chat(`&8[CMD] /${next}`);
		try{
			// Primary path: send to server as raw chat message with leading slash
			ChatLib.say('/'+next);
		}catch(e){
			// Fallback path: attempt ChatLib.command if say failed
			try{ ChatLib.command(next,true); }catch(e2){ if(settings.debugMode) slWarn('Cmd Fehler (fallback): '+e2.message); }
			if(settings.debugMode) slWarn('Cmd Fehler: '+e.message);
		}
	__last=now;
});

// ========= Constants =========
// Permanent API_ONLY Modus (lokale Liste wird nicht persistiert bei aktivierter API-only Strategie)
export const API_ONLY = true; // adjust here if future toggle desired

// ========= Utilities =========
export function cleanPlayerName(name){ if(!name) return ''; let cleaned=name.replace(/§[0-9a-fk-or]/g,'').trim(); cleaned=cleaned.replace(/^\[[^\]]+\]\s*/,''); cleaned=cleaned.replace(/\s+[^\w].*$/,''); cleaned=cleaned.replace(/\s*\([^)]*\).*$/,''); cleaned=cleaned.replace(/[^\w\d_-]+.*$/,''); return cleaned.trim(); }

// Shared texts
export const ALLOWED_FLOORS_HELP = 'Erlaubte Floors: &eF1 F2 F3 F4 F5 F6 F7 &7oder &eM1 M2 M3 M4 M5 M6 M7';

// Expose for legacy compatibility (Rhino may not define globalThis)
const __g = (typeof globalThis!=='undefined') ? globalThis : (typeof global!=='undefined' ? global : this);
try {
	Object.assign(__g, {
		slLog, slInfo, slWarn, slSuccess, showApiSyncMessage,
		formatMessage, runAsync, safeCommand, API_ONLY, cleanPlayerName
	});
} catch(_) {}

// Backwards-compatible patch: normalize legacy "[Shitterlist]" literal messages
try{
	if(typeof ChatLib !== 'undefined' && !ChatLib.__slPrefixPatched){
		const __origChat = ChatLib.chat.bind(ChatLib);
		ChatLib.chat = function(msg){
			try{
				if(typeof msg === 'string'){
					// detect legacy prefix like '&c[Shitterlist] ' or '[Shitterlist] '
					const m = msg.match(/^(?:\s*&[0-9a-fk-or])?\s*\[Shitterlist\]\s*(.*)$/i);
					if(m && m[1]!==undefined){
						const rest = m[1];
						return __origChat(ChatLib.addColor(slPrefix() + rest));
					}
				}
			}catch(e){/* swallow */}
			return __origChat(msg);
		};
		ChatLib.__slPrefixPatched = true;
	}
}catch(_){}