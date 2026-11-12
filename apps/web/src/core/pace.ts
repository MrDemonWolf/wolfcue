import { bounded } from "./settings";
export type Pace =
	| { mode: "wpm"; wpm: number }
	| { mode: "target"; targetSec: number };
export interface Layout {
	endPx: number;
	words: number;
}
export function sanitizePace(pace: Pace): Pace {
	return pace.mode === "target"
		? { mode: "target", targetSec: bounded(pace.targetSec, 60, 10, 3600) }
		: { mode: "wpm", wpm: bounded(pace.wpm, 150, 60, 300) };
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
	const cap = (300 / 60) * perWord;
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
/**
 * Adapted from Pocket Teleprompter, Copyright (c) 2026 ttomohisa, MIT License.
 * https://github.com/ttomohisa/htmlapps-pocket-teleprompter/blob/ad05bf6202bdb9a20e168e1f67521f0a73de90a5/src/index.template.html#L372
 */
export function nudgeWpm(wpm: number, direction: number): number {
	return bounded(wpm + direction * 5, 150, 60, 300);
}
/**
 * Adapted from Pocket Teleprompter, Copyright (c) 2026 ttomohisa, MIT License.
 * https://github.com/ttomohisa/htmlapps-pocket-teleprompter/blob/ad05bf6202bdb9a20e168e1f67521f0a73de90a5/src/index.template.html#L372
 */
export function nudgeTarget(targetSec: number, direction: number): number {
	return bounded(targetSec + direction * 5, 60, 10, 3600);
}
