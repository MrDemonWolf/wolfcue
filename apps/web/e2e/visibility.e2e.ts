import { expect, test } from "@playwright/test";
import {
	denyWakeLock,
	expectReaderControlsClear,
	hidePage,
	openApp,
	openFrozen,
	position,
	start,
} from "./helpers";

for (const countdown of [false, true])
	test(`hidden pauses ${countdown ? "countdown" : "playback"} and return stays paused`, async ({
		page,
	}) => {
		await openFrozen(page, { countdown });
		await start(page);
		await page.clock.runFor(512);
		await hidePage(page, true);
		const pos = await position(page);
		await page.clock.runFor(10000);
		await hidePage(page, false);
		await expect(page.locator("#toggle-play")).toHaveText("Resume");
		expect(await position(page)).toBe(pos);
		await page.clock.runFor(5000);
		expect(await position(page)).toBe(pos);
	});
test("wake lock rejection does not block reading", async ({ page }) => {
	await denyWakeLock(page);
	await openApp(page);
	await start(page);
	await expect(page.locator("#toggle-play")).toHaveText("Pause");
	await expect(page.locator("#reader-notice")).toContainText(
		/awake|wake|screen/i,
	);
});

test("wake lock notice stays outside script and compact controls keep clear", async ({
	page,
}) => {
	await denyWakeLock(page);
	await openApp(page);
	await start(page);
	await expect(page.locator("#reader-notice")).not.toBeEmpty();
	await page.locator("#toggle-play").click();
	for (const size of [
		{ width: 250, height: 250 },
		{ width: 200, height: 180 },
	]) {
		await page.setViewportSize(size);
		const notice = await page.locator("#reader-notice").boundingBox();
		const stage = await page.locator("#stage").boundingBox();
		expect(notice).not.toBeNull();
		expect(stage).not.toBeNull();
		if (!notice || !stage) throw new Error("Reader geometry missing");
		expect(notice.y + notice.height).toBeLessThanOrEqual(stage.y + 1);
		expect(stage.height).toBeGreaterThan(0);
		await expectReaderControlsClear(page, size);
	}
});
