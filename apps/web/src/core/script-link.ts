import {
	type ImportProblem,
	MAX_TEXT_BYTES,
	validateImport,
} from "./import-validate";

export type ScriptLinkResult =
	| { ok: true; url: string }
	| { ok: false; reason: string };
export type IncomingLink =
	| { ok: true; text: string }
	| { ok: false; reason: string };
/** Links longer than this may not open in every in-app browser address field. */
export const LONG_LINK_CHARS = 32_000;
const LINK_REASONS: Record<ImportProblem, string> = {
	type: "This script link is not valid.",
	size: "This script is larger than 1 MiB. Export a .txt file instead.",
	encoding: "This script link contains invalid text.",
	nul: "This script link contains invalid text.",
	empty: "This script link is empty.",
};
export function buildScriptLink(
	text: string,
	pageUrl: string,
): ScriptLinkResult {
	const result = validateImport(new TextEncoder().encode(text), "script.txt");
	if (!result.ok) return { ok: false, reason: LINK_REASONS[result.problem] };
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
export function readScriptLink(hash: string): IncomingLink | null {
	if (!hash.startsWith("#script=")) return null;
	// Percent encoding takes at most three characters per UTF-8 byte.
	if (hash.length > MAX_TEXT_BYTES * 3 + 8)
		return { ok: false, reason: "This script link is larger than 1 MiB." };
	try {
		const text = decodeURIComponent(hash.slice(8));
		const result = validateImport(new TextEncoder().encode(text), "script.txt");
		return result.ok
			? result
			: { ok: false, reason: LINK_REASONS[result.problem] };
	} catch {
		return { ok: false, reason: "This script link contains invalid text." };
	}
}
