import { expect, test } from "@playwright/test";
import { openApp, start } from "./helpers";

for (const docs of [false, true])
	test(`${docs ? "docs" : "app"} has no off-origin, out-of-base, failed, or CSP-blocked requests`, async ({
		page,
		baseURL,
	}) => {
		const base = new URL(baseURL ?? "");
		const escaped: string[] = [];
		const failed: string[] = [];
		await page.addInitScript(() => {
			const violations: string[] = [];
			Object.assign(window, { violations });
			document.addEventListener("securitypolicyviolation", (e) =>
				violations.push(`${e.violatedDirective} ${e.blockedURI}`),
			);
		});
		page.on("request", (r) => {
			const u = new URL(r.url());
			if (["data:", "blob:"].includes(u.protocol)) return;
			if (u.origin !== base.origin || !u.pathname.startsWith(base.pathname))
				escaped.push(r.url());
		});
		page.on("response", (r) => {
			if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
		});
		page.on("requestfailed", (r) =>
			failed.push(`${r.url()} ${r.failure()?.errorText}`),
		);
		if (docs) {
			await page.goto("./docs/");
			await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
		} else {
			await openApp(page);
			await start(page);
			await page.locator("#reader-settings").click();
		}
		await page.waitForLoadState("networkidle");
		expect(escaped).toEqual([]);
		expect(failed).toEqual([]);
		expect(
			await page.evaluate(
				() => (window as unknown as { violations: string[] }).violations,
			),
		).toEqual([]);
	});
test("404 links and assets work at arbitrary depth", async ({
	page,
	baseURL,
}) => {
	const response = await page.goto("./missing/deep/path");
	expect(response?.status()).toBe(404);
	await expect(page.getByRole("link", { name: /docs/i })).toHaveAttribute(
		"href",
		`${new URL(baseURL ?? "").pathname}docs/`,
	);
	await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
		"content",
		/noindex/,
	);
	if (new URL(baseURL ?? "").pathname !== "/")
		expect((await page.request.get("/index.html")).status()).toBe(404);
});
