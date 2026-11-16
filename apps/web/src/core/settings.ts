export interface Settings {
	paceMode: "wpm" | "target";
	wpm: number;
	targetSec: number;
	fontSizePx: number;
	lineHeight: number;
	align: "left" | "center";
	mirror: boolean;
	guide: boolean;
	countdown: boolean;
	keepAwake: boolean;
	fullscreen: boolean;
	theme: "system" | "light" | "dark";
}
export const DEFAULT_SETTINGS: Settings = {
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
/** Single source for numeric ranges. index.html mirrors these; a unit test checks it. */
export const SETTING_LIMITS = {
	wpm: { min: 60, max: 300, step: 5 },
	targetSec: { min: 10, max: 3600, step: 5 },
	fontSizePx: { min: 18, max: 96, step: 2 },
	lineHeight: { min: 1.2, max: 2, step: 0.1 },
} as const;
export type NumericSetting = keyof typeof SETTING_LIMITS;
export function bounded(
	value: unknown,
	fallback: number,
	min: number,
	max: number,
): number {
	return typeof value === "number" && Number.isFinite(value)
		? Math.min(max, Math.max(min, value))
		: fallback;
}
export function clampSetting(key: NumericSetting, value: unknown): number {
	const { min, max } = SETTING_LIMITS[key];
	return bounded(value, DEFAULT_SETTINGS[key], min, max);
}
/**
 * Adapted from Pocket Teleprompter, Copyright (c) 2026 ttomohisa, MIT License.
 * https://github.com/ttomohisa/htmlapps-pocket-teleprompter/blob/ad05bf6202bdb9a20e168e1f67521f0a73de90a5/src/index.template.html#L372
 */
export function nudgeSetting(
	key: NumericSetting,
	value: number,
	direction: number,
): number {
	const { step } = SETTING_LIMITS[key];
	const next = value + Math.sign(direction) * step;
	return clampSetting(key, Math.round(next * 10) / 10);
}
/**
 * Adapted from Pocket Teleprompter, Copyright (c) 2026 ttomohisa, MIT License.
 * https://github.com/ttomohisa/htmlapps-pocket-teleprompter/blob/ad05bf6202bdb9a20e168e1f67521f0a73de90a5/src/index.template.html#L225
 */
export function sanitizeSettings(raw: unknown): Settings {
	const r =
		typeof raw === "object" && raw !== null
			? (raw as Record<string, unknown>)
			: {};
	const bool = (key: keyof Settings) =>
		typeof r[key] === "boolean"
			? (r[key] as boolean)
			: (DEFAULT_SETTINGS[key] as boolean);
	return {
		paceMode: r.paceMode === "target" ? "target" : "wpm",
		wpm: clampSetting("wpm", r.wpm),
		targetSec: clampSetting("targetSec", r.targetSec),
		fontSizePx: clampSetting("fontSizePx", r.fontSizePx),
		lineHeight: clampSetting("lineHeight", r.lineHeight),
		align: r.align === "center" ? "center" : "left",
		mirror: bool("mirror"),
		guide: bool("guide"),
		countdown: bool("countdown"),
		keepAwake: bool("keepAwake"),
		fullscreen: bool("fullscreen"),
		theme: r.theme === "light" || r.theme === "dark" ? r.theme : "system",
	};
}

/**
 * Stored preferences hold only the values a person changed, so a later
 * change to DEFAULT_SETTINGS reaches everyone who kept the old default.
 */
export const PREFS_REVISION = 2;
/** Defaults shipped before revision 2. Frozen: never edit to match DEFAULT_SETTINGS. */
const REVISION_1_DEFAULTS: Readonly<Record<string, unknown>> = {
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
export function toStoredPrefs(settings: Settings): Record<string, unknown> {
	const clean = sanitizeSettings(settings);
	const stored: Record<string, unknown> = { rev: PREFS_REVISION };
	for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[])
		if (clean[key] !== DEFAULT_SETTINGS[key]) stored[key] = clean[key];
	return stored;
}
export function fromStoredPrefs(raw: unknown): Settings {
	if (typeof raw !== "object" || raw === null || Array.isArray(raw))
		return sanitizeSettings(raw);
	const record = raw as Record<string, unknown>;
	if (record.rev === PREFS_REVISION) return sanitizeSettings(record);
	// Revision 1 saved every field, so a value equal to its old default was
	// not necessarily chosen. Let those follow the current defaults.
	const chosen: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(record))
		if (!(key in REVISION_1_DEFAULTS) || REVISION_1_DEFAULTS[key] !== value)
			chosen[key] = value;
	return sanitizeSettings(chosen);
}
