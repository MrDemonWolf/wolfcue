import { expect, test } from "bun:test";
import { dimHeightPx, GUIDE_RATIO, guideOffsetPx } from "./guide";

test("reading line sits in the upper quarter with one line above", () => {
	expect(GUIDE_RATIO).toBe(0.25);
	expect(guideOffsetPx(760, 54)).toBe(190);
	// Small Moblin windows keep one full line above the reading line.
	expect(guideOffsetPx(150, 54)).toBe(54);
	// Never leave less than one line below it.
	expect(guideOffsetPx(80, 54)).toBe(26);
	expect(guideOffsetPx(40, 54)).toBe(0);
});
test("reserved chrome keeps the reading line at the same screen position", () => {
	const playing = guideOffsetPx(760, 54);
	const paused = guideOffsetPx(660, 54, 100);
	expect(paused + 100).toBe(playing);
	// It never moves below the last full line.
	expect(guideOffsetPx(100, 54, 300)).toBeLessThanOrEqual(46);
	expect(guideOffsetPx(200, 54, 400)).toBe(0);
});
test("invalid geometry falls back to the stage top", () => {
	expect(guideOffsetPx(Number.NaN, 54)).toBe(0);
	expect(guideOffsetPx(500, Number.POSITIVE_INFINITY)).toBe(125);
	expect(guideOffsetPx(500, 50, Number.NaN)).toBe(125);
});
test("dim covers only lines fully above the reading line", () => {
	expect(dimHeightPx(190, 54)).toBe(136);
	expect(dimHeightPx(54, 54)).toBe(0);
	expect(dimHeightPx(20, 54)).toBe(0);
});
