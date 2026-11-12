import {
	type ImportResult,
	MAX_TEXT_BYTES,
	validateImport,
} from "./import-validate";

export type ScriptLinkResult =
	| { ok: true; url: string }
	| { ok: false; reason: string };
export function buildScriptLink(
	text: string,
	pageUrl: string,
): ScriptLinkResult {
	const result = validateImport(new TextEncoder().encode(text), "script.txt");
	if (!result.ok) return result;
	try {
		const url = new URL(pageUrl);
		if (!["https:", "http:"].includes(url.protocol))
			throw new Error("Unsupported URL");
		url.search = "";
		url.hash = `script=${encodeURIComponent(result.text)}`;
		return { ok: true, url: url.href };
	} catch {
		return {
			ok: false,
			reason: "Could not create a script link. Export a .txt file instead.",
		};
	}
}
export function readScriptLink(hash: string): ImportResult | null {
	if (!hash.startsWith("#script=")) return null;
	// Percent encoding takes at most three characters per UTF-8 byte.
	if (hash.length > MAX_TEXT_BYTES * 3 + 8)
		return { ok: false, reason: "This script link is larger than 1 MiB." };
	try {
		const text = decodeURIComponent(hash.slice(8));
		return validateImport(new TextEncoder().encode(text), "script.txt");
	} catch {
		return { ok: false, reason: "This script link contains invalid text." };
	}
}
