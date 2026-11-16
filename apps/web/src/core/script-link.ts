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
/** A link fragment either carries readable text or compressed bytes to inflate first. */
export type LinkPayload =
	| { kind: "text"; result: IncomingLink }
	| { kind: "compressed"; bytes: Uint8Array };
/** Links longer than this may not open in every in-app browser address field. */
export const LONG_LINK_CHARS = 32_000;
const PREFIX = "#script=";
/**
 * Compressed links are `#script=z:` plus base64url deflate-raw UTF-8. Plain
 * links never contain a literal ":" because encodeURIComponent escapes it.
 */
const COMPRESSED_MARK = "z:";
// Deflate can grow incompressible input slightly; base64 adds a third.
const MAX_COMPRESSED_CHARS = Math.ceil(((MAX_TEXT_BYTES * 1.01 + 64) * 4) / 3);
const LINK_REASONS: Record<ImportProblem, string> = {
	type: "This script link is not valid.",
	size: "This script is larger than 1 MiB. Export a .txt file instead.",
	encoding: "This script link contains invalid text.",
	nul: "This script link contains invalid text.",
	empty: "This script link is empty.",
};
const BASE64URL =
	"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
export function toBase64Url(bytes: Uint8Array): string {
	let out = "";
	for (let i = 0; i < bytes.length; i += 3) {
		const a = bytes[i] ?? 0;
		const b = bytes[i + 1] ?? 0;
		const c = bytes[i + 2] ?? 0;
		const n = (a << 16) | (b << 8) | c;
		const left = bytes.length - i;
		out += BASE64URL[(n >> 18) & 63];
		out += BASE64URL[(n >> 12) & 63];
		if (left > 1) out += BASE64URL[(n >> 6) & 63];
		if (left > 2) out += BASE64URL[n & 63];
	}
	return out;
}
export function fromBase64Url(text: string): Uint8Array | null {
	if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) return null;
	const bytes = new Uint8Array(Math.floor((text.length * 3) / 4));
	let bits = 0;
	let value = 0;
	let index = 0;
	for (const character of text) {
		value = (value << 6) | BASE64URL.indexOf(character);
		bits += 6;
		if (bits >= 8) {
			bits -= 8;
			bytes[index++] = (value >> bits) & 255;
		}
	}
	return bytes;
}
/** Validates link text with the same rules as file imports, in link wording. */
function checkText(bytes: Uint8Array): IncomingLink {
	const result = validateImport(bytes, "script.txt");
	return result.ok
		? result
		: { ok: false, reason: LINK_REASONS[result.problem] };
}
/**
 * Builds the shortest link for a script: plain percent-encoding, or the
 * compressed form when `compressed` (deflate-raw of the UTF-8 text) is given.
 */
export function buildScriptLink(
	text: string,
	pageUrl: string,
	compressed: Uint8Array | null = null,
): ScriptLinkResult {
	const result = validateImport(new TextEncoder().encode(text), "script.txt");
	if (!result.ok) return { ok: false, reason: LINK_REASONS[result.problem] };
	try {
		const url = new URL(pageUrl);
		if (!["https:", "http:"].includes(url.protocol))
			throw new Error("Unsupported URL");
		url.search = "";
		const plain = `script=${encodeURIComponent(result.text)}`;
		const packed = compressed
			? `script=${COMPRESSED_MARK}${toBase64Url(compressed)}`
			: null;
		url.hash = packed && packed.length < plain.length ? packed : plain;
		return { ok: true, url: url.href };
	} catch {
		return {
			ok: false,
			reason: "Could not create a script link. Export a .txt file instead.",
		};
	}
}
export function parseScriptLink(hash: string): LinkPayload | null {
	if (!hash.startsWith(PREFIX)) return null;
	const body = hash.slice(PREFIX.length);
	const fail = (reason: string): LinkPayload => ({
		kind: "text",
		result: { ok: false, reason },
	});
	if (body.startsWith(COMPRESSED_MARK)) {
		const encoded = body.slice(COMPRESSED_MARK.length);
		if (encoded.length > MAX_COMPRESSED_CHARS)
			return fail("This script link is larger than 1 MiB.");
		const bytes = fromBase64Url(encoded);
		return bytes
			? { kind: "compressed", bytes }
			: fail("This script link contains invalid text.");
	}
	// Percent encoding takes at most three characters per UTF-8 byte.
	if (body.length > MAX_TEXT_BYTES * 3)
		return fail("This script link is larger than 1 MiB.");
	try {
		const text = decodeURIComponent(body);
		return {
			kind: "text",
			result: checkText(new TextEncoder().encode(text)),
		};
	} catch {
		return fail("This script link contains invalid text.");
	}
}
/** Validates inflated bytes from a compressed link. */
export function readLinkBytes(bytes: Uint8Array): IncomingLink {
	return checkText(bytes);
}
