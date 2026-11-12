import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { openApp, SCRIPT } from "./helpers";

test("valid import confirms replacement; cancellation and invalid files preserve script", async ({
	page,
}) => {
	await openApp(page);
	const text = "Hello 🐺 世界\n<script>alert('safe')</script>";
	await page.locator("#file-input").setInputFiles({
		name: "script.txt",
		mimeType: "text/plain",
		buffer: Buffer.from(text),
	});
	await expect(page.locator("#confirm-dialog")).toBeVisible();
	await page.locator("#confirm-cancel").click();
	await expect(page.locator("#script")).toHaveValue(SCRIPT);
	for (const buffer of [
		Buffer.alloc(1048577, 65),
		Buffer.from([0xff, 0xfe, 0, 65]),
	]) {
		await page
			.locator("#file-input")
			.setInputFiles({ name: "bad.txt", mimeType: "text/plain", buffer });
		await expect(page.locator("#file-status")).not.toBeEmpty();
		await expect(page.locator("#script")).toHaveValue(SCRIPT);
	}
	await page.locator("#file-input").setInputFiles({
		name: "script.txt",
		mimeType: "text/plain",
		buffer: Buffer.from(text),
	});
	await page.locator("#confirm-accept").click();
	await expect(page.locator("#script")).toHaveValue(text);
	await page.locator("#start-reading").click();
	await expect(page.locator("#script-content")).toContainText(
		"<script>alert('safe')</script>",
	);
	await expect(page.locator("#script-content script")).toHaveCount(0);
});
test("download preserves Unicode text exactly; clearing needs confirmation", async ({
	page,
}) => {
	await openApp(page);
	await page.locator("#export").click();
	const event = page.waitForEvent("download");
	await page.locator("#download-file").click();
	const download = await event;
	expect(download.suggestedFilename()).toMatch(/\.txt$/);
	expect(await readFile((await download.path()) ?? "", "utf8")).toBe(SCRIPT);
	await page.getByRole("button", { name: "Done", exact: true }).click();
	await page.locator("#clear").click();
	await page.locator("#confirm-cancel").click();
	await expect(page.locator("#script")).toHaveValue(SCRIPT);
	await page.locator("#clear").click();
	await page.locator("#confirm-accept").click();
	await expect(page.locator("#script")).toHaveValue("");
});
