import { expect, test } from "@playwright/test";
import { hidePage, openApp, SCRIPT, start } from "./helpers";

test("an empty number field keeps the current value", async ({ page }) => {
	await openApp(page);
	for (const [field, value] of [
		["#wpm", "150"],
		["#font-size", "36"],
	] as const) {
		await page.locator(field).fill("");
		await page.locator(field).dispatchEvent("change");
		await expect(page.locator(field)).toHaveValue(value);
	}
	await page.locator('#editor [data-adjust="wpm"][data-direction="1"]').click();
	await expect(page.locator("#wpm")).toHaveValue("155");
	await expect(page.locator("#wpm")).toHaveAttribute("inputmode", "numeric");
});

test("save status is visible text, not a chatty live region", async ({
	page,
}) => {
	await openApp(page);
	await expect(page.locator("#save-status")).not.toHaveAttribute("role", /.+/);
	await expect(page.locator("#script")).toHaveAttribute(
		"aria-describedby",
		/save-status/,
	);
});

test("replacing prompts preview the text, and every cancel says so", async ({
	page,
}) => {
	await openApp(page);
	await page.locator("#file-input").setInputFiles({
		name: "take-two.txt",
		mimeType: "text/plain",
		buffer: Buffer.from("Second take words"),
	});
	await expect(page.locator("#confirm-dialog")).toBeVisible();
	await expect(page.locator("#confirm-message")).toContainText(
		'"Second take words" (3 words)',
	);
	await page.keyboard.press("Escape");
	await expect(page.locator("#confirm-dialog")).toBeHidden();
	await expect(page.locator("#file-status")).toHaveText(
		"Import canceled. Your script has not changed.",
	);
	await expect(page.locator("#script")).toHaveValue(SCRIPT);
	await page.goto(`./#script=${encodeURIComponent("Linked take")}`);
	await expect(page.locator("#confirm-message")).toContainText(
		'"Linked take" (2 words)',
	);
	await page.locator("#confirm-cancel").click();
	await expect(page.locator("#file-status")).toHaveText(
		"Link not loaded. Your script has not changed.",
	);
	await expect(page.locator("#script")).toHaveValue(SCRIPT);
});

test("reopening a link with the same text changes nothing", async ({
	page,
}) => {
	await openApp(page);
	await page.goto(`./#script=${encodeURIComponent(SCRIPT)}`);
	await expect(page.locator("#file-status")).toHaveText(
		"This link matches your current script.",
	);
	await expect(page.locator("#confirm-dialog")).toBeHidden();
	await expect(page.locator("#script")).toHaveValue(SCRIPT);
});

test("hiding the page flushes a pending script save", async ({ page }) => {
	await page.clock.install();
	await page.goto("./");
	await page.clock.pauseAt(
		new Date(await page.evaluate(() => Date.now() + 1000)),
	);
	await page.locator("#script").fill(SCRIPT);
	expect(
		await page.evaluate(() => localStorage.getItem("wolfcue:v1:script")),
	).toBeNull();
	await hidePage(page, true);
	expect(
		await page.evaluate(() => localStorage.getItem("wolfcue:v1:script")),
	).toBe(SCRIPT);
	await expect(page.locator("#save-status")).toHaveText("Saved on this device");
});

test("typing during a slow import drops the stale file", async ({ page }) => {
	await page.addInitScript(() => {
		const read = File.prototype.arrayBuffer;
		let release = () => {};
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		Object.assign(window, { releaseRead: () => release() });
		File.prototype.arrayBuffer = async function (this: File) {
			await gate;
			return read.call(this);
		};
	});
	await openApp(page);
	await page.locator("#file-input").setInputFiles({
		name: "slow.txt",
		mimeType: "text/plain",
		buffer: Buffer.from("Imported later"),
	});
	await expect(page.locator("#file-status")).toHaveText("Reading file...");
	await page.locator("#script").fill("Typed while reading");
	await expect(page.locator("#file-status")).toBeEmpty();
	await page.evaluate(() => {
		(window as unknown as { releaseRead: () => void }).releaseRead();
		return new Promise((resolve) => setTimeout(resolve, 50));
	});
	await expect(page.locator("#confirm-dialog")).toBeHidden();
	await expect(page.locator("#script")).toHaveValue("Typed while reading");
});

test("Start reading stays in reach on small and short screens", async ({
	page,
}, info) => {
	test.skip(
		info.project.name !== "iphone-portrait",
		"Explicit viewport matrix",
	);
	await openApp(page);
	for (const size of [
		{ width: 200, height: 180 },
		{ width: 250, height: 250 },
		{ width: 844, height: 390 },
	]) {
		await page.setViewportSize(size);
		await page.evaluate(() => window.scrollTo(0, 0));
		const box = await page.locator("#start-reading").boundingBox();
		if (!box) throw new Error("Start reading missing");
		const where = `${size.width}x${size.height}`;
		expect(box.y, where).toBeGreaterThanOrEqual(0);
		expect(box.y + box.height, where).toBeLessThanOrEqual(size.height);
		expect(box.height, where).toBeGreaterThanOrEqual(44);
		expect(box.height, `${where} single line`).toBeLessThan(60);
		if (size.width <= 300 || size.height <= 300)
			expect(
				box.x + box.width <= size.width - 60 ||
					box.y + box.height <= size.height - 60,
				`${where} clear of the expand button`,
			).toBe(true);
	}
});

test("compact Settings rows scroll clear of the expand button", async ({
	page,
}, info) => {
	test.skip(info.project.name !== "moblin-250", "Explicit viewport matrix");
	await openApp(page);
	await start(page);
	for (const size of [
		{ width: 200, height: 180 },
		{ width: 250, height: 250 },
	]) {
		await page.setViewportSize(size);
		if (!(await page.locator("#settings-dialog").isVisible()))
			await page.locator("#reader-settings").click();
		await page
			.locator("#settings-dialog .dialog-body")
			.evaluate((body) => body.scrollTo(0, body.scrollHeight));
		for (const control of await page
			.locator(
				"#settings-dialog :is(button, input, summary, a, label.setting-row, .radio-group label)",
			)
			.all()) {
			if (!(await control.isVisible())) continue;
			const box = await control.boundingBox();
			if (!box) continue;
			expect(
				box.x + box.width <= size.width - 60 ||
					box.y + box.height <= size.height - 60,
				`${size.width}x${size.height} ${await control.evaluate((element) => element.id || element.textContent?.slice(0, 30))}`,
			).toBe(true);
		}
	}
});
