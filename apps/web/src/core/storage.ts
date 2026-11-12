import { DEFAULT_SETTINGS, type Settings, sanitizeSettings } from "./settings";
export interface StorageLike {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}
export const STORAGE_KEYS = {
	script: "wolfcue:v1:script",
	prefs: "wolfcue:v1:prefs",
	theme: "wolfcue:theme",
};
export function getStorage(getter: () => StorageLike): StorageLike | null {
	try {
		return getter();
	} catch {
		return null;
	}
}
export function createStore(storage: StorageLike | null) {
	let script = "";
	let dirty = false;
	let prefs = { ...DEFAULT_SETTINGS };
	let scriptSaved = !!storage;
	let prefsSaved = !!storage;
	try {
		script = storage?.getItem(STORAGE_KEYS.script) ?? "";
	} catch {
		scriptSaved = false;
	}
	try {
		const json = storage?.getItem(STORAGE_KEYS.prefs);
		if (json) {
			try {
				prefs = sanitizeSettings(JSON.parse(json));
			} catch {
				prefs = { ...DEFAULT_SETTINGS };
			}
		}
	} catch {
		prefsSaved = false;
	}
	return {
		get script() {
			return script;
		},
		get prefs() {
			return prefs;
		},
		get status(): "saved" | "not-saved" {
			return scriptSaved && prefsSaved ? "saved" : "not-saved";
		},
		setScript(text: string) {
			script = text;
			dirty = true;
			scriptSaved = false;
		},
		flush() {
			if (!dirty) return;
			try {
				if (!storage) return;
				storage.setItem(STORAGE_KEYS.script, script);
				dirty = false;
				scriptSaved = true;
			} catch {
				scriptSaved = false;
			}
		},
		savePrefs(settings: Settings) {
			prefs = sanitizeSettings(settings);
			prefsSaved = false;
			try {
				if (!storage) return;
				storage.setItem(STORAGE_KEYS.prefs, JSON.stringify(prefs));
				if (prefs.theme === "system") storage.removeItem(STORAGE_KEYS.theme);
				else storage.setItem(STORAGE_KEYS.theme, prefs.theme);
				prefsSaved = true;
			} catch {
				prefsSaved = false;
			}
		},
		erase() {
			dirty = false;
			script = "";
			prefs = { ...DEFAULT_SETTINGS };
			scriptSaved = !!storage;
			prefsSaved = !!storage;
			for (const key of Object.values(STORAGE_KEYS)) {
				try {
					storage?.removeItem(key);
				} catch {
					scriptSaved = false;
					prefsSaved = false;
				}
			}
		},
	};
}
