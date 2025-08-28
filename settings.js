// (Removed TypeScript reference directives not needed in runtime environment)

import { @Vigilant, @SwitchProperty, @SliderProperty, @TextProperty, @ButtonProperty, @CheckboxProperty, Color } from "Vigilance";

@Vigilant("Shitterlist", "Shitterlist Configuration", {
	getCategoryComparator: () => (a, b) => {
		const categories = ["General", "Warnings", "Sounds", "API", "Webhook", "Updater", "Advanced"];
		return categories.indexOf(a.name) - categories.indexOf(b.name);
	}
})
class Settings {
	@SwitchProperty({ name: "Aktiviert", description: "Aktiviert oder deaktiviert die Shitterlist komplett", category: "General" })
	enabled = true;
	@SwitchProperty({ name: "Debug Modus", description: "Zeigt zusätzliche Debug-Informationen im Chat", category: "General" })
	debugMode = false;
	@SwitchProperty({ name: "Prefix anzeigen", description: "Zeigt [Shitterlist] Prefix in Nachrichten", category: "General" })
	showPrefix = true;
	@SwitchProperty({ name: "Zeitstempel anzeigen", description: "Zeigt Zeitstempel in Nachrichten", category: "General" })
	showTimestamps = false;
	@SwitchProperty({ name: "Kompakte Nachrichten", description: "Verkürzt Chat-Nachrichten", category: "General" })
	compactMessages = false;
	@SliderProperty({ name: "Maximale Listengröße", description: "Maximale Anzahl von Spielern in der Liste", category: "General", min: 50, max: 2000 })
	maxListSize = 500;
	@SwitchProperty({ name: "Join Warnungen", description: "Warnt wenn ein Shitter dem Server beitritt", category: "Warnings" })
	showJoinWarnings = true;
	@SwitchProperty({ name: "Party Warnungen", description: "Warnt wenn ein Shitter der Party beitritt", category: "Warnings" })
	partyWarnings = true;
	@SwitchProperty({ name: "Dungeon Warnungen", description: "Warnt wenn ein Shitter dem Dungeon-Team beitritt", category: "Warnings" })
	dungeonWarnings = true;
	@SwitchProperty({ name: "Title Warnungen", description: "Zeigt große Titel-Warnungen", category: "Warnings" })
	showTitleWarning = true;
	@SliderProperty({ name: "Warning Cooldown", description: "Cooldown zwischen Warnungen (Sekunden)", category: "Warnings", min: 0, max: 300 })
	warningCooldown = 30;
	@SwitchProperty({ name: "Chat Filter", description: "Filtert Nachrichten von Shittern", category: "Warnings" })
	chatFilter = false;
	@SwitchProperty({ name: "Auto Block", description: "Blockiert Shitter automatisch mit /ignore", category: "Warnings" })
	autoBlock = false;
	@SwitchProperty({ name: "Auto Party Kick", description: "Kickt Shitter automatisch aus der Party", category: "Warnings" })
	autoPartyKick = false;
	@SwitchProperty({ name: "Warnsound", description: "Sound bei Warnungen", category: "Sounds" })
	warningSound = true;
	@SwitchProperty({ name: "Erfolgssound", description: "Sound bei Erfolgen", category: "Sounds" })
	successSound = true;
	@SwitchProperty({ name: "Custom Join Sound", description: "Eigener Sound bei Join", category: "Sounds" })
	customJoinSoundEnabled = false;
	@TextProperty({ name: "Join Sound Event", description: "Sound-Event Name", category: "Sounds", placeholder: "shitterlist.alert" })
	customJoinSoundEventName = "";
	@SliderProperty({ name: "Join Sound Lautstärke", description: "0-100", category: "Sounds", min: 0, max: 100 })
	customJoinSoundVolume = 100;
	@SliderProperty({ name: "Join Sound Pitch", description: "50-200 (0.5x-2.0x)", category: "Sounds", min: 50, max: 200 })
	customJoinSoundPitch = 100;
	@SwitchProperty({ name: "Auto Backup", description: "Tägliches Backup", category: "Advanced" })
	autoBackup = true;
	@SliderProperty({ name: "Auto Cleanup Tage", description: "Einträge älter als X Tage entfernen (0=aus)", category: "Advanced", min: 0, max: 365 })
	autoCleanupDays = 0;
	@SwitchProperty({ name: "Case Sensitive", description: "Groß-/Kleinschreibung beachten", category: "Advanced" })
	caseSensitive = false;
	@SwitchProperty({ name: "Teilstring Match", description: "Teilstring Suche erlauben", category: "Advanced" })
	partialMatching = false;
	@SwitchProperty({ name: "API aktiviert", description: "Aktiviert die API", category: "API" })
	enableAPI = false;
	@TextProperty({ name: "API URL", description: "URL der API", category: "API", placeholder: "https://api.example.com" })
	apiUrl = "";
	hypixelApiKey = "f899758e-e01c-4546-932c-d890c3c88896";
	@SwitchProperty({ name: "Auto Sync", description: "Automatische API-Syncs", category: "API" })
	autoSync = false;
	@SliderProperty({ name: "Sync Intervall", description: "Minuten", category: "API", min: 1, max: 60 })
	syncInterval = 5;
	// Webhook Settings
	@SwitchProperty({ name: "Webhook aktiv", description: "Discord Webhook Benachrichtigungen senden", category: "Webhook" })
	enableWebhook = true;
	@SwitchProperty({ name: "Webhook Add Events", description: "Sende Add Ereignisse", category: "Webhook" })
	webhookSendAdds = true;
	@SwitchProperty({ name: "Webhook Remove Events", description: "Sende Remove Ereignisse", category: "Webhook" })
	webhookSendRemoves = true;
	@SwitchProperty({ name: "Webhook Detection Events", description: "Sende Erkennungen (Join/Party)", category: "Webhook" })
	webhookSendDetections = true;
	@TextProperty({ name: "Webhook URL (Override)", description: "Leer lassen um die eingebaute URL zu nutzen", category: "Webhook", placeholder: "https://discord.com/api/webhooks/..." })
	webhookUrl = "";
	@SliderProperty({ name: "Auto-Remove Test (Minuten)", description: "Einträge mit Grund, der 'Test' enthält, automatisch nach X Minuten entfernen (0=aus)", category: "Advanced", min: 0, max: 180 })
	testAutoRemoveMinutes = 1;
	@ButtonProperty({ name: "Webhook Test", description: "Sendet eine Testnachricht", category: "Webhook" })
	webhookTest(){ try{ if(typeof sendWebhookTest==='function') sendWebhookTest(); else if(typeof sendWebhook==='function') sendWebhook('Shitterlist Webhook Test'); }catch(_){} }
	@SwitchProperty({ name: "Von API laden", description: "Daten herunterladen", category: "API" })
	downloadFromAPI = true;
	@SwitchProperty({ name: "Zur API hochladen", description: "Lokale Daten hochladen", category: "API" })
	uploadToAPI = false;
	@SwitchProperty({ name: "API Daten verifizieren", description: "API Daten prüfen", category: "API" })
	verifyAPIData = true;
	@SwitchProperty({ name: "API-Sync Nachrichten", description: "Statusmeldungen zeigen", category: "API" })
	showApiSyncMessages = true;
	@SwitchProperty({ name: "Allgemeine Nachrichten", description: "Info/Erfolg anzeigen", category: "General" })
	showGeneralMessages = true;
	@SwitchProperty({ name: "Warnungs-Nachrichten", description: "Warnungen anzeigen", category: "Warnings" })
	showWarningMessages = true;
	@SwitchProperty({ name: "Auto-Updater", description: "Automatische Updates", category: "Updater" })
	autoUpdaterEnabled = true;
	@SwitchProperty({ name: "Automatisch installieren", description: "Updates direkt installieren", category: "Updater" })
	autoInstallUpdates = true;
	@SwitchProperty({ name: "Beim Start prüfen", description: "Beim Laden nach Updates suchen", category: "Updater" })
	checkUpdatesOnLoad = true;
	@SliderProperty({ name: "Prüfintervall (Min.)", description: "Update-Intervall", category: "Updater", min: 1, max: 60 })
	updateCheckInterval = 5;
	@ButtonProperty({ name: "Jetzt nach Updates suchen", description: "Manueller Check", category: "Updater" })
	checkUpdatesButton() { if (typeof triggerManualUpdateCheck === 'function') triggerManualUpdateCheck(); }
	@ButtonProperty({ name: "Jetzt aktualisieren", description: "Force Update", category: "Updater" })
	forceUpdateButton() { if (typeof performSelfUpdate === 'function') performSelfUpdate(true); }
	constructor(){ this.initialize(this); }
}
export const settings = new Settings();