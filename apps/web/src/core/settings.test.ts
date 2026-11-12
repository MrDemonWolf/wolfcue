import { expect, test } from "bun:test";
import { DEFAULT_SETTINGS, sanitizeSettings } from "./settings";

test("invalid types use field defaults without coercion", () => {
	for (const raw of [
		null,
		[],
		"x",
		true,
		{},
		{
			wpm: "240",
			mirror: "true",
			countdown: 0,
			fontSizePx: Number.NaN,
			targetSec: Number.POSITIVE_INFINITY,
		},
	])
		expect(sanitizeSettings(raw)).toEqual(DEFAULT_SETTINGS);
});
test("valid fields and bounds are retained independently", () => {
	const s = sanitizeSettings({
		wpm: 500,
		targetSec: 1,
		fontSizePx: 500,
		lineHeight: -1,
		align: "center",
		mirror: true,
		guide: false,
		countdown: false,
		keepAwake: false,
		fullscreen: true,
		theme: "dark",
		paceMode: "target",
	});
	expect(s).toEqual({
		...DEFAULT_SETTINGS,
		wpm: 300,
		targetSec: 10,
		fontSizePx: 96,
		lineHeight: 1.2,
		align: "center",
		mirror: true,
		guide: false,
		countdown: false,
		keepAwake: false,
		fullscreen: true,
		theme: "dark",
		paceMode: "target",
	});
});
