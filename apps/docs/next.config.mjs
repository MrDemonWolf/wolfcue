import { createMDX } from "fumadocs-mdx/next";
import { siteConfig } from "../../scripts/site-config.ts";

const { basePath, docsPath, siteOrigin, siteUrl } = siteConfig();
const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
	output: "export",
	trailingSlash: true,
	basePath: docsPath,
	assetPrefix: `${docsPath}/`,
	images: { unoptimized: true },
	env: {
		NEXT_PUBLIC_DOCS_PATH: docsPath,
		NEXT_PUBLIC_SITE_BASE: basePath.replace(/\/$/, ""),
		NEXT_PUBLIC_SITE_URL: siteUrl,
		NEXT_PUBLIC_SITE_ORIGIN: siteOrigin,
	},
};

export default withMDX(config);
