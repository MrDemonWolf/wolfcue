import { expect, test } from "@playwright/test";
import { openApp, position, start } from "./helpers";

test("configure, countdown, play, pause, seek, resume, restart and exit", async ({
	page,
}) => {
	await page.clock.install();
	await openApp(page, { countdown: true });
	await page.clock.pauseAt(
		new Date(await page.evaluate(() => Date.now() + 1000)),
	);
	await page.locator("#wpm").fill("180");
	await page.locator("#wpm").dispatchEvent("change");
	await start(page);
	await expect(page.locator("#toggle-play")).toHaveText("Cancel");
	await expect(page.locator("#countdown")).toHaveText("3");
	await page.clock.runFor(1024);
	await expect(page.locator("#countdown")).toHaveText("2");
	await page.clock.runFor(1024);
	await expect(page.locator("#countdown")).toHaveText("1");
	await page.clock.runFor(1024);
	await expect(page.locator("#toggle-play")).toHaveText("Pause");
	const initial = await position(page);
	await page.clock.runFor(2048);
	expect(await position(page)).toBeLessThan(initial);
	await page.locator("#toggle-play").click();
	const paused = Number(
		await page.locator("#reader").getAttribute("data-position"),
	);
	await page.clock.runFor(5000);
	expect(
		Number(await page.locator("#reader").getAttribute("data-position")),
	).toBeCloseTo(paused, 8);
	await page.locator("#seek").fill("500");
	await page.locator("#seek").dispatchEvent("input");
	expect(
		Number(await page.locator("#reader").getAttribute("data-position")),
	).toBeGreaterThan(paused);
	await page.locator("#toggle-play").click();
	await expect(page.locator("#toggle-play")).toHaveText("Pause");
	await page.clock.runFor(1024);
	await page.locator("#toggle-play").click();
	await page.locator("#restart").click();
	await expect(page.locator("#countdown")).toHaveText("3");
	await page.locator("#toggle-play").click();
	await page.locator("#exit-reader").click();
	await expect(page.locator("#editor")).toBeVisible();
});
test("elapsed timing, stalled frames and block anchors survive layout changes", async ({
	page,
}) => {
	await page.clock.install();
	await openApp(page);
	await page.clock.pauseAt(
		new Date(await page.evaluate(() => Date.now() + 1000)),
	);
	await start(page);
	const metrics = () =>
		page.locator("#reader").evaluate((el) => ({
			position: Number(el.dataset.position),
			elapsed: Number(el.dataset.elapsed),
			end: Number(el.dataset.end),
		}));
	const initial = await metrics();
	const words = await page
		.locator("#script")
		.inputValue()
		.then(
			(text) =>
				Array.from(
					new Intl.Segmenter("en", { granularity: "word" }).segment(text),
				).filter((s) => s.isWordLike).length,
		);
	const rate = (2.5 * initial.end) / words;
	await page.clock.runFor(1600);
	const before = await metrics();
	expect(
		Math.abs(before.position - initial.position - rate * 1.6),
	).toBeLessThanOrEqual(rate * 0.016);
	expect(Math.abs(before.elapsed - initial.elapsed - 1600)).toBeLessThanOrEqual(
		16,
	);
	const expectedTransform = await page
		.locator("#stage")
		.evaluate(
			(stage, pos) =>
				Math.round(
					(Math.round(stage.clientHeight * 0.38) - pos) * devicePixelRatio,
				) / devicePixelRatio,
			before.position,
		);
	expect(await position(page)).toBeCloseTo(expectedTransform, 1);
	await page.clock.fastForward(5000);
	const after = await metrics();
	expect(after.position - before.position).toBeLessThanOrEqual(
		rate * 0.25 + 0.001,
	);
	expect(after.elapsed - before.elapsed).toBeLessThanOrEqual(250);
	await page.locator("#toggle-play").click();
	await page.locator("#seek").fill("500");
	await page.locator("#seek").dispatchEvent("input");
	const anchor = () =>
		page.locator("#script-content").evaluate((content) => {
			const pos = Number(
				document.querySelector<HTMLElement>("#reader")?.dataset.position,
			);
			const children = Array.from(content.children) as HTMLElement[];
			const index = children.findIndex(
				(el) => el.offsetTop + el.offsetHeight > pos,
			);
			const block = children[Math.max(0, index)];
			return {
				index,
				fraction: block ? (pos - block.offsetTop) / block.offsetHeight : 0,
			};
		});
	const oldAnchor = await anchor();
	await page.locator("#reader-settings").click();
	await page.locator("#settings-size").fill("54");
	await page.locator("#settings-size").dispatchEvent("change");
	await page.getByRole("button", { name: "Done", exact: true }).click();
	await page.clock.runFor(32);
	await expect(page.locator("#toggle-play")).toHaveText("Resume");
	for (const viewport of [
		{ width: 390, height: 844 },
		{ width: 844, height: 390 },
		{ width: 250, height: 250 },
	]) {
		await page.setViewportSize(viewport);
		await page.clock.runFor(32);
		await expect
			.poll(() =>
				page
					.locator("#script-content")
					.evaluate(
						(content) =>
							Number(
								document.querySelector<HTMLElement>("#reader")?.dataset.end,
							) === (content as HTMLElement).offsetHeight,
					),
			)
			.toBe(true);
		const current = await anchor();
		expect(current.index).toBe(oldAnchor.index);
		expect(current.fraction).toBeCloseTo(oldAnchor.fraction, 2);
	}
});
