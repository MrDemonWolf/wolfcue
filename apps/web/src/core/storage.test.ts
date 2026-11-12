import { expect, test } from "bun:test";
import { DEFAULT_SETTINGS } from "./settings";
import {
	createStore,
	getStorage,
	STORAGE_KEYS,
	type StorageLike,
} from "./storage";

function fake(initial: Record<string, string> = {}) {
	const data = new Map(Object.entries(initial));
	return {
		data,
		getItem: (k: string) => data.get(k) ?? null,
		setItem: (k: string, v: string) => {
			data.set(k, v);
		},
		removeItem: (k: string) => {
			data.delete(k);
		},
	};
}
test("getter throws and denied reads fall back to memory", () => {
	expect(
		getStorage(() => {
			throw Error("denied");
		}),
	).toBeNull();
	const store = createStore({
		getItem() {
			throw Error("denied");
		},
		setItem() {
			throw Error("denied");
		},
		removeItem() {
			throw Error("denied");
		},
	});
	expect(store.status).toBe("not-saved");
	store.setScript("private words");
	expect(store.status).toBe("not-saved");
	store.flush();
	expect(store.script).toBe("private words");
	expect(store.status).toBe("not-saved");
	const memory = createStore(null);
	memory.setScript("memory");
	expect(memory.status).toBe("not-saved");
	memory.flush();
	memory.savePrefs(DEFAULT_SETTINGS);
	expect(memory.script).toBe("memory");
	expect(memory.status).toBe("not-saved");
});
test("corrupt JSON and wrong settings types recover independently of script", () => {
	for (const raw of ["{bad", '"oops"', '{"wpm":"bad","mirror":"bad"}']) {
		const s = createStore(
			fake({ [STORAGE_KEYS.prefs]: raw, [STORAGE_KEYS.script]: "keep" }),
		);
		expect(s.prefs).toEqual(DEFAULT_SETTINGS);
		expect(s.script).toBe("keep");
	}
});
test("script flush saves exact text and preferences stay separate", () => {
	const storage = fake();
	const s = createStore(storage);
	expect(getStorage(() => storage)).toBe(storage);
	s.setScript("日本語 🐺");
	expect(storage.getItem(STORAGE_KEYS.script)).toBeNull();
	expect(s.status).toBe("pending");
	s.savePrefs({ ...DEFAULT_SETTINGS, wpm: 200 });
	expect(s.status).toBe("pending");
	s.flush();
	expect(s.status).toBe("saved");
	expect(storage.getItem(STORAGE_KEYS.script)).toBe("日本語 🐺");
	s.savePrefs({ ...DEFAULT_SETTINGS, theme: "dark" });
	expect(storage.getItem(STORAGE_KEYS.theme)).toBe("dark");
	s.savePrefs(DEFAULT_SETTINGS);
	expect(storage.getItem(STORAGE_KEYS.theme)).toBeNull();
	s.erase();
	expect(s.script).toBe("");
	expect(s.prefs).toEqual(DEFAULT_SETTINGS);
	expect(storage.data.size).toBe(0);
});
test("quota failure preserves in-memory script while preferences still save", () => {
	const storage = fake();
	const working = storage.setItem;
	storage.setItem = (k, v) => {
		if (k === STORAGE_KEYS.script)
			throw new DOMException("full", "QuotaExceededError");
		working(k, v);
	};
	const s = createStore(storage);
	s.setScript("keep me");
	s.flush();
	s.savePrefs({ ...DEFAULT_SETTINGS, wpm: 200 });
	expect(s.script).toBe("keep me");
	expect(s.status).toBe("not-saved");
	expect(JSON.parse(storage.getItem(STORAGE_KEYS.prefs) ?? "{}").wpm).toBe(200);
});
test("erase errors are reported and do not crash", () => {
	const storage: StorageLike = {
		getItem: () => null,
		setItem() {},
		removeItem() {
			throw Error("blocked");
		},
	};
	const s = createStore(storage);
	s.erase();
	expect(s.status).toBe("not-saved");
});

test("flushing an unread script never overwrites storage before an edit", () => {
	const storage = fake({ [STORAGE_KEYS.script]: "precious stored text" });
	const reader = storage.getItem;
	storage.getItem = (key) => {
		if (key === STORAGE_KEYS.script) throw Error("temporary read error");
		return reader(key);
	};
	const store = createStore(storage);
	store.flush();
	expect(storage.data.get(STORAGE_KEYS.script)).toBe("precious stored text");
	store.setScript("new in-memory text");
	store.flush();
	expect(storage.data.get(STORAGE_KEYS.script)).toBe("new in-memory text");
});
test("a failed flush retries the current script and erase cannot recreate its keys", () => {
	const storage = fake();
	const write = storage.setItem;
	storage.setItem = () => {
		throw Error("temporary write error");
	};
	const store = createStore(storage);
	store.setScript("first");
	expect(store.status).toBe("pending");
	store.flush();
	expect(store.status).toBe("not-saved");
	storage.setItem = write;
	store.setScript("latest");
	expect(store.status).toBe("not-saved");
	store.flush();
	expect(store.status).toBe("saved");
	expect(storage.data.get(STORAGE_KEYS.script)).toBe("latest");
	store.setScript("pending");
	expect(store.status).toBe("pending");
	store.erase();
	expect(store.status).toBe("saved");
	store.flush();
	expect(storage.data.size).toBe(0);
});

test("preference failures override pending scripts until preferences save successfully", () => {
	const storage = fake();
	const write = storage.setItem;
	storage.setItem = (key, value) => {
		if (key === STORAGE_KEYS.prefs) throw Error("preferences blocked");
		write(key, value);
	};
	const store = createStore(storage);
	store.setScript("pending script");
	expect(store.status).toBe("pending");
	store.savePrefs(DEFAULT_SETTINGS);
	expect(store.status).toBe("not-saved");
	store.setScript("latest script");
	expect(store.status).toBe("not-saved");
	store.flush();
	expect(store.status).toBe("not-saved");
	expect(storage.getItem(STORAGE_KEYS.script)).toBe("latest script");
	storage.setItem = write;
	store.savePrefs(DEFAULT_SETTINGS);
	expect(store.status).toBe("saved");
});
