import { expect, test } from "@playwright/test";
import { SCRIPT } from "./helpers";

for (const failure of ["getter", "read", "write", "corrupt"])
	test(`storage ${failure} keeps editing usable`, async ({ page }) => {
		await page.addInitScript((kind) => {
			if (kind === "getter")
				Object.defineProperty(window, "localStorage", {
					configurable: true,
					get() {
						throw new DOMException("Denied", "SecurityError");
					},
				});
			if (kind === "read")
				Storage.prototype.getItem = () => {
					throw new DOMException("Denied", "SecurityError");
				};
			if (kind === "write")
				Storage.prototype.setItem = () => {
					throw new DOMException("Full", "QuotaExceededError");
				};
			if (kind === "corrupt")
				localStorage.setItem(
					"wolfcue:v1:prefs",
					'{"fontSizePx":"oops","wpm":null}',
				);
		}, failure);
		await page.goto("./");
		await page.locator("#script").fill(SCRIPT);
		await page.waitForTimeout(500);
		await expect(page.locator("#script")).toHaveValue(SCRIPT);
		await expect(page.locator("#save-status")).toContainText(
			failure === "corrupt" ? "Saved" : "Not saved",
		);
		await page.locator("#start-reading").click();
		await expect(page.locator("#reader")).toBeVisible();
	});
test("script and preferences persist and erase removes all three keys", async ({
	page,
}) => {
	await page.goto("./");
	await page.locator("#script").fill(SCRIPT);
	await page.waitForTimeout(500);
	await page.reload();
	await expect(page.locator("#script")).toHaveValue(SCRIPT);
	await page.locator("#editor-settings").click();
	await page.locator("#theme input[value=dark]").check();
	await page.locator("#erase-data").click();
	await page.locator("#confirm-accept").click();
	expect(
		await page.evaluate(() =>
			["wolfcue:theme", "wolfcue:v1:prefs", "wolfcue:v1:script"].map((key) =>
				localStorage.getItem(key),
			),
		),
	).toEqual([null, null, null]);
});
