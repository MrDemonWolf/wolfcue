import { expect, test } from "@playwright/test";
import { openApp, start } from "./helpers";

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
