import { mkdir } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { openApp, start } from "./helpers";

for (const theme of ["light", "dark"] as const)
	test(`inspect ${theme} editor, playing, paused and settings`, async ({
		page,
	}, info) => {
		await mkdir("artifacts/screenshots", { recursive: true });
		await page.clock.install();
		await page.emulateMedia({ colorScheme: theme });
		await openApp(page);
		await page.clock.pauseAt(
			new Date(await page.evaluate(() => Date.now() + 1000)),
		);
		const shot = (name: string) =>
			page.screenshot({
				path: `artifacts/screenshots/${info.project.name}-${theme}-${name}.png`,
				scale: "css",
				animations: "disabled",
			});
		await shot("editor");
		await start(page);
		await page.clock.runFor(2048);
		await shot("playing");
		await page.locator("#toggle-play").click();
		await shot("paused");
		await page.locator("#reader-settings").click();
		await expect(page.locator("#settings-dialog")).toBeVisible();
		await shot("settings");
	});
