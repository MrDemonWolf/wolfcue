import { expect, test } from "bun:test";
import { textFileName } from "./export-name";

test("filenames use upstream sanitization with WolfCue fallback", () => {
	for (const [raw, expected] of [
		["", "wolfcue.txt"],
		["  話す 🐺.TXT  ", "話す 🐺.txt"],
		["../../notes.txt", "notes.txt"],
		["C:\\fakepath\\notes.txt", "notes.txt"],
		['a<>:"|?*\0.txt', "a_______.txt"],
		["CON.txt", "_CON.txt"],
		["demo.pdf", "demo.pdf.txt"],
		["...  ", "wolfcue.txt"],
		["a\u202ab.txt", "ab.txt"],
	])
		expect(textFileName(raw ?? "")).toBe(expected ?? "");
	for (const c of ["あ", "🐺"]) {
		const name = textFileName(c.repeat(180));
		expect(new TextEncoder().encode(name).length).toBeLessThanOrEqual(240);
		expect(name).not.toContain("�");
	}
});

test("reserved filesystem names are escaped without stripping arbitrary Unicode", () => {
	for (const name of [
		"CON",
		"prn",
		"AUX",
		"nul",
		"COM1",
		"com9",
		"LPT1",
		"lpt9",
	])
		expect(textFileName(`${name}.txt`)).toBe(`_${name}.txt`);
	expect(textFileName("COM10.txt")).toBe("COM10.txt");
	expect(textFileName("a\u2066b.txt")).toBe("ab.txt");
});
