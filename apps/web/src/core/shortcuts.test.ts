import { expect, test } from "bun:test";
import { type KeyInput, mapKey, type Shortcut } from "./shortcuts";

test("all documented reader keys map", () => {
	const keys: Record<string, Shortcut> = {
		" ": "toggle",
		K: "toggle",
		ArrowLeft: "slower",
		ArrowRight: "faster",
		ArrowUp: "seek-back",
		ArrowDown: "seek-forward",
		PageUp: "page-back",
		PageDown: "page-forward",
		Home: "start",
		End: "end",
		R: "restart",
		M: "mirror",
		G: "guide",
		"-": "smaller",
		"=": "larger",
		F: "fullscreen",
		Escape: "escape",
	};
	for (const [key, action] of Object.entries(keys))
		expect(mapKey({ key })).toBe(action);
	expect(mapKey({ key: "z" })).toBeNull();
});
test("editable fields, composition and modified/native button keys are untouched", () => {
	const blockers: Partial<KeyInput>[] = [
		{ targetKind: "editable" },
		{ isComposing: true },
		{ keyCode: 229 },
		{ ctrlKey: true },
		{ metaKey: true },
		{ altKey: true },
		{ defaultPrevented: true },
	];
	for (const blocker of blockers)
		expect(mapKey({ key: "r", ...blocker })).toBeNull();
	expect(mapKey({ key: " ", repeat: true })).toBeNull();
	expect(mapKey({ key: "K", repeat: true })).toBeNull();
	expect(mapKey({ key: " ", targetKind: "button" })).toBeNull();
	expect(mapKey({ key: "Enter", targetKind: "button" })).toBeNull();
	expect(mapKey({ key: "ArrowRight", repeat: true })).toBe("faster");
});
