import { expect, test } from "bun:test";
import {
	DEFAULT_SETTINGS,
	fromStoredPrefs,
	type NumericSetting,
	nudgeSetting,
	PREFS_REVISION,
	SETTING_LIMITS,
	sanitizeSettings,
	toStoredPrefs,
} from "./settings";

test("invalid types use field defaults without coercion", () => {
	for (const raw of [
		null,
		[],
		"x",
		true,
		{},
		{
			wpm: "240",
			mirror: "true",
			countdown: 0,
			fontSizePx: Number.NaN,
			targetSec: Number.POSITIVE_INFINITY,
		},
	])
		expect(sanitizeSettings(raw)).toEqual(DEFAULT_SETTINGS);
});
test("valid fields and bounds are retained independently", () => {
	const s = sanitizeSettings({
		wpm: 500,
		targetSec: 1,
		fontSizePx: 500,
		lineHeight: -1,
		align: "center",
		mirror: true,
		guide: false,
		countdown: false,
		keepAwake: false,
		fullscreen: true,
		theme: "dark",
		paceMode: "target",
	});
	expect(s).toEqual({
		...DEFAULT_SETTINGS,
		wpm: 300,
		targetSec: 10,
		fontSizePx: 96,
		lineHeight: 1.2,
		align: "center",
		mirror: true,
		guide: false,
		countdown: false,
		keepAwake: false,
		fullscreen: true,
		theme: "dark",
		paceMode: "target",
	});
});

test("nudges step within limits and keep one-decimal precision", () => {
	expect(nudgeSetting("wpm", 150, 1)).toBe(155);
	expect(nudgeSetting("wpm", 300, 1)).toBe(300);
	expect(nudgeSetting("wpm", 60, -1)).toBe(60);
	expect(nudgeSetting("targetSec", 60, -1)).toBe(55);
	expect(nudgeSetting("targetSec", 10, -1)).toBe(10);
	expect(nudgeSetting("fontSizePx", 36, 1)).toBe(38);
	expect(nudgeSetting("fontSizePx", 96, 5)).toBe(96);
	expect(nudgeSetting("lineHeight", 1.5, 1)).toBe(1.6);
	expect(nudgeSetting("lineHeight", 1.2, -1)).toBe(1.2);
});

test("stored preferences keep only changed values and round-trip", () => {
	expect(toStoredPrefs(DEFAULT_SETTINGS)).toEqual({ rev: PREFS_REVISION });
	const changed = { ...DEFAULT_SETTINGS, wpm: 170, theme: "dark" as const };
	const stored = toStoredPrefs(changed);
	expect(stored).toEqual({ rev: PREFS_REVISION, wpm: 170, theme: "dark" });
	expect(fromStoredPrefs(JSON.parse(JSON.stringify(stored)))).toEqual(changed);
	// A current-revision value equal to today's default is still honored.
	expect(fromStoredPrefs({ rev: PREFS_REVISION, fontSizePx: 36 })).toEqual(
		DEFAULT_SETTINGS,
	);
});

test("revision 1 saves keep explicit choices and drop old defaults", () => {
	const legacyAllDefaults = {
		paceMode: "wpm",
		wpm: 150,
		targetSec: 60,
		fontSizePx: 36,
		lineHeight: 1.5,
		align: "left",
		mirror: false,
		guide: true,
		countdown: true,
		keepAwake: true,
		fullscreen: false,
		theme: "system",
	};
	expect(fromStoredPrefs(legacyAllDefaults)).toEqual(DEFAULT_SETTINGS);
	const chosen = {
		...legacyAllDefaults,
		wpm: 170,
		theme: "dark",
		mirror: true,
	};
	expect(fromStoredPrefs(chosen)).toEqual({
		...DEFAULT_SETTINGS,
		wpm: 170,
		theme: "dark",
		mirror: true,
	});
	for (const raw of [null, [], "x", 3])
		expect(fromStoredPrefs(raw)).toEqual(DEFAULT_SETTINGS);
});

test("index.html number inputs match SETTING_LIMITS", async () => {
	const html = await Bun.file(
		new URL("../../index.html", import.meta.url),
	).text();
	const inputs = [
		...html.matchAll(
			/<input[^>]*data-setting="(\w+)"[^>]*type="number"[^>]*>/g,
		),
	];
	expect(inputs.length).toBeGreaterThanOrEqual(6);
	for (const [tag, key] of inputs) {
		const limits = SETTING_LIMITS[key as NumericSetting];
		expect(limits).toBeDefined();
		const attr = (name: string) =>
			Number(tag.match(new RegExp(`${name}="([^"]+)"`))?.[1]);
		expect([attr("min"), attr("max"), attr("step")]).toEqual([
			limits.min,
			limits.max,
			limits.step,
		]);
	}
});
