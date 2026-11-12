import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../apps/web/dist");
const protectedPaths = ["index.html", "404.html"];
const before = await Promise.all(
	protectedPaths.map((path) => readFile(`${root}/${path}`, "utf8")),
);
await mkdir(root, { recursive: true });
await rm(`${root}/docs`, { recursive: true, force: true });
await cp(resolve(import.meta.dirname, "../apps/docs/out"), `${root}/docs`, {
	recursive: true,
});
for (const [index, path] of protectedPaths.entries()) {
	if ((await readFile(`${root}/${path}`, "utf8")) !== before[index])
		throw new Error(`Docs overwrote ${path}`);
}
console.log("Merged docs into apps/web/dist/docs; app entry points preserved.");
