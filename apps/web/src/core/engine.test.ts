import { expect, test } from "bun:test";
import {
	beginCountdown,
	createEngine,
	pause,
	play,
	relayout,
	restart,
	seekBy,
	seekTo,
	setPace,
	step,
} from "./engine";

const base = () =>
	createEngine({ mode: "wpm", wpm: 60 }, { endPx: 1800, words: 100 });
function advance(ms: number, frame: number) {
	let s = play(base(), 0);
	for (let t = frame; t <= ms; t += frame) s = step(s, t);
	return s;
}
test("fractional engine position equals rate times active time", () => {
	expect(advance(10000, 20).positionPx).toBeCloseTo(180, 8);
	expect(advance(960, 16).positionPx).toBeCloseTo(
		advance(960, 240).positionPx,
		8,
	);
	expect(advance(10000, 20).elapsedMs).toBe(10000);
});
test("frame delta clamp prevents a leap and ignores backwards clocks", () => {
	let s = play(base(), 100);
	s = step(s, 50);
	expect(s.positionPx).toBe(0);
	expect(s.lastFrameMs).toBe(100);
	s = step(s, 5100);
	expect(s.positionPx).toBe(4.5);
	expect(s.elapsedMs).toBe(250);
	expect(step(s, Number.NaN)).toBe(s);
});
test("duplicate play/pause are no-ops; pause freezes and resume excludes hidden time", () => {
	let s = play(base(), 0);
	expect(play(s, 50)).toBe(s);
	s = step(s, 100);
	s = pause(s);
	expect(pause(s)).toBe(s);
	expect(step(s, 5000)).toBe(s);
	const px = s.positionPx;
	s = play(s, 5000);
	s = step(s, 5100);
	expect(s.positionPx - px).toBeCloseTo(1.8);
	expect(s.elapsedMs).toBe(200);
});
test("seek only works paused or finished and preserves elapsed", () => {
	let s = step(play(base(), 0), 100);
	expect(seekTo(s, 900)).toBe(s);
	s = pause(s);
	s = seekTo(s, 900);
	expect(s.positionPx).toBe(900);
	expect(s.elapsedMs).toBe(100);
	expect(s.phase).toBe("paused");
	expect(seekTo(s, Number.POSITIVE_INFINITY)).toBe(s);
	expect(seekBy(s, -10000).positionPx).toBe(0);
	expect(seekTo(s, 10000).positionPx).toBe(1800);
	expect(seekTo(s, 1800).phase).toBe("paused");
	expect(seekTo(s, 1799.9).phase).toBe("paused");
});
test("restart resets time and position; finish occurs once and never overshoots", () => {
	let s = seekTo(base(), 1799.8);
	s = step(play(s, 0), 100);
	expect(s.phase).toBe("finished");
	expect(s.positionPx).toBe(1800);
	expect(step(s, 200)).toBe(s);
	expect(play(s, 300)).toBe(s);
	expect(pause(s)).toBe(s);
	const r = restart(s);
	expect(r.positionPx).toBe(0);
	expect(r.elapsedMs).toBe(0);
	expect(r.phase).toBe("paused");
	expect(seekTo(s, 900).phase).toBe("paused");
});
test("countdown and pause do not add reading time", () => {
	let s = beginCountdown(base(), 100);
	expect(s.phase).toBe("countdown");
	expect(step(s, 3100)).toBe(s);
	s = pause(s);
	expect(s.countdownStartedMs).toBeNull();
	expect(s.elapsedMs).toBe(0);
});
test("relayout preserves playback and recalculates WPM; zero geometry does not corrupt", () => {
	let s = step(play(base(), 0), 100);
	s = relayout(s, { endPx: 3600, words: 100 }, 900);
	expect(s.phase).toBe("playing");
	expect(s.positionPx).toBe(900);
	expect(s.pxPerSec).toBe(36);
	expect(relayout(s, { endPx: 0, words: 100 }, 0)).toBe(s);
	s = setPace(s, { mode: "wpm", wpm: 150 });
	expect(s.pxPerSec).toBe(90);
});
test("empty and one-line sessions have finite state", () => {
	for (const layout of [
		{ endPx: 0, words: 0 },
		{ endPx: 54, words: 1 },
	]) {
		let s = createEngine({ mode: "target", targetSec: 10 }, layout);
		s = step(play(s, 0), 250);
		expect(Number.isFinite(s.positionPx)).toBe(true);
		expect(Number.isFinite(s.pxPerSec)).toBe(true);
	}
});
test("target seek scenario derives remaining pace from elapsed active time", () => {
	let s = createEngine(
		{ mode: "target", targetSec: 180 },
		{ endPx: 1000, words: 200 },
	);
	s = { ...s, elapsedMs: 60000 };
	s = seekTo(s, 750);
	expect(s.pxPerSec).toBeCloseTo(250 / 120);
	expect(s.elapsedMs).toBe(60000);
	const r = relayout(s, { endPx: 2000, words: 200 }, 1500);
	expect(r.pxPerSec).toBeCloseTo(500 / 120);
});

test("invalid seeks and countdown seeks preserve the exact state", () => {
	const s = base();
	for (const value of [
		Number.NaN,
		Number.POSITIVE_INFINITY,
		Number.NEGATIVE_INFINITY,
	]) {
		expect(seekTo(s, value)).toBe(s);
		expect(seekBy(s, value)).toBe(s);
	}
	const countdown = beginCountdown(s, 0);
	expect(seekTo(countdown, 900)).toBe(countdown);
	expect(play(s, Number.NaN)).toBe(s);
});
test("seek and layout never mutate previous state and finished end follows reflow", () => {
	const original = base();
	const sought = seekTo(original, 500);
	expect(original.positionPx).toBe(0);
	expect(sought.positionPx).toBe(500);
	let finished = step(play(seekTo(original, 1799.8), 0), 100);
	finished = relayout(finished, { endPx: 2500, words: 100 }, 700);
	expect(finished.phase).toBe("finished");
	expect(finished.positionPx).toBe(2500);
});
