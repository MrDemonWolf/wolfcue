import { expect, test } from "bun:test";
import { splitCues, spokenText } from "./cues";
import { countWords } from "./words";

test("actions between single asterisks split out in order", () => {
	expect(splitCues("*smile* Welcome back *wave*")).toEqual([
		{ text: "smile", action: true },
		{ text: " Welcome back ", action: false },
		{ text: "wave", action: true },
	]);
	expect(splitCues("Pause here. *look at camera*")).toEqual([
		{ text: "Pause here. ", action: false },
		{ text: "look at camera", action: true },
	]);
	expect(splitCues("*x*")).toEqual([{ text: "x", action: true }]);
	expect(splitCues("Plain line")).toEqual([
		{ text: "Plain line", action: false },
	]);
	expect(splitCues("")).toEqual([]);
});
test("asterisks that are not action markers stay literal", () => {
	for (const line of [
		"5*3*2 is thirty",
		"**bold** stays",
		"* spaced *",
		"a * b",
		"*unclosed",
		"wo*rd*s",
		"**",
	])
		expect(splitCues(line)).toEqual([{ text: line, action: false }]);
});
test("cues keep Unicode and literal markup as text", () => {
	expect(splitCues("*話す 🐺* <b>ok</b>")).toEqual([
		{ text: "話す 🐺", action: true },
		{ text: " <b>ok</b>", action: false },
	]);
	expect(splitCues("(*laughs*)")).toEqual([
		{ text: "(", action: false },
		{ text: "laughs", action: true },
		{ text: ")", action: false },
	]);
});
test("actions do not count as spoken words", () => {
	expect(countWords(spokenText("*smile* Welcome back *wave to chat*"))).toBe(2);
	expect(countWords(spokenText("5*3*2 equals thirty"))).toBe(
		countWords("5*3*2 equals thirty"),
	);
	expect(spokenText("line one *pause*\nline two")).toBe("line one  \nline two");
});
