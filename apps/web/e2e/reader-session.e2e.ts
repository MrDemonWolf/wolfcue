import { expect, test } from "@playwright/test";
import { hidePage, readingPosition, startFrozen } from "./helpers";

test("a sideways swipe neither toggles playback nor seeks", async ({
	page,
}) => {
	await startFrozen(page);
	const reader = page.locator("#reader");
	await page.locator("#toggle-play").click();
	await expect(reader).toHaveAttribute("data-phase", "paused");
	const stage = page.locator("#stage");
	// Synthetic pointer events have no native capture.
	await stage.evaluate((element) => {
		element.setPointerCapture = () => {};
	});
	const before = await readingPosition(page);
	const swipe = { pointerType: "touch", pointerId: 5, isPrimary: true };
	await stage.dispatchEvent("pointerdown", {
		...swipe,
		button: 0,
		clientX: 40,
		clientY: 100,
	});
	await stage.dispatchEvent("pointermove", {
		...swipe,
		clientX: 100,
		clientY: 100,
	});
	await stage.dispatchEvent("pointerup", {
		...swipe,
		clientX: 100,
		clientY: 100,
	});
	await expect(reader).toHaveAttribute("data-phase", "paused");
	expect(await readingPosition(page)).toBe(before);
});

test("pausing keeps the reading line in the same place on screen", async ({
	page,
}) => {
	await startFrozen(page);
	const guideTop = () =>
		page
			.locator("#reading-guide")
			.evaluate((element) => element.getBoundingClientRect().top);
	await expect(page.locator("#reader")).toHaveAttribute(
		"data-phase",
		"playing",
	);
	const playing = await guideTop();
	await page.locator("#toggle-play").click();
	await expect(page.locator("#reader")).toHaveAttribute("data-phase", "paused");
	await expect
		.poll(async () => Math.abs((await guideTop()) - playing))
		.toBeLessThanOrEqual(1.5);
	await page.locator("#toggle-play").click();
	await expect
		.poll(async () => Math.abs((await guideTop()) - playing))
		.toBeLessThanOrEqual(1.5);
});

test("Restart and Exit stay out of the way while reading", async ({ page }) => {
	await startFrozen(page);
	await expect(page.locator("#reader")).toHaveAttribute(
		"data-phase",
		"playing",
	);
	await expect(page.locator("#restart")).toBeHidden();
	await expect(page.locator("#exit-reader")).toBeHidden();
});

test("only an interrupted take reports a pause after leaving", async ({
	page,
}) => {
	await startFrozen(page);
	const notice = page.locator("#reader-notice");
	await page.locator("#toggle-play").click();
	await hidePage(page, true);
	await hidePage(page, false);
	await expect(notice).not.toHaveText("Paused after leaving.");
	await page.locator("#toggle-play").click();
	await expect(page.locator("#reader")).toHaveAttribute(
		"data-phase",
		"playing",
	);
	await hidePage(page, true);
	await hidePage(page, false);
	await expect(notice).toHaveText("Paused after leaving.");
	await page.locator("#toggle-play").click();
	await expect(notice).not.toHaveText("Paused after leaving.");
});

test("a wake lock the system revokes while reading shows a warning", async ({
	page,
}) => {
	await page.addInitScript(() => {
		const sentinels: EventTarget[] = [];
		Object.assign(window, { wakeSentinels: sentinels });
		Object.defineProperty(navigator, "wakeLock", {
			configurable: true,
			value: {
				request: async () => {
					const sentinel = Object.assign(new EventTarget(), {
						released: false,
						type: "screen",
						release: async () => {},
					});
					sentinels.push(sentinel);
					return sentinel;
				},
			},
		});
	});
	await startFrozen(page);
	const notice = page.locator("#reader-notice");
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					(window as unknown as { wakeSentinels: EventTarget[] }).wakeSentinels
						.length,
			),
		)
		.toBe(1);
	await expect(notice).toBeEmpty();
	await page.evaluate(() =>
		(
			window as unknown as { wakeSentinels: EventTarget[] }
		).wakeSentinels[0]?.dispatchEvent(new Event("release")),
	);
	await expect(notice).toHaveText("Screen may lock.");
	// Pausing and resuming requests a new lock, which clears the warning.
	await page.locator("#toggle-play").click();
	await page.locator("#toggle-play").click();
	await expect(notice).toBeEmpty();
});
