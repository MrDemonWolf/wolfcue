import { expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { toBlocks } from "./render-plan";

test("only outer blank lines are trimmed; content stays literal", () => {
	expect(
		toBlocks("\n  \n  <script>alert(1)</script>  \n\n日本語 🐺\n\n"),
	).toEqual(["  <script>alert(1)</script>  ", "", "日本語 🐺"]);
	expect(toBlocks(" \n")).toEqual([]);
});
test("application source has no executable HTML sinks", async () => {
	const root = join(import.meta.dir, "..");
	async function inspect(dir: string): Promise<void> {
		for (const entry of await readdir(dir, { withFileTypes: true })) {
			const path = join(dir, entry.name);
			if (entry.isDirectory()) await inspect(path);
			else if (
				/\.(ts|js)$/.test(entry.name) &&
				!entry.name.endsWith(".test.ts")
			) {
				const source = await readFile(path, "utf8");
				expect(source).not.toMatch(
					/innerHTML|outerHTML|insertAdjacentHTML|document\.write|DOMParser|eval\s*\(|new\s+Function/,
				);
			}
		}
	}
	await inspect(root);
});
