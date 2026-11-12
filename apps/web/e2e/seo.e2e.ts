import { expect, test } from "@playwright/test";
import { siteConfig } from "../../../scripts/site-config";

test("app metadata is crawlable, base-aware, and unchanged by private script links", async ({
	page,
	request,
	baseURL,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "iphone-portrait",
		"Static metadata is independent of viewport",
	);
	const { siteUrl } = siteConfig();
	const title = "WolfCue | Free Browser Teleprompter for Moblin";
	const description =
		"Free browser teleprompter for Moblin on iPhone. Paste a script, set your pace, and read with auto-scroll. No account or script uploads.";
	const image = `${siteUrl}og-v2.png`;
	const response = await page.goto("./");
	expect(response?.ok()).toBe(true);
	const html = await response?.text();
	expect(html).toContain(`<title>${title}</title>`);
	expect(html).toContain(`href="${siteUrl}"`);
	expect(html).toContain(`content="${image}"`);
	await expect(page.locator("h1")).toHaveCount(1);
	await expect(page.locator("h1")).toContainText("teleprompter");
	await expect(page.locator('meta[name="robots"]')).toHaveCount(0);

	const script =
		"Synthetic SEO test script: private words stay out of metadata.";
	await page.goto(
		`./?utm_source=seo-check#script=${encodeURIComponent(script)}`,
	);
	await expect(page.locator("#script")).toHaveValue(script);
	expect(new URL(page.url()).hash).toBe("");
	await expect(page).toHaveTitle(title);
	await expect(page.locator('meta[name="description"]')).toHaveAttribute(
		"content",
		description,
	);
	await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
	await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
		"href",
		siteUrl,
	);
	for (const [property, content] of Object.entries({
		"og:type": "website",
		"og:site_name": "WolfCue",
		"og:locale": "en_US",
		"og:title": title,
		"og:description": description,
		"og:url": siteUrl,
		"og:image": image,
		"og:image:type": "image/png",
		"og:image:width": "1200",
		"og:image:height": "630",
	})) {
		await expect(page.locator(`meta[property="${property}"]`)).toHaveAttribute(
			"content",
			content,
		);
	}
	for (const [name, content] of Object.entries({
		"twitter:card": "summary_large_image",
		"twitter:title": title,
		"twitter:description": description,
		"twitter:image": image,
	})) {
		await expect(page.locator(`meta[name="${name}"]`)).toHaveAttribute(
			"content",
			content,
		);
	}
	const alt = await page
		.locator('meta[property="og:image:alt"]')
		.getAttribute("content");
	expect(alt).toMatch(/WolfCue.+MrDemonWolf logo.+charcoal/);
	await expect(page.locator('meta[name="twitter:image:alt"]')).toHaveAttribute(
		"content",
		alt ?? "",
	);
	expect(await page.locator("head").textContent()).not.toContain(script);
	expect(await page.locator("head").innerHTML()).not.toContain("utm_source");

	const robots = await request.get("./robots.txt");
	expect(robots.ok()).toBe(true);
	expect(await robots.text()).toBe(
		`User-agent: *\nAllow: /\nSitemap: ${siteUrl}sitemap.xml\nSitemap: ${siteUrl}docs/sitemap.xml\n`,
	);
	const sitemap = await request.get("./sitemap.xml");
	expect(sitemap.ok()).toBe(true);
	expect(
		[...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(
			(match) => match[1],
		),
	).toEqual([siteUrl]);
	const preview = await request.get(new URL("og-v2.png", baseURL).toString());
	expect(preview.ok()).toBe(true);
	expect(preview.headers()["content-type"]).toContain("image/png");
	const png = await preview.body();
	expect(png.subarray(0, 8)).toEqual(
		Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
	);
	expect(png.readUInt32BE(16)).toBe(1200);
	expect(png.readUInt32BE(20)).toBe(630);
});
