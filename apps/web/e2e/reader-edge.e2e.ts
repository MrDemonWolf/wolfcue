import { expect, type Page, test } from "@playwright/test";
import {
	closeReaderControls,
	openApp,
	openReaderControls,
	SCRIPT,
	start,
} from "./helpers";

async function freeze(page: Page, prefs: Record<string, unknown> = {}) {
	await page.clock.install();
	await openApp(page, prefs);
	await page.clock.pauseAt(
		new Date(await page.evaluate(() => Date.now() + 1000)),
	);
	await start(page);
}
async function readingPosition(page: Page) {
	return page
		.locator("#reader")
		.evaluate((reader) => Number(reader.dataset.position));
}

test("paused touch drag and wheel seek; a tap toggles playback", async ({
	page,
}) => {
	await freeze(page);
	await page.locator("#toggle-play").click();
	const stage = page.locator("#stage");
	const before = await readingPosition(page);
	// Synthetic pointer events have no native capture; this checks the drag adapter.
	await stage.evaluate((element) => {
		element.setPointerCapture = () => {};
	});
	await stage.dispatchEvent("pointerdown", {
		pointerType: "touch",
		pointerId: 17,
		button: 0,
		clientY: 100,
	});
	await stage.dispatchEvent("pointermove", {
		pointerType: "touch",
		pointerId: 17,
		clientY: 60,
	});
	await stage.dispatchEvent("pointerup", {
		pointerType: "touch",
		pointerId: 17,
		clientY: 60,
	});
	expect(await readingPosition(page)).toBeCloseTo(before + 40, 4);
	await expect(page.locator("#reader")).toHaveAttribute("data-phase", "paused");
	// Mobile WebKit has no native mouse wheel dispatch; exercise the wheel adapter.
	await stage.dispatchEvent("wheel", { deltaY: 80, cancelable: true });
	await expect.poll(() => readingPosition(page)).toBeGreaterThan(before + 40);
	const beforeZoom = await readingPosition(page);
	const zoomPrevented = await stage.evaluate((element) => {
		const event = new WheelEvent("wheel", {
			deltaY: 80,
			ctrlKey: true,
			cancelable: true,
			bubbles: true,
		});
		element.dispatchEvent(event);
		return event.defaultPrevented;
	});
	expect(zoomPrevented).toBe(false);
	expect(await readingPosition(page)).toBe(beforeZoom);
	await stage.tap();
	await expect(page.locator("#reader")).toHaveAttribute(
		"data-phase",
		"playing",
	);
	const playing = await readingPosition(page);
	await stage.dispatchEvent("wheel", { deltaY: 500, cancelable: true });
	expect(await readingPosition(page)).toBe(playing);
	await stage.tap();
	await expect(page.locator("#reader")).toHaveAttribute("data-phase", "paused");
});

test("target mode reveals its speed cap and uses real remaining time", async ({
	page,
}) => {
	await freeze(page, { paceMode: "target", targetSec: 10 });
	await expect(page.locator("#over-target")).toBeVisible();
	const words = Array.from(
		new Intl.Segmenter("en", { granularity: "word" }).segment(SCRIPT),
	).filter((part) => part.isWordLike).length;
	const seconds = Math.ceil(words / 5);
	await expect(page.locator("#remaining")).toHaveText(
		`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} left`,
	);
	await page.locator("#reader-settings").click();
	await expect(page.locator("#settings-dialog")).toContainText(
		"Target time estimates when scrolling reaches the end. It does not measure speech.",
	);
});

test("seeking to the end stays paused; playback finishes and restart resets", async ({
	page,
}) => {
	await freeze(page);
	await page.locator("#toggle-play").click();
	await openReaderControls(page);
	await page.locator("#seek").fill("1000");
	await page.locator("#seek").dispatchEvent("input");
	await closeReaderControls(page);
	await expect(page.locator("#reader")).toHaveAttribute("data-phase", "paused");
	await page.locator("#toggle-play").click();
	await page.clock.runFor(16);
	await expect(page.locator("#reader-state")).toHaveText("End of script");
	await expect(page.locator("#toggle-play")).toBeDisabled();
	const endpoints = await page.locator("#reader").evaluate((reader) => ({
		position: reader.dataset.position,
		end: reader.dataset.end,
	}));
	expect(endpoints.position).toBe(endpoints.end);
	await openReaderControls(page);
	await page.locator("#restart").click();
	await expect(page.locator("#reader")).toHaveAttribute(
		"data-phase",
		"playing",
	);
	expect(await readingPosition(page)).toBe(0);
	await expect(page.locator("#elapsed")).toHaveText("0:00");
});

test("denied clipboard exposes selected plain text for manual copy", async ({
	page,
}) => {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: {
				writeText: async () => {
					throw new DOMException("Denied", "NotAllowedError");
				},
			},
		});
	});
	await openApp(page);
	await page.locator("#export").click();
	await page.locator("#copy-text").click();
	await expect(page.locator("#copy-fallback")).toBeVisible();
	await expect(page.locator("#copy-fallback")).toHaveValue(SCRIPT);
	await expect(page.locator("#export-status")).toContainText(
		"Copy is unavailable",
	);
	expect(
		await page
			.locator("#copy-fallback")
			.evaluate(
				(field: HTMLTextAreaElement) =>
					field.selectionEnd - field.selectionStart,
			),
	).toBe(SCRIPT.length);
});

test("pagehide flushes pending script before the debounce expires", async ({
	page,
}) => {
	await page.clock.install();
	await page.goto("./");
	await page.clock.pauseAt(
		new Date(await page.evaluate(() => Date.now() + 1000)),
	);
	await page.locator("#script").fill(SCRIPT);
	expect(
		await page.evaluate(() => localStorage.getItem("wolfcue:v1:script")),
	).toBeNull();
	await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
	expect(
		await page.evaluate(() => localStorage.getItem("wolfcue:v1:script")),
	).toBe(SCRIPT);
	await expect(page.locator("#save-status")).toHaveText("Saved on this device");
});
