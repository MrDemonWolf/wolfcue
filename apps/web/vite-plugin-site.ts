import type { Plugin } from "vite";
export const APP_CSP =
	"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; manifest-src 'self'; media-src 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'";
export function sitePlugin(siteUrl: string): Plugin {
	return {
		name: "wolfcue-site",
		apply: "build",
		transformIndexHtml(html) {
			return html
				.replace(
					/<meta charset="[^"]+"\s*\/?>/i,
					(charset) =>
						`${charset}\n<meta http-equiv="Content-Security-Policy" content="${APP_CSP}">`,
				)
				.replaceAll("https://wolfcue.mrdemonwolf.dev/", siteUrl);
		},
		generateBundle() {
			this.emitFile({
				type: "asset",
				fileName: "robots.txt",
				source: `User-agent: *\nAllow: /\nSitemap: ${siteUrl}sitemap.xml\nSitemap: ${siteUrl}docs/sitemap.xml\n`,
			});
			this.emitFile({
				type: "asset",
				fileName: "sitemap.xml",
				source: `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${siteUrl}</loc></url></urlset>`,
			});
		},
	};
}
