import { expect, test } from "bun:test";
import {
	calculatePace,
	nudgeTarget,
	nudgeWpm,
	remainingSec,
	sanitizeLayout,
	sanitizePace,
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
test("invalid settings fall back and nudges stay bounded", () => {
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
	expect(nudgeWpm(300, 1)).toBe(300);
	expect(nudgeWpm(60, -1)).toBe(60);
	expect(nudgeWpm(150, 1)).toBe(155);
	expect(nudgeTarget(10, -1)).toBe(10);
	expect(nudgeTarget(3600, 1)).toBe(3600);
	expect(nudgeTarget(60, -1)).toBe(55);
});
