import { expect, type Page, test } from "@playwright/test";
import { hidePage, openApp, start } from "./helpers";

async function expectReadableLine(page: Page, index: number) {
	const readGeometry = () =>
		page.locator("#stage").evaluate((stage, lineIndex) => {
			const line =
				document.querySelector<HTMLElement>("#script-content")?.children[
					lineIndex
				];
			const guide = document.querySelector("#reading-guide");
			if (!line || !guide) throw new Error("Reader line or guide missing");
			return {
				stage: stage.getBoundingClientRect().toJSON(),
				line: line.getBoundingClientRect().toJSON(),
				guide: guide.getBoundingClientRect().toJSON(),
			};
		}, index);
	await expect
		.poll(async () => {
			const geometry = await readGeometry();
			return Math.max(
				geometry.stage.top - geometry.line.top,
				geometry.line.bottom - geometry.stage.bottom,
				Math.abs(geometry.line.top - geometry.guide.top),
				geometry.line.height - geometry.stage.height,
			);
		})
		.toBeLessThanOrEqual(0.4);
	const geometry = await readGeometry();
	expect(geometry.line.top).toBeGreaterThanOrEqual(geometry.stage.top - 1);
	expect(geometry.line.top).toBeCloseTo(geometry.guide.top, 0);
	expect(geometry.line.bottom).toBeLessThanOrEqual(geometry.stage.bottom + 1);
	expect(geometry.stage.height).toBeGreaterThanOrEqual(geometry.line.height);
}

for (const lineHeight of [1.5, 2]) {
	test(`compact reader keeps a whole line with capped pace and wake denial at line spacing ${lineHeight}`, async ({
		page,
	}) => {
		await page.addInitScript(() => {
			Object.defineProperty(navigator, "wakeLock", {
				configurable: true,
				value: {
					request: () =>
						Promise.reject(
							new DOMException("Synthetic denial", "NotAllowedError"),
						),
				},
			});
		});
		await page.clock.install();
		await openApp(page, {
			fontSizePx: 36,
			lineHeight,
			paceMode: "target",
			targetSec: 10,
		});
		await page
			.locator("#script")
			.fill(Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`).join("\n"));
		await page.clock.pauseAt(
			new Date(await page.evaluate(() => Date.now() + 1000)),
		);
		await start(page);
		await expect(page.locator("#reader-notice")).toHaveText("Screen may lock.");
		await page.locator("#toggle-play").click();
		await page.locator("#seek").fill("200");
		await page.locator("#seek").dispatchEvent("input");
		for (const theme of ["light", "dark"] as const) {
			await page.emulateMedia({ colorScheme: theme });
			for (const size of [
				{ width: 200, height: 180 },
				{ width: 250, height: 250 },
				{ width: 390, height: 844 },
				{ width: 844, height: 390 },
				{ width: 200, height: 180 },
			]) {
				await page.setViewportSize(size);
				await page.clock.runFor(32);
				await expectReadableLine(page, 20);
				await expect(page.locator("#over-target")).toBeVisible();
				await expect(page.locator("#reader-notice")).toBeVisible();
				await expect(page.locator("#reader")).toHaveAttribute(
					"data-phase",
					"paused",
				);
				for (const control of await page
					.locator("#reader button, #reader input")
					.all()) {
					if (!(await control.isVisible())) continue;
					const box = await control.boundingBox();
					if (!box) throw new Error("Reader control missing geometry");
					expect(box.width).toBeGreaterThanOrEqual(44);
					expect(box.height).toBeGreaterThanOrEqual(44);
					expect(box.x).toBeGreaterThanOrEqual(0);
					expect(box.y).toBeGreaterThanOrEqual(0);
					expect(box.x + box.width).toBeLessThanOrEqual(size.width + 1);
					expect(box.y + box.height).toBeLessThanOrEqual(size.height + 1);
					if (size.width <= 300 || size.height <= 300) {
						expect(
							box.x + box.width <= size.width - 60 ||
								box.y + box.height <= size.height - 60,
						).toBe(true);
					}
				}
			}
		}
		const position = await page
			.locator("#reader")
			.getAttribute("data-position");
		await hidePage(page, true);
		await hidePage(page, false);
		await page.clock.runFor(32);
		await expect(page.locator("#reader-notice")).toHaveText(
			"Paused after leaving.",
		);
		await expect(page.locator("#reader")).toHaveAttribute(
			"data-position",
			position ?? "",
		);
		await expectReadableLine(page, 20);
	});
}
