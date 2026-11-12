import { expect, test } from "@playwright/test";
import { openApp, start } from "./helpers";

test("compact editor keeps its header on one row and steppers have visible keyboard focus", async ({
	page,
}) => {
	await page.setViewportSize({ width: 250, height: 250 });
	await openApp(page);
	const logo = await page.locator(".wordmark").boundingBox();
	const settings = await page.locator("#editor-settings").boundingBox();
	if (!logo || !settings) throw new Error("Editor header missing");
	expect(
		Math.abs(logo.y + logo.height / 2 - settings.y - settings.height / 2),
	).toBeLessThan(1);
	await page.keyboard.press("Tab");
	for (const selector of [
		'[data-adjust="wpm"][data-delta="-5"]',
		"#wpm",
		'[data-adjust="wpm"][data-delta="5"]',
	]) {
		const control = page.locator(selector);
		await control.focus();
		const css = await control.evaluate((element) => {
			const style = getComputedStyle(element);
			return {
				width: style.outlineWidth,
				offset: style.outlineOffset,
				style: style.outlineStyle,
			};
		});
		expect(css).toEqual({ width: "3px", offset: "-4px", style: "solid" });
	}
	await page.locator('[data-adjust="wpm"][data-delta="5"]').click();
	await expect(page.locator("#wpm")).toHaveValue("155");
});

test("enlarged target time stays readable and its controls fit compact widths", async ({
	page,
}, info) => {
	test.skip(
		info.project.name !== "iphone-portrait",
		"Explicit viewport matrix",
	);
	await openApp(page, { paceMode: "target", targetSec: 3600 });
	await page.evaluate(() => {
		const panel = document.querySelector<HTMLElement>(".setup-panel");
		const label = document.querySelector<HTMLElement>(
			'[data-pace="target"] label',
		);
		const input = document.querySelector<HTMLInputElement>("#target-seconds");
		if (!panel || !label || !input) throw new Error("Target controls missing");
		panel.style.fontSize = "32px";
		label.style.fontSize = "26px";
		input.style.fontSize = "40px";
		input.style.letterSpacing = "0.12em";
	});
	for (const width of [200, 250, 320, 390]) {
		await page.setViewportSize({ width, height: 844 });
		const input = page.locator("#target-seconds");
		await expect(input).toHaveValue("3600");
		const geometry = await input.evaluate((element) => ({
			width: element.clientWidth,
			scroll: element.scrollWidth,
			box: element.getBoundingClientRect().toJSON(),
			parent: element.closest(".stepper")?.getBoundingClientRect().toJSON(),
		}));
		expect(geometry.scroll, `${width}px value`).toBeLessThanOrEqual(
			geometry.width,
		);
		expect(geometry.box.left).toBeGreaterThanOrEqual(
			geometry.parent?.left ?? 0,
		);
		expect(geometry.box.right).toBeLessThanOrEqual(
			geometry.parent?.right ?? width,
		);
		for (const button of await page
			.locator('[data-pace="target"] button')
			.all()) {
			const box = await button.boundingBox();
			if (!box) throw new Error("Target stepper button missing");
			expect(box.width).toBeGreaterThanOrEqual(44);
			expect(box.height).toBeGreaterThanOrEqual(44);
			expect(box.x + box.width).toBeLessThanOrEqual(width);
		}
	}
});

test("editor stays on one desktop screen and keeps the phone primary action in view", async ({
	page,
}, info) => {
	test.skip(
		info.project.name !== "iphone-portrait",
		"Explicit viewport matrix",
	);
	for (const theme of ["light", "dark"] as const) {
		await page.emulateMedia({ colorScheme: theme });
		for (const viewport of [
			{ width: 1920, height: 1080 },
			{ width: 1920, height: 900 },
			{ width: 1366, height: 768 },
			{ width: 390, height: 844 },
		]) {
			await page.setViewportSize(viewport);
			await openApp(page);
			for (const mode of ["wpm", "target"]) {
				await page.locator(`#pace-mode input[value="${mode}"]`).check();
				await page.evaluate(() => scrollTo(0, 0));
				const startBox = await page.locator("#start-reading").boundingBox();
				expect(startBox).not.toBeNull();
				expect(
					(startBox?.y ?? 0) + (startBox?.height ?? 0),
				).toBeLessThanOrEqual(viewport.height);
				const pageSize = await page.evaluate(() => ({
					width: document.documentElement.scrollWidth,
					height: document.documentElement.scrollHeight,
				}));
				expect(pageSize.width).toBeLessThanOrEqual(viewport.width);
				if (viewport.width >= 1100) {
					expect(pageSize.height).toBeLessThanOrEqual(viewport.height);
					const footer = await page.locator(".site-footer").boundingBox();
					expect((footer?.y ?? 0) + (footer?.height ?? 0)).toBeLessThanOrEqual(
						viewport.height,
					);
					expect(
						await page.locator("#script").evaluate((el) => el.scrollHeight),
					).toBeGreaterThan(
						await page.locator("#script").evaluate((el) => el.clientHeight),
					);
				}
			}
		}
	}
});

