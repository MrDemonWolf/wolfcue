import { expect, test } from "bun:test";
import { resolveTheme } from "./theme";

test("system tracks appearance and explicit choices override it", () => {
	expect(resolveTheme("system", true)).toBe("dark");
	expect(resolveTheme("system", false)).toBe("light");
	expect(resolveTheme("light", true)).toBe("light");
	expect(resolveTheme("dark", false)).toBe("dark");
});
