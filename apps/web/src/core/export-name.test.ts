import { expect, test } from "bun:test";
import {
	defaultExportName,
	FALLBACK_FILE_NAME,
	textFileName,
} from "./export-name";

test("filenames use upstream sanitization with WolfCue fallback", () => {
	for (const [raw, expected] of [
		["", FALLBACK_FILE_NAME],
		["  話す 🐺.TXT  ", "話す 🐺.txt"],
		["../../notes.txt", "notes.txt"],
		["C:\\fakepath\\notes.txt", "notes.txt"],
		['a<>:"|?*\0.txt', "a_______.txt"],
		["CON.txt", "_CON.txt"],
		["demo.pdf", "demo.pdf.txt"],
		["...  ", FALLBACK_FILE_NAME],
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

test("default export names carry the local date and survive sanitizing", () => {
	const name = defaultExportName(new Date(2026, 0, 5, 23, 59));
	expect(name).toBe("wolfcue-script-2026-01-05.txt");
	expect(textFileName(name)).toBe(name);
	expect(FALLBACK_FILE_NAME).toBe("wolfcue-script.txt");
});
