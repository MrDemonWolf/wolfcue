import { expect, test } from "bun:test";
import {
	calculatePace,
	estimateSec,
	minTargetSec,
	remainingSec,
	sanitizeLayout,
	sanitizePace,
	suggestTargetSec,
} from "./pace";

test("WPM matches measured layout and target uses remaining distance and time", () => {
	expect(
		calculatePace({ mode: "wpm", wpm: 150 }, { endPx: 1000, words: 100 }),
	).toEqual({ pxPerSec: 25, overTarget: false });
	expect(
		calculatePace(
			{ mode: "target", targetSec: 180 },
			{ endPx: 1000, words: 100 },
			750,
			60000,
		).pxPerSec,
	).toBeCloseTo(250 / 120);
	expect(remainingSec(750, 1000, 250 / 120)).toBeCloseTo(120);
	expect(remainingSec(1000, 1000, 0)).toBe(0);
});
test("target caps at 300 WPM and exposes approximate real remaining time", () => {
	const result = calculatePace(
		{ mode: "target", targetSec: 10 },
		{ endPx: 1000, words: 100 },
		0,
		11000,
	);
	expect(result).toEqual({ pxPerSec: 50, overTarget: true });
	expect(remainingSec(0, 1000, result.pxPerSec)).toBe(20);
});
test("invalid settings fall back to defaults", () => {
	expect(sanitizePace({ mode: "wpm", wpm: Number.NaN })).toEqual({
		mode: "wpm",
		wpm: 150,
	});
	expect(
		sanitizePace({ mode: "target", targetSec: Number.POSITIVE_INFINITY }),
	).toEqual({ mode: "target", targetSec: 60 });
	expect(sanitizeLayout({ endPx: Number.NaN, words: -10 })).toEqual({
		endPx: 0,
		words: 0,
	});
});

test("estimates stay honest when a target is faster than the cap", () => {
	expect(estimateSec({ mode: "wpm", wpm: 150 }, 495)).toEqual({
		sec: 198,
		capped: false,
	});
	expect(minTargetSec(495)).toBe(99);
	expect(estimateSec({ mode: "target", targetSec: 60 }, 495)).toEqual({
		sec: 99,
		capped: true,
	});
	expect(estimateSec({ mode: "target", targetSec: 120 }, 495)).toEqual({
		sec: 120,
		capped: false,
	});
	expect(estimateSec({ mode: "target", targetSec: 60 }, 0)).toEqual({
		sec: 60,
		capped: false,
	});
});
test("suggested targets keep the current pace in whole steps", () => {
	expect(suggestTargetSec(495, 150)).toBe(200);
	expect(suggestTargetSec(500, 150)).toBe(200);
	expect(suggestTargetSec(0, 150)).toBe(10);
	expect(suggestTargetSec(10_000_000, 60)).toBe(3600);
	expect(suggestTargetSec(495, 300)).toBeGreaterThanOrEqual(minTargetSec(495));
});