test("settings disclose reader controls in context and Done stays visible while scrolling", async ({
	page,
}) => {
	await page.setViewportSize({ width: 250, height: 250 });
	await openApp(page);
	await page.locator("#editor-settings").click();
	await expect(page.locator("#settings-pace-mode")).toBeHidden();
	await expect(page.locator("#settings-size")).toBeHidden();
	await expect(page.locator("#line-spacing")).toBeVisible();
	for (const width of [250, 200]) {
		await page.setViewportSize({ width, height: width === 200 ? 180 : 250 });
		await page.locator("#settings-dialog .dialog-body").evaluate((el) => {
			el.scrollTop = el.scrollHeight;
		});
		expect(
			await page
				.locator("#settings-dialog .dialog-body")
				.evaluate((el) => el.scrollTop),
		).toBeGreaterThan(0);
		const dialog = await page.locator("#settings-dialog").boundingBox();
		const done = await page
			.getByRole("button", { name: "Done", exact: true })
			.boundingBox();
		expect(done?.y).toBeGreaterThanOrEqual(dialog?.y ?? 0);
		expect((done?.y ?? 0) + (done?.height ?? 0)).toBeLessThanOrEqual(
			(dialog?.y ?? 0) + (dialog?.height ?? 0),
		);
	}
	await page.getByRole("button", { name: "Done", exact: true }).click();
	await start(page);
	await page.locator("#reader-settings").click();
	await expect(page.locator("#settings-pace-mode")).toBeVisible();
	await page.locator("#settings-size").scrollIntoViewIfNeeded();
	await expect(page.locator("#settings-size")).toBeVisible();
	await page.getByRole("button", { name: "Done", exact: true }).click();
	await expect(page.locator("#reader")).toBeVisible();
	await expect(page.locator("#toggle-play")).toHaveText("Resume");
});

test("copy script link is reachable before filename fields in a compact export dialog", async ({
	page,
}) => {
	await page.setViewportSize({ width: 250, height: 250 });
	await openApp(page);
	await page.locator("#export").click();
	const dialog = await page.locator("#export-dialog").boundingBox();
	const link = await page.locator("#copy-script-link").boundingBox();
	expect((link?.y ?? 0) + (link?.height ?? 0)).toBeLessThanOrEqual(
		(dialog?.y ?? 0) + (dialog?.height ?? 0),
	);
	await expect(page.locator("#script-link-hint")).toBeHidden();
	await page.locator("#copy-script-link").click();
	await expect(page.locator("#script-link")).toBeVisible();
	await expect(page.locator("#script-link-hint")).toBeVisible();
	await page.getByRole("button", { name: "Done", exact: true }).click();
	await page.locator("#export").click();
	await expect(page.locator("#script-link-hint")).toBeHidden();
});

test("supported fullscreen controls have room and remain reachable in Settings", async ({
	page,
}, info) => {
	test.skip(
		info.project.name !== "iphone-portrait",
		"Explicit viewport matrix",
	);
	await page.addInitScript(() => {
		Object.defineProperty(document, "fullscreenEnabled", {
			value: true,
			configurable: true,
		});
		Element.prototype.requestFullscreen = async () => {};
	});
	await page.setViewportSize({ width: 584, height: 890 });
	await openApp(page);
	await page.locator("#editor-settings").click();
	const dialog = page.locator("#settings-dialog");
	const row = page.locator("#fullscreen-setting-row");
	const button = page.locator("#fullscreen-toggle");
	const wakeRow = page.locator("#keep-awake").locator("..");
	const hint = page
		.locator("fieldset")
		.filter({ has: page.locator("#keep-awake") })
		.locator(".hint");
	const done = page.getByRole("button", { name: "Done", exact: true });
	await expect(row).toBeVisible();
	await expect(button).toHaveAccessibleName("Enter fullscreen");
	for (const viewport of [
		{ width: 584, height: 890 },
		{ width: 200, height: 180 },
	]) {
		await page.setViewportSize(viewport);
		const boxes = await Promise.all(
			[wakeRow, hint, row, button].map((element) => element.boundingBox()),
		);
		const [wakeBox, hintBox, rowBox, buttonBox] = boxes;
		if (!wakeBox || !hintBox || !rowBox || !buttonBox)
			throw new Error("Fullscreen settings are missing");
		expect(hintBox.y - (wakeBox.y + wakeBox.height)).toBeGreaterThanOrEqual(8);
		expect(rowBox.y - (hintBox.y + hintBox.height)).toBeGreaterThanOrEqual(8);
		expect(buttonBox.y - (rowBox.y + rowBox.height)).toBeGreaterThanOrEqual(8);
		expect(buttonBox.width).toBeGreaterThanOrEqual(44);
		expect(buttonBox.height).toBeGreaterThanOrEqual(44);
		for (const control of [page.locator("#fullscreen-setting"), button]) {
			await control.focus();
			await expect(control).toBeFocused();
			const controlBox = await control.boundingBox();
			const headerBox = await dialog.locator(".dialog-heading").boundingBox();
			const dialogBox = await dialog.boundingBox();
			if (!controlBox || !headerBox || !dialogBox)
				throw new Error("Settings geometry is missing");
			expect(controlBox.y).toBeGreaterThanOrEqual(
				headerBox.y + headerBox.height,
			);
			expect(controlBox.y + controlBox.height).toBeLessThanOrEqual(
				dialogBox.y + dialogBox.height,
			);
			await expect(done).toBeVisible();
			const doneBox = await done.boundingBox();
			if (!doneBox) throw new Error("Done button is missing");
			expect(doneBox.y).toBeGreaterThanOrEqual(dialogBox.y);
			expect(doneBox.y + doneBox.height).toBeLessThanOrEqual(
				dialogBox.y + dialogBox.height,
			);
		}
	}
});
