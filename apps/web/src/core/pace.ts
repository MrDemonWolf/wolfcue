import {
	bounded,
	clampSetting,
	SETTING_LIMITS,
	type Settings,
} from "./settings";
export type Pace =
	| { mode: "wpm"; wpm: number }
	| { mode: "target"; targetSec: number };
export interface Layout {
	endPx: number;
	words: number;
}
/** Fastest scroll speed, also the cap applied in Target time mode. */
export const MAX_WPM = SETTING_LIMITS.wpm.max;
export function sanitizePace(pace: Pace): Pace {
	return pace.mode === "target"
		? { mode: "target", targetSec: clampSetting("targetSec", pace.targetSec) }
		: { mode: "wpm", wpm: clampSetting("wpm", pace.wpm) };
}
export function sanitizeLayout(layout: Layout): Layout {
	return {
		endPx: bounded(layout.endPx, 0, 0, Number.MAX_SAFE_INTEGER),
		words: bounded(layout.words, 0, 0, Number.MAX_SAFE_INTEGER),
	};
}
/**
 * Adapted from Pocket Teleprompter, Copyright (c) 2026 ttomohisa, MIT License.
 * https://github.com/ttomohisa/htmlapps-pocket-teleprompter/blob/ad05bf6202bdb9a20e168e1f67521f0a73de90a5/src/index.template.html#L330
 */
export function calculatePace(
	pace: Pace,
	layout: Layout,
	positionPx = 0,
	elapsedMs = 0,
): { pxPerSec: number; overTarget: boolean } {
	const p = sanitizePace(pace);
	const l = sanitizeLayout(layout);
	const perWord = l.endPx / Math.max(1, l.words);
	if (p.mode === "wpm")
		return { pxPerSec: (p.wpm / 60) * perWord, overTarget: false };
	const requested =
		Math.max(0, l.endPx - positionPx) /
		Math.max(1, p.targetSec - elapsedMs / 1000);
	const cap = (MAX_WPM / 60) * perWord;
	return { pxPerSec: Math.min(requested, cap), overTarget: requested > cap };
}
/**
 * Adapted from Pocket Teleprompter, Copyright (c) 2026 ttomohisa, MIT License.
 * https://github.com/ttomohisa/htmlapps-pocket-teleprompter/blob/ad05bf6202bdb9a20e168e1f67521f0a73de90a5/src/index.template.html#L350
 */
export function remainingSec(
	positionPx: number,
	endPx: number,
	pxPerSec: number,
): number {
	return pxPerSec > 0 ? Math.max(0, endPx - positionPx) / pxPerSec : 0;
}
/** Shortest possible reading time, at the capped maximum pace. */
export function minTargetSec(words: number): number {
	return (Math.max(0, words) / MAX_WPM) * 60;
}
/** Honest whole-script estimate: Target time cannot beat the 300 wpm cap. */
export function estimateSec(
	pace: Pace,
	words: number,
): { sec: number; capped: boolean } {
	const p = sanitizePace(pace);
	if (p.mode === "wpm")
		return { sec: (Math.max(0, words) / p.wpm) * 60, capped: false };
	const floor = minTargetSec(words);
	return floor > p.targetSec
		? { sec: floor, capped: true }
		: { sec: p.targetSec, capped: false };
}
export function paceFromSettings(
	settings: Pick<Settings, "paceMode" | "wpm" | "targetSec">,
): Pace {
	return settings.paceMode === "target"
		? { mode: "target", targetSec: settings.targetSec }
		: { mode: "wpm", wpm: settings.wpm };
}
/** A target that keeps the current words-per-minute pace, in whole steps. */
export function suggestTargetSec(words: number, wpm: number): number {
	const { step } = SETTING_LIMITS.targetSec;
	const sec = (Math.max(0, words) / clampSetting("wpm", wpm)) * 60;
	return clampSetting("targetSec", Math.ceil(sec / step) * step);
}
/**
 * Switching to Target time keeps a reachable target. A stored target that the
 * 300 wpm cap cannot meet is replaced with one that keeps the current pace.
 */
export function seedTargetOnSwitch(
	previous: Settings,
	next: Settings,
	words: number,
): Settings {
	if (
		previous.paceMode !== "wpm" ||
		next.paceMode !== "target" ||
		words <= 0 ||
		next.targetSec >= minTargetSec(words)
	)
		return next;
	return { ...next, targetSec: suggestTargetSec(words, next.wpm) };
}
