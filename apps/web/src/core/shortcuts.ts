export interface KeyInput {
	key: string;
	targetKind?: "editable" | "button" | "other";
	isComposing?: boolean;
	keyCode?: number;
	ctrlKey?: boolean;
	metaKey?: boolean;
	altKey?: boolean;
	repeat?: boolean;
	defaultPrevented?: boolean;
}
export type Shortcut =
	| "toggle"
	| "slower"
	| "faster"
	| "seek-back"
	| "seek-forward"
	| "page-back"
	| "page-forward"
	| "start"
	| "end"
	| "restart"
	| "mirror"
	| "guide"
	| "smaller"
	| "larger"
	| "fullscreen"
	| "escape";
/**
 * Adapted from Pocket Teleprompter, Copyright (c) 2026 ttomohisa, MIT License.
 * https://github.com/ttomohisa/htmlapps-pocket-teleprompter/blob/ad05bf6202bdb9a20e168e1f67521f0a73de90a5/src/index.template.html#L403
 */
export function mapKey(e: KeyInput): Shortcut | null {
	if (
		e.defaultPrevented ||
		e.targetKind === "editable" ||
		e.isComposing ||
		e.keyCode === 229 ||
		e.ctrlKey ||
		e.metaKey ||
		e.altKey
	)
		return null;
	if (e.targetKind === "button" && (e.key === " " || e.key === "Enter"))
		return null;
	const key = e.key.toLowerCase();
	if ((key === " " || key === "k") && e.repeat) return null;
	const actions: Record<string, Shortcut> = {
		" ": "toggle",
		k: "toggle",
		arrowleft: "slower",
		arrowright: "faster",
		arrowup: "seek-back",
		arrowdown: "seek-forward",
		pageup: "page-back",
		pagedown: "page-forward",
		home: "start",
		end: "end",
		r: "restart",
		m: "mirror",
		g: "guide",
		"-": "smaller",
		"=": "larger",
		f: "fullscreen",
		escape: "escape",
	};
	return actions[key] ?? null;
}
