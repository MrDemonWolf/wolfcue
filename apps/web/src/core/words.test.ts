import { expect, test } from "bun:test";
import { countWords } from "./words";

test("word count supports Unicode and blank text", () => {
	expect(countWords("Hello world")).toBe(2);
	expect(countWords("  ")).toBe(0);
	expect(countWords("日本語の文章")).toBeGreaterThan(0);
	expect(countWords("Wolf 🐺")).toBe(1);
});
test("whitespace fallback works without Segmenter", () => {
	const original = Intl.Segmenter;
	try {
		Object.defineProperty(Intl, "Segmenter", {
			value: undefined,
			configurable: true,
		});
		expect(countWords(" one  two ")).toBe(2);
		expect(countWords(" ")).toBe(0);
	} finally {
		Object.defineProperty(Intl, "Segmenter", {
			value: original,
			configurable: true,
		});
	}
});
