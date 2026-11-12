import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { openApp, start } from "./helpers";

function rgb(value: string) {
	const channels = value
		.match(/[\d.]+/g)
		?.slice(0, 3)
		.map(Number);
	if (channels?.length !== 3) throw new Error(`Unsupported color: ${value}`);
	return channels;
}
function contrast(foreground: number[], background: number[]) {
	const luminance = (channels: number[]) => {
		const linear = channels.map((channel) => {
			const value = channel / 255;
			return value <= 0.04045
				? value / 12.92
				: ((value + 0.055) / 1.055) ** 2.4;
		});
		return linear.reduce(
			(sum, channel, index) =>
				sum + channel * ([0.2126, 0.7152, 0.0722][index] ?? 0),
			0,
		);
	};
	const a = luminance(foreground);
	const b = luminance(background);
	return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

for (const theme of ["light", "dark"] as const) {
	test(`reader and settings have no automated WCAG A/AA or enhanced contrast violations in ${theme}`, async ({
		page,
	}, info) => {
		await page.emulateMedia({ colorScheme: theme });
		await openApp(page);
		await start(page);
		for (const state of ["playing", "paused", "settings"]) {
			if (state === "paused") await page.locator("#toggle-play").click();
			if (state === "settings") await page.locator("#reader-settings").click();
			const phase = await page.locator("#reader").getAttribute("data-phase");
			const result = await new AxeBuilder({ page })
				// Keep visibility-sensitive playback in the page being checked.
				.setLegacyMode(true)
				.options({
					runOnly: {
						type: "tag",
						values: [
							"wcag2a",
							"wcag2aa",
							"wcag21a",
							"wcag21aa",
							"wcag22aa",
							"wcag2aaa",
							"best-practice",
						],
					},
					rules: {
						"color-contrast-enhanced": { enabled: true },
						"identical-links-same-purpose": { enabled: true },
						"meta-refresh-no-exceptions": { enabled: true },
					},
				})
				.analyze();
			await info.attach(`${theme}-${state}-axe`, {
				body: JSON.stringify(result, null, 2),
				contentType: "application/json",
			});
			expect(result.violations, `${theme} ${state}`).toEqual([]);
			await expect(page.locator("#reader")).toHaveAttribute(
				"data-phase",
				phase ?? "",
			);
			const colors = await page.evaluate(() => {
				const reader = document.querySelector<HTMLElement>("#reader");
				const dialog =
					document.querySelector<HTMLDialogElement>("#settings-dialog");
				const script = document.querySelector<HTMLElement>("#script-content");
				const dim = document.querySelector("#read-dim");
				const guide = document.querySelector("#reading-guide");
				if (!reader || !dialog || !script || !dim || !guide)
					throw new Error("Reader contrast elements missing");
				const readerBackground = getComputedStyle(reader).backgroundColor;
				const inDialog = dialog.open;
				const root = inDialog ? dialog : reader;
				const background = inDialog
					? getComputedStyle(dialog).backgroundColor
					: readerBackground;
				return {
					text: Array.from(
						root.querySelectorAll<HTMLElement>(
							"button, output, legend, .hint, .seek-label, .reader-notice, #script-content, #over-target",
						),
					)
						.filter((element) =>
							element.checkVisibility({ visibilityProperty: true }),
						)
						.filter((element) => !element.matches(":disabled"))
						.map((element) => {
							const css = getComputedStyle(element);
							return {
								name: element.id || element.textContent?.slice(0, 40),
								color: css.color,
								background: element.matches("button")
									? css.backgroundColor
									: background,
							};
						}),
					script: getComputedStyle(script).color,
					background: readerBackground,
					dim: Number(getComputedStyle(dim).opacity),
					guide: getComputedStyle(guide).borderTopColor,
					guideOpacity: getComputedStyle(guide).opacity,
				};
			});
			for (const pair of colors.text) {
				expect(
					contrast(rgb(pair.color), rgb(pair.background)),
					`${theme} ${state} ${pair.name} enhanced text contrast`,
				).toBeGreaterThanOrEqual(7);
			}
			const background = rgb(colors.background);
			expect(colors.guideOpacity).toBe("1");
			expect(contrast(rgb(colors.guide), background)).toBeGreaterThanOrEqual(3);
			const dimmed = rgb(colors.script).map(
				(channel, index) =>
					channel * (1 - colors.dim) + (background[index] ?? 0) * colors.dim,
			);
			expect(contrast(dimmed, background)).toBeGreaterThanOrEqual(7);
		}
	});
}

for (const theme of ["light", "dark"] as const) {
	test(`compact keyboard focus has an unclipped AAA-sized indicator in ${theme}`, async ({
		page,
	}) => {
		await page.setViewportSize({ width: 200, height: 180 });
		await page.emulateMedia({ colorScheme: theme });
		await openApp(page);
		await start(page);
		await page.locator("#toggle-play").click();
		await page.keyboard.press("Tab");
		for (const selector of ["#toggle-play", "#reader-settings"]) {
			const button = page.locator(selector);
			await button.focus();
			const focus = await button.evaluate((element) => {
				const css = getComputedStyle(element);
				return {
					box: element.getBoundingClientRect().toJSON(),
					width: Number.parseFloat(css.outlineWidth),
					offset: Number.parseFloat(css.outlineOffset),
					radius: Number.parseFloat(css.borderTopLeftRadius),
					color: css.outlineColor,
					background: css.backgroundColor,
				};
			});
			const outer = -focus.offset - focus.width;
			const inner = -focus.offset;
			const ringArea = (inset: number) =>
				(focus.box.width - 2 * inset) * (focus.box.height - 2 * inset) -
				(4 - Math.PI) * Math.max(0, focus.radius - inset) ** 2;
			expect(ringArea(outer) - ringArea(inner)).toBeGreaterThanOrEqual(
				4 * (focus.box.width + focus.box.height),
			);
			expect(
				contrast(rgb(focus.color), rgb(focus.background)),
			).toBeGreaterThanOrEqual(3);
			expect(focus.box.x + outer).toBeGreaterThanOrEqual(0);
			expect(focus.box.y + outer).toBeGreaterThanOrEqual(0);
			expect(focus.box.right - outer).toBeLessThanOrEqual(200);
			expect(focus.box.bottom - outer).toBeLessThanOrEqual(180);
		}
		await page.keyboard.press("Enter");
		const dialog = page.locator("#settings-dialog");
		await expect(dialog).toBeVisible();
		expect(
			await dialog.locator(".dialog-heading").evaluate((el) => el.clientHeight),
		).toBeLessThanOrEqual(80);
		expect(
			await dialog.locator(".dialog-body").evaluate((el) => el.clientHeight),
		).toBeGreaterThanOrEqual(80);
	});
}

test("reader reflows at 320 CSS pixels with 200 percent text and custom spacing", async ({
	page,
}) => {
	await page.setViewportSize({ width: 320, height: 256 });
	await openApp(page);
	await start(page);
	await page.locator("#toggle-play").click();
	await page.evaluate(() => {
		const sizes = Array.from(
			document.querySelectorAll<HTMLElement>("body *"),
		).map((element) => ({
			element,
			size: Number.parseFloat(getComputedStyle(element).fontSize),
		}));
		for (const { element, size } of sizes) {
			element.style.setProperty("font-size", `${size * 2}px`, "important");
			element.style.setProperty("line-height", "1.5", "important");
			element.style.setProperty("letter-spacing", "0.12em", "important");
			element.style.setProperty("word-spacing", "0.16em", "important");
			if (element.matches("p, .script-line"))
				element.style.setProperty("margin-bottom", "2em", "important");
		}
	});
	await expect(page.locator("#toggle-play")).toHaveCSS("font-size", "28px");
	expect(
		await page.evaluate(() => document.documentElement.scrollWidth),
	).toBeLessThanOrEqual(320);
	for (const selector of ["#toggle-play", "#reader-settings"]) {
		const box = await page.locator(selector).boundingBox();
		if (!box) throw new Error("Resized control missing");
		expect(box.x).toBeGreaterThanOrEqual(0);
		expect(box.x + box.width).toBeLessThanOrEqual(320);
		expect(box.y + box.height).toBeLessThanOrEqual(256);
	}
	await page.locator("#reader-settings").focus();
	await page.keyboard.press("Enter");
	await expect(page.locator("#settings-dialog")).toBeVisible();
	expect(
		await page.evaluate(() => document.documentElement.scrollWidth),
	).toBeLessThanOrEqual(320);
	for (const selector of [
		"#restart",
		"#exit-reader",
		"#seek",
		"#settings-size",
		"#keep-awake",
	]) {
		await page.locator(selector).focus();
		await expect
			.poll(async () =>
				page.locator(selector).evaluate((element) => {
					const control = element.getBoundingClientRect();
					const header = document
						.querySelector(".dialog-heading")
						?.getBoundingClientRect();
					const dialog = document
						.querySelector("#settings-dialog")
						?.getBoundingClientRect();
					return Math.max(
						(header?.bottom ?? 0) - control.top,
						control.bottom - (dialog?.bottom ?? 256),
					);
				}),
			)
			.toBeLessThanOrEqual(1);
		const geometry = await page.locator(selector).evaluate((element) => ({
			control: element.getBoundingClientRect().toJSON(),
			header: document
				.querySelector(".dialog-heading")
				?.getBoundingClientRect()
				.toJSON(),
			dialog: document
				.querySelector("#settings-dialog")
				?.getBoundingClientRect()
				.toJSON(),
		}));
		expect(geometry.control.left).toBeGreaterThanOrEqual(
			geometry.dialog?.left ?? 0,
		);
		expect(geometry.control.right).toBeLessThanOrEqual(
			geometry.dialog?.right ?? 320,
		);
		expect(geometry.control.top).toBeGreaterThanOrEqual(
			geometry.header?.bottom ?? 0,
		);
		expect(geometry.control.bottom).toBeLessThanOrEqual(
			geometry.dialog?.bottom ?? 256,
		);
	}
	await page.keyboard.press("Escape");
	await expect(page.locator("#reader-settings")).toBeFocused();
	await expect(page.locator("#reader")).toHaveAttribute("data-phase", "paused");
});
