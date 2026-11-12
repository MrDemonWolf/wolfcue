export const DOCS_PATH = process.env.NEXT_PUBLIC_DOCS_PATH ?? "/docs";
export const SITE_BASE = process.env.NEXT_PUBLIC_SITE_BASE ?? "";
export const SITE_URL =
	process.env.NEXT_PUBLIC_SITE_URL ?? "https://wolfcue.mrdemonwolf.dev/";
export const SITE_ORIGIN =
	process.env.NEXT_PUBLIC_SITE_ORIGIN ?? "https://wolfcue.mrdemonwolf.dev";

export const DOCS_OG_IMAGE = {
	url: new URL("og-docs-v2.png", SITE_URL).toString(),
	width: 1200,
	height: 630,
	alt: "WolfCue Docs with the MrDemonWolf logo and setup, Moblin, and script guides on a charcoal background.",
};
