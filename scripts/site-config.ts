export function normalizeBasePath(value = "/"): string {
	const parts = value.split("/").filter(Boolean);
	if (parts.some((part) => !/^[a-zA-Z0-9_-]+$/.test(part)))
		throw new Error("BASE_PATH must contain plain path segments");
	return parts.length ? `/${parts.join("/")}/` : "/";
}
export function siteConfig(
	env: Record<string, string | undefined> = process.env,
) {
	const basePath = normalizeBasePath(env.BASE_PATH);
	const origin = new URL(env.SITE_ORIGIN ?? "https://wolfcue.mrdemonwolf.dev");
	if (!/^https?:$/.test(origin.protocol))
		throw new Error("SITE_ORIGIN must be HTTP or HTTPS");
	const siteOrigin = origin.origin;
	return {
		basePath,
		docsPath: `${basePath}docs`,
		siteOrigin,
		siteUrl: `${siteOrigin}${basePath}`,
	};
}
