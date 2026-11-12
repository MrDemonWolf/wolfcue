import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { siteConfig } from "../../../scripts/site-config";

test("docs load, link to app, search works, pages fit portrait", async ({
	page,
	baseURL,
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("./docs/");
	await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
	await expect(
		page.locator(`a[href="${new URL(baseURL ?? "").pathname}"]`).first(),
	).toBeAttached();
	const index = await page.request.get("./docs/api/search");
	expect(index.ok()).toBe(true);
	expect(await index.text()).toContain("Moblin");
	await page
		.getByRole("button", { name: /search/i })
		.first()
		.click();
	await page.getByRole("combobox", { name: "Search" }).fill("storage");
	await expect(page.getByRole("dialog")).toContainText(/storage|privacy/i);
	await page.keyboard.press("Escape");
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= innerWidth,
		),
	).toBe(true);
});

test("every exported guide has matching SEO metadata, docs preview image, and sitemap entry", async ({
	page,
	request,
	baseURL,
}, testInfo) => {
	test.skip(
		testInfo.project.name !== "iphone-portrait",
		"Static metadata is independent of viewport",
	);
	const { basePath, siteOrigin } = siteConfig();
	const docsDir = resolve(import.meta.dirname, "../../docs/content/docs");
	const files = readdirSync(docsDir)
		.filter((name) => name.endsWith(".mdx"))
		.sort();
	const canonicals: string[] = [];
	const image = `${siteOrigin}${basePath}og-docs-v2.png`;
	const imageAlt =
		"WolfCue Docs with the MrDemonWolf logo and setup, Moblin, and script guides on a charcoal background.";
	for (const file of files) {
		const frontmatter = readFileSync(resolve(docsDir, file), "utf8");
		const title = /^title: (.+)$/m.exec(frontmatter)?.[1];
		const description = /^description: (.+)$/m.exec(frontmatter)?.[1];
		expect(title, `${file} has a title`).toBeTruthy();
		expect(description, `${file} has a description`).toBeTruthy();
		const slug = file === "index.mdx" ? "" : `${file.slice(0, -4)}/`;
		const canonical = `${siteOrigin}${basePath}docs/${slug}`;
		canonicals.push(canonical);
		await page.goto(`./docs/${slug}`);
		await expect(page).toHaveTitle(`${title} | WolfCue`);
		await expect(page.locator('meta[name="description"]')).toHaveAttribute(
			"content",
			description ?? "",
		);
		await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
			"href",
			canonical,
		);
		for (const [property, content] of Object.entries({
			"og:title": title ?? "",
			"og:description": description ?? "",
			"og:url": canonical,
			"og:site_name": "WolfCue",
			"og:type": slug ? "article" : "website",
			"og:locale": "en_US",
			"og:image": image,
			"og:image:width": "1200",
			"og:image:height": "630",
			"og:image:alt": imageAlt,
		})) {
			await expect(
				page.locator(`meta[property="${property}"]`),
			).toHaveAttribute("content", content);
		}
		for (const [name, content] of Object.entries({
			"twitter:card": "summary_large_image",
			"twitter:title": title ?? "",
			"twitter:description": description ?? "",
			"twitter:image": image,
			"twitter:image:alt": imageAlt,
		})) {
			await expect(page.locator(`meta[name="${name}"]`)).toHaveAttribute(
				"content",
				content,
			);
		}
	}
	const sitemap = await request.get("./docs/sitemap.xml");
	expect(sitemap.ok()).toBe(true);
	const urls = [...(await sitemap.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(
		(match) => match[1],
	);
	expect(urls.sort()).toEqual(canonicals.sort());

	const preview = await request.get(
		new URL("og-docs-v2.png", baseURL).toString(),
	);
	expect(preview.ok()).toBe(true);
	expect(preview.headers()["content-type"]).toContain("image/png");
	const png = await preview.body();
	expect(png.subarray(0, 8)).toEqual(
		Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
	);
	expect(png.readUInt32BE(16)).toBe(1200);
	expect(png.readUInt32BE(20)).toBe(630);

	await page.goto("./docs/404.html");
	await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
		"content",
		/noindex/,
	);
});
