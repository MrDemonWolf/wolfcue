import { expect, test } from "@playwright/test";
import { openApp, openReaderControls, start } from "./helpers";

test("essential controls have names, visible focus, and hidden views are inert", async ({
	page,
}) => {
	await openApp(page);
	for (const button of await page.getByRole("button").all())
		await expect(button).toHaveAccessibleName(/\S/);
	await page.locator("#start-reading").focus();
	expect(
		await page.locator("#start-reading").evaluate((el) => {
			const css = getComputedStyle(el);
			return (
				css.outlineStyle !== "none" && Number.parseFloat(css.outlineWidth) >= 2
			);
		}),
	).toBe(true);
	await start(page);
	await expect(page.locator("#editor")).toHaveAttribute("inert", "");
	await page.locator("#toggle-play").click();
	await openReaderControls(page);
	await page.locator("#exit-reader").click();
	await expect(page.locator("#reader")).toHaveAttribute("inert", "");
});
