import { expect, test } from "bun:test";

const css = await Bun.file(
	new URL("../styles/tokens.css", import.meta.url),
).text();
const themes = [...css.matchAll(/\{([^{}]*--bg:[^{}]*)\}/g)].map((match) => {
	const tokens = Object.fromEntries(
		[...(match[1] ?? "").matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map(
			(token) => [token[1], token[2]],
		),
	);
	function get(name: string): string {
		const value = tokens[name];
		if (!value) throw new Error(`Missing token ${name}`);
		return value;
	}
	return {
		bg: get("bg"),
		surface: get("surface"),
		text: get("text"),
		muted: get("text-muted"),
		strong: get("line-strong"),
		brand: get("brand"),
		ink: get("brand-ink"),
		accent: get("brand-text"),
		focus: get("focus"),
		danger: get("danger"),
	};
});
function luminance(hex: string) {
	const v = [1, 3, 5].map((i) => {
		const n = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
		return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
	});
	return (v[0] ?? 0) * 0.2126 + (v[1] ?? 0) * 0.7152 + (v[2] ?? 0) * 0.0722;
}
function ratio(a: string, b: string) {
	const x = luminance(a);
	const y = luminance(b);
	return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
test("light and dark text, borders, brand fills and focus have accessible contrast", () => {
	expect(themes).toHaveLength(3);
	for (const t of themes) {
		for (const bg of [t.bg, t.surface]) {
			for (const fg of [t.text, t.muted, t.accent, t.danger])
				expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
			for (const fg of [t.strong, t.focus])
				expect(ratio(fg, bg)).toBeGreaterThanOrEqual(3);
		}
		expect(ratio(t.ink, t.brand)).toBeGreaterThanOrEqual(4.5);
	}
});

test("docs text and accents stay readable on neutral surfaces", async () => {
	const docs = await Bun.file(
		new URL("../../../docs/src/app/global.css", import.meta.url),
	).text();
	const palettes = [
		...docs.matchAll(/\{([^{}]*--color-fd-background:[^{}]*)\}/g),
	];
	expect(palettes).toHaveLength(2);
	for (const palette of palettes) {
		const colors = Object.fromEntries(
			[
				...(palette[1] ?? "").matchAll(
					/--color-fd-([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi,
				),
			].map((m) => [m[1], m[2]]),
		);
		function color(name: string) {
			const value = colors[name];
			if (!value) throw new Error(`Missing docs color ${name}`);
			return value;
		}
		for (const bg of ["background", "card", "popover", "muted", "secondary"]) {
			for (const fg of ["foreground", "muted-foreground"])
				expect(ratio(color(fg), color(bg))).toBeGreaterThanOrEqual(4.5);
			expect(ratio(color("ring"), color(bg))).toBeGreaterThanOrEqual(3);
		}
		expect(
			ratio(color("primary"), color("primary-foreground")),
		).toBeGreaterThanOrEqual(4.5);
		expect(
			ratio(color("accent"), color("accent-foreground")),
		).toBeGreaterThanOrEqual(4.5);
	}
});
