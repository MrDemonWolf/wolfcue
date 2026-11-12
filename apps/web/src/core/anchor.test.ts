import { expect, test } from "bun:test";
import { captureAnchor, resolveAnchor } from "./anchor";

const blocks = (h: number) =>
	Array.from({ length: 20 }, (_, i) => ({ top: i * h, height: h }));
test("resizing and changing font size retain the same block and fraction", () => {
	const a = captureAnchor(blocks(54), 54 * 7.3, 1080);
	expect(a.block).toBe(7);
	expect(a.fraction).toBeCloseTo(0.3);
	for (const height of [18, 54, 96, 144]) {
		const px = resolveAnchor(blocks(height), a, 20 * height);
		expect(px).toBeCloseTo(height * 7.3);
	}
});
test("start/end stay start/end and missing blocks use ratio", () => {
	const b = blocks(54);
	expect(resolveAnchor(blocks(100), captureAnchor(b, 0, 1080), 2000)).toBe(0);
	expect(resolveAnchor(blocks(100), captureAnchor(b, 1080, 1080), 2000)).toBe(
		2000,
	);
	expect(resolveAnchor([], captureAnchor(b, 540, 1080), 2000)).toBe(1000);
	expect(resolveAnchor([], captureAnchor([], 0, 0), 0)).toBe(0);
	expect(captureAnchor([{ top: 0, height: 0 }], 0, 0).fraction).toBe(0);
});

test("uneven wrapping restores the fraction inside the same original script line", () => {
	const before = [
		{ top: 0, height: 30 },
		{ top: 30, height: 100 },
		{ top: 130, height: 20 },
	];
	const anchor = captureAnchor(before, 80, 150);
	expect(anchor).toEqual({ block: 1, fraction: 0.5, ratio: 80 / 150 });
	const after = [
		{ top: 0, height: 60 },
		{ top: 60, height: 200 },
		{ top: 260, height: 40 },
	];
	expect(resolveAnchor(after, anchor, 300)).toBe(160);
	expect(resolveAnchor([{ top: 0, height: 60 }], anchor, 300)).toBe(160);
});
