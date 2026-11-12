import type { MetadataRoute } from "next";
import { DOCS_PATH, SITE_ORIGIN } from "@/lib/site";
import { source } from "@/lib/source";

export const dynamic = "force-static";
export default function sitemap(): MetadataRoute.Sitemap {
	return source.getPages().map((page) => ({
		url: new URL(
			`${DOCS_PATH}${page.url === "/" ? "/" : `${page.url.replace(/\/$/, "")}/`}`,
			SITE_ORIGIN,
		).toString(),
	}));
}
