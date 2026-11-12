import { join, resolve, sep } from "node:path";
import { siteConfig } from "./site-config";

const root = resolve(
	import.meta.dirname,
	"..",
	process.env.SITE_DIR ?? "apps/web/dist",
);
const { basePath } = siteConfig();
const server = Bun.serve({
	hostname: "127.0.0.1",
	port: Number(process.env.PORT ?? 4173),
	async fetch(req) {
		const { pathname } = new URL(req.url);
		if (basePath !== "/" && pathname === basePath.slice(0, -1))
			return Response.redirect(`${pathname}/`, 301);
		if (!pathname.startsWith(basePath))
			return new Response("Not found", { status: 404 });
		let rel: string;
		try {
			rel = decodeURIComponent(pathname.slice(basePath.length));
		} catch {
			return new Response("Invalid path", { status: 400 });
		}
		if (!rel || rel.endsWith("/")) rel += "index.html";
		const path = resolve(root, rel);
		if (!path.startsWith(root + sep))
			return new Response("Forbidden", { status: 403 });
		const file = Bun.file(path);
		if (await file.exists()) return new Response(file);
		if (await Bun.file(join(path, "index.html")).exists())
			return Response.redirect(`${pathname}/`, 301);
		return new Response(Bun.file(join(root, "404.html")), {
			status: 404,
			headers: { "Content-Type": "text/html" },
		});
	},
});
console.log(`WolfCue local preview: ${server.url}${basePath.slice(1)}`);
