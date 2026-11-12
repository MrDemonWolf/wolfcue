import { expect, test } from "@playwright/test";
import { openApp, start } from "./helpers";

test("keyboard respects editor and focused controls, IME, and reader shortcuts", async ({
	page,
}) => {
	await openApp(page);
	await page.locator("#script").press("Space");
	await expect(page.locator("#reader")).toBeHidden();
	await start(page);
	await page.locator("#reader").focus();
	await page.keyboard.press("k");
	await expect(page.locator("#toggle-play")).toHaveText("Resume");
	await page.evaluate(() =>
		document.dispatchEvent(
			new KeyboardEvent("keydown", {
				key: "k",
				isComposing: true,
				bubbles: true,
			}),
		),
	);
	await expect(page.locator("#toggle-play")).toHaveText("Resume");
	await page.keyboard.press("End");
	await expect(page.locator("#seek")).toHaveValue("1000");
	await page.keyboard.press("Home");
	await expect(page.locator("#seek")).toHaveValue("0");
	await page.keyboard.press("Escape");
	await expect(page.locator("#editor")).toBeVisible();
});
