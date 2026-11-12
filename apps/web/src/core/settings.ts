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
		wpm: bounded(r.wpm, 150, 60, 300),
		targetSec: bounded(r.targetSec, 60, 10, 3600),
		fontSizePx: bounded(r.fontSizePx, 36, 18, 96),
		lineHeight: bounded(r.lineHeight, 1.5, 1.2, 2),
		align: r.align === "center" ? "center" : "left",
		mirror: bool("mirror"),
		guide: bool("guide"),
		countdown: bool("countdown"),
		keepAwake: bool("keepAwake"),
		fullscreen: bool("fullscreen"),
		theme: r.theme === "light" || r.theme === "dark" ? r.theme : "system",
	};
}
