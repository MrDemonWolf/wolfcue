import {
	calculatePace,
	type Layout,
	type Pace,
	sanitizeLayout,
	sanitizePace,
} from "./pace";

export type { Layout, Pace } from "./pace";
export type Phase = "countdown" | "playing" | "paused" | "finished";
export interface EngineState {
	phase: Phase;
	positionPx: number;
	elapsedMs: number;
	lastFrameMs: number | null;
	pxPerSec: number;
	overTarget: boolean;
	pace: Pace;
	layout: Layout;
	countdownStartedMs: number | null;
}
export const MAX_FRAME_DELTA_MS = 250;
function recalculate(s: EngineState): EngineState {
	return {
		...s,
		...calculatePace(s.pace, s.layout, s.positionPx, s.elapsedMs),
	};
}
export function createEngine(
	pace: Pace = { mode: "wpm", wpm: 150 },
	layout: Layout = { endPx: 0, words: 0 },
): EngineState {
	return recalculate({
		phase: "paused",
		positionPx: 0,
		elapsedMs: 0,
		lastFrameMs: null,
		pxPerSec: 0,
		overTarget: false,
		pace: sanitizePace(pace),
		layout: sanitizeLayout(layout),
		countdownStartedMs: null,
	});
}
/**
 * Adapted from Pocket Teleprompter, Copyright (c) 2026 ttomohisa, MIT License.
 * https://github.com/ttomohisa/htmlapps-pocket-teleprompter/blob/ad05bf6202bdb9a20e168e1f67521f0a73de90a5/src/index.template.html#L349
 */
export function step(s: EngineState, nowMs: number): EngineState {
	if (s.phase !== "playing" || !Number.isFinite(nowMs)) return s;
	const dt = Math.min(
		MAX_FRAME_DELTA_MS,
		Math.max(0, nowMs - (s.lastFrameMs ?? nowMs)),
	);
	const positionPx = Math.min(
		s.layout.endPx,
		s.positionPx + (s.pxPerSec * dt) / 1000,
	);
	const finished = positionPx >= s.layout.endPx - 0.5;
	return {
		...s,
		positionPx: finished ? s.layout.endPx : positionPx,
		elapsedMs: s.elapsedMs + dt,
		lastFrameMs: finished ? null : Math.max(s.lastFrameMs ?? nowMs, nowMs),
		phase: finished ? "finished" : "playing",
	};
}
/**
 * Adapted from Pocket Teleprompter, Copyright (c) 2026 ttomohisa, MIT License.
 * https://github.com/ttomohisa/htmlapps-pocket-teleprompter/blob/ad05bf6202bdb9a20e168e1f67521f0a73de90a5/src/index.template.html#L346
 */
export function play(s: EngineState, nowMs: number): EngineState {
	if (
		s.phase === "playing" ||
		s.phase === "finished" ||
		!Number.isFinite(nowMs)
	)
		return s;
	return recalculate({
		...s,
		phase: "playing",
		lastFrameMs: nowMs,
		countdownStartedMs: null,
	});
}
/**
 * Adapted from Pocket Teleprompter, Copyright (c) 2026 ttomohisa, MIT License.
 * https://github.com/ttomohisa/htmlapps-pocket-teleprompter/blob/ad05bf6202bdb9a20e168e1f67521f0a73de90a5/src/index.template.html#L347
 */
export function pause(s: EngineState): EngineState {
	if (s.phase === "paused" || s.phase === "finished") return s;
	return { ...s, phase: "paused", lastFrameMs: null, countdownStartedMs: null };
}
/**
 * Adapted from Pocket Teleprompter, Copyright (c) 2026 ttomohisa, MIT License.
 * https://github.com/ttomohisa/htmlapps-pocket-teleprompter/blob/ad05bf6202bdb9a20e168e1f67521f0a73de90a5/src/index.template.html#L368
 */
export function restart(s: EngineState): EngineState {
	return recalculate({
		...s,
		phase: "paused",
		positionPx: 0,
		elapsedMs: 0,
		lastFrameMs: null,
		countdownStartedMs: null,
	});
}
/**
 * Adapted from Pocket Teleprompter, Copyright (c) 2026 ttomohisa, MIT License.
 * https://github.com/ttomohisa/htmlapps-pocket-teleprompter/blob/ad05bf6202bdb9a20e168e1f67521f0a73de90a5/src/index.template.html#L360
 */
export function seekTo(s: EngineState, positionPx: number): EngineState {
	if (
		(s.phase !== "paused" && s.phase !== "finished") ||
		!Number.isFinite(positionPx)
	)
		return s;
	return recalculate({
		...s,
		phase: "paused",
		positionPx: Math.min(s.layout.endPx, Math.max(0, positionPx)),
		lastFrameMs: null,
	});
}
export function seekBy(s: EngineState, deltaPx: number): EngineState {
	return seekTo(s, s.positionPx + deltaPx);
}
/**
 * Adapted from Pocket Teleprompter, Copyright (c) 2026 ttomohisa, MIT License.
 * https://github.com/ttomohisa/htmlapps-pocket-teleprompter/blob/ad05bf6202bdb9a20e168e1f67521f0a73de90a5/src/index.template.html#L324
 */
export function relayout(
	s: EngineState,
	layout: Layout,
	restoredPositionPx: number,
): EngineState {
	const l = sanitizeLayout(layout);
	if (l.endPx === 0 && s.layout.endPx > 0) return s;
	const positionPx =
		s.phase === "finished"
			? l.endPx
			: Math.min(
					l.endPx,
					Math.max(
						0,
						Number.isFinite(restoredPositionPx)
							? restoredPositionPx
							: s.positionPx,
					),
				);
	return recalculate({ ...s, layout: l, positionPx });
}
/**
 * Adapted from Pocket Teleprompter, Copyright (c) 2026 ttomohisa, MIT License.
 * https://github.com/ttomohisa/htmlapps-pocket-teleprompter/blob/ad05bf6202bdb9a20e168e1f67521f0a73de90a5/src/index.template.html#L372
 */
export function setPace(s: EngineState, pace: Pace): EngineState {
	return recalculate({ ...s, pace: sanitizePace(pace) });
}
export function beginCountdown(s: EngineState, nowMs: number): EngineState {
	return {
		...s,
		phase: "countdown",
		lastFrameMs: null,
		countdownStartedMs: nowMs,
	};
}
