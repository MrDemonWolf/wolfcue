import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { normalizeBasePath, siteConfig } from "./site-config";

assert.equal(normalizeBasePath(), "/");
assert.equal(normalizeBasePath("//wolfcue//"), "/wolfcue/");
assert.throws(() => normalizeBasePath("/../secrets/"));
assert.throws(() => normalizeBasePath("/a?b/"));
assert.throws(() => siteConfig({ SITE_ORIGIN: "file:///tmp" }));
assert.deepEqual(
	siteConfig({ BASE_PATH: "wolfcue", SITE_ORIGIN: "https://example.com" }),
	{
		basePath: "/wolfcue/",
		docsPath: "/wolfcue/docs",
		siteOrigin: "https://example.com",
		siteUrl: "https://example.com/wolfcue/",
	},
);
const root = resolve(import.meta.dirname, "..");
assert.equal(
	await readFile(`${root}/THIRD_PARTY_NOTICES.md`, "utf8"),
	await readFile(`${root}/apps/web/public/third-party-notices.txt`, "utf8"),
);
for (const name of ["og-v2.png", "og-docs-v2.png"]) {
	const og = await readFile(`${root}/apps/web/public/${name}`);
	assert.equal(og.subarray(1, 4).toString(), "PNG");
	assert.equal(og.readUInt32BE(16), 1200);
	assert.equal(og.readUInt32BE(20), 630);
}
console.log("Shared site configuration, notices and asset assertions passed.");
