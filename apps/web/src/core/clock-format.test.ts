import { expect, test } from "bun:test";
import { formatClock } from "./clock-format";

test("elapsed floors, remaining ceils and hours are explicit", () => {
	expect(formatClock(59.9, "floor")).toBe("0:59");
	expect(formatClock(59.1, "ceil")).toBe("1:00");
	expect(formatClock(3600)).toBe("1:00:00");
	expect(formatClock(3661)).toBe("1:01:01");
	for (const v of [-1, Number.NaN, Number.POSITIVE_INFINITY])
		expect(formatClock(v)).toBe("0:00");
});
