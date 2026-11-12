import { expect, test } from "@playwright/test";
import { openApp, SCRIPT, start } from "./helpers";

const linked =
	"Copied from Notion: café 世界 🐺\n<script>literal words</script>\n+ # & % =";
test("a script link loads Unicode as text, saves locally and clears its fragment", async ({
	page,
	baseURL,
}) => {
	const requests: string[] = [];
	page.on("request", (request) => requests.push(request.url()));
	await page.goto(`./#script=${encodeURIComponent(linked)}`);
	await expect(page.locator("#script")).toHaveValue(linked);
	await expect(page).toHaveURL(baseURL ?? "");
	await expect(page.locator("#reader")).toBeHidden();
	await expect(page.locator("#save-status")).toContainText("Saved");
	expect(
		await page.evaluate(() => localStorage.getItem("wolfcue:v1:script")),
	).toBe(linked);
	expect(
		requests.every(
			(url) => !url.includes("script=") && !url.includes("Copied%20from"),
		),
	).toBe(true);
	await page.locator("#start-reading").click();
	await expect(page.locator("#script-content")).toContainText(
		"<script>literal words</script>",
	);
	await expect(page.locator("#script-content script")).toHaveCount(0);
});
test("different linked script asks before replacing and cancel preserves existing text", async ({
	page,
	baseURL,
}) => {
	await openApp(page);
	await page.goto(`./#script=${encodeURIComponent(linked)}`);
	await expect(page.locator("#confirm-dialog")).toBeVisible();
	await expect(page.locator("#confirm-cancel")).toBeFocused();
	await page.locator("#confirm-cancel").click();
	await expect(page.locator("#script")).toHaveValue(SCRIPT);
	await expect(page).toHaveURL(baseURL ?? "");
	await page.goto(`./#script=${encodeURIComponent(linked)}`);
	await page.locator("#confirm-accept").click();
	await expect(page.locator("#script")).toHaveValue(linked);
});
test("invalid link leaves the existing script alone", async ({ page }) => {
	await openApp(page);
	for (const hash of ["%FF", "%00", "%"]) {
		await page.goto(`./#script=${hash}`);
		await expect(page.locator("#file-status")).toContainText(
			"Your script has not changed",
		);
		await expect(page.locator("#script")).toHaveValue(SCRIPT);
		await expect(page.locator("#confirm-dialog")).toBeHidden();
	}
});
test("Copy script link uses the correct base and offers a selectable clipboard fallback", async ({
	page,
	baseURL,
}) => {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText: () => Promise.reject(new Error("denied")) },
		});
	});
	await openApp(page);
	await page.locator("#export").click();
	await page.locator("#copy-script-link").click();
	const field = page.locator("#script-link");
	await expect(field).toBeVisible();
	const url = new URL(await field.inputValue());
	const base = new URL(baseURL ?? "");
	expect(url.origin).toBe(base.origin);
	expect(url.pathname).toBe(base.pathname);
	expect(url.search).toBe("");
	expect(decodeURIComponent(url.hash.slice(8))).toBe(SCRIPT);
	await expect(field).toBeFocused();
	expect(
		await field.evaluate(
			(el: HTMLInputElement) =>
				el.selectionStart === 0 && el.selectionEnd === el.value.length,
		),
	).toBe(true);
	await expect(page.locator("#export-status")).toContainText("copy");
	await expect(page).toHaveURL(baseURL ?? "");
});
test("incoming link while reading pauses before replacement, including hash-only navigation", async ({
	page,
}) => {
	await openApp(page);
	await start(page);
	await page.goto(`./#script=${encodeURIComponent(linked)}`);
	await expect(page.locator("#confirm-dialog")).toBeVisible();
	await page.locator("#confirm-cancel").click();
	await expect(page.locator("#toggle-play")).toHaveText("Resume");
	await expect(page.locator("#script")).toHaveValue(SCRIPT);
	await page.goto(`./#script=${encodeURIComponent(linked)}`);
	await page.locator("#confirm-accept").click();
	await expect(page.locator("#editor")).toBeVisible();
	await expect(page.locator("#script")).toHaveValue(linked);
});
