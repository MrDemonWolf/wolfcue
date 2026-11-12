import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import { siteConfig } from "../../scripts/site-config";
import { sitePlugin } from "./vite-plugin-site";

const config = siteConfig();
function commit() {
	if (process.env.COMMIT_SHA) return process.env.COMMIT_SHA;
	try {
		return execFileSync("git", ["rev-parse", "HEAD"], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim();
	} catch {
		return "dev";
	}
}
export default defineConfig({
	base: config.basePath,
	plugins: [sitePlugin(config.siteUrl)],
	define: { __COMMIT_HASH__: JSON.stringify(commit()) },
	server: {
		port: Number(process.env.WEB_PORT ?? process.env.PORT ?? 3001),
		host: "127.0.0.1",
		proxy: {
			[config.docsPath]: `http://127.0.0.1:${process.env.DOCS_PORT ?? 3002}`,
		},
	},
	build: {
		target: "safari16.4",
		cssTarget: "safari16.4",
		assetsInlineLimit: 0,
		rolldownOptions: {
			input: {
				main: resolve(import.meta.dirname, "index.html"),
				missing: resolve(import.meta.dirname, "404.html"),
			},
			output: {},
		},
	},
});
