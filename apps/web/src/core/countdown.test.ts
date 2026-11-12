import { expect, test } from "bun:test";
import { countdownValue } from "./countdown";

test("each countdown numeral occupies a full second", () => {
	for (const [elapsed, n] of [
		[0, 3],
		[999, 3],
		[1000, 2],
		[1999, 2],
		[2000, 1],
		[2999, 1],
		[3000, null],
		[10000, null],
	] as const)
		expect(countdownValue(elapsed + 50, 50)).toBe(n);
	expect(countdownValue(0, 100)).toBe(3);
});
