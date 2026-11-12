export const MAX_TEXT_BYTES = 1048576;
export type ImportResult =
	| { ok: true; text: string }
	| { ok: false; reason: string };
/**
 * Adapted from Pocket Teleprompter, Copyright (c) 2026 ttomohisa, MIT License.
 * https://github.com/ttomohisa/htmlapps-pocket-teleprompter/blob/ad05bf6202bdb9a20e168e1f67521f0a73de90a5/src/index.template.html#L258
 */
export function validateImport(bytes: Uint8Array, name: string): ImportResult {
	if (!/\.txt$/i.test(name))
		return { ok: false, reason: "Choose a .txt file." };
	if (bytes.byteLength > MAX_TEXT_BYTES)
		return { ok: false, reason: "Choose a file no larger than 1 MiB." };
	let text: string;
	try {
		text = new TextDecoder("utf-8", { fatal: true })
			.decode(bytes)
			.replace(/\r\n?/g, "\n");
	} catch {
		return { ok: false, reason: "Choose a UTF-8 text file." };
	}
	if (text.includes("\0"))
		return { ok: false, reason: "The file contains invalid text." };
	if (!text.trim()) return { ok: false, reason: "The file is empty." };
	return { ok: true, text };
}
