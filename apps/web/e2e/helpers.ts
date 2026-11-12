import { expect, type Page } from "@playwright/test";
export const SCRIPT = Array.from(
	{ length: 45 },
	(_, i) =>
		`Line ${i + 1}. These are synthetic words for a steady reading session.`,
).join("\n");
export async function openApp(page: Page, prefs: Record<string, unknown> = {}) {
	await page.addInitScript((settings) => {
		localStorage.setItem(
			"wolfcue:v1:prefs",
			JSON.stringify({ countdown: false, ...settings }),
		);
	}, prefs);
	await page.goto("./");
	await page.locator("#script").fill(SCRIPT);
}
export async function start(page: Page) {
	await page.locator("#start-reading").click();
	await expect(page.locator("#reader")).toBeVisible();
}
export async function hidePage(page: Page, hidden: boolean) {
	await page.evaluate((value) => {
		Object.defineProperty(document, "hidden", {
			configurable: true,
			get: () => value,
		});
		Object.defineProperty(document, "visibilityState", {
			configurable: true,
			get: () => (value ? "hidden" : "visible"),
		});
		document.dispatchEvent(new Event("visibilitychange"));
	}, hidden);
}
export async function position(page: Page) {
	return page
		.locator("#script-transform")
		.evaluate(
			(el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42,
		);
}
