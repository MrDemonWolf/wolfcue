import { expect, test } from "bun:test";
import { MAX_TEXT_BYTES, validateImport } from "./import-validate";

const bytes = (text: string) => new TextEncoder().encode(text);
test("UTF-8 BOM stripped once, line endings normalized and Unicode preserved", () => {
	expect(
		validateImport(
			bytes("\ufeff日本語 🐺\r\n<script>literal</script>\rend  "),
			"script.TXT",
		),
	).toEqual({ ok: true, text: "日本語 🐺\n<script>literal</script>\nend  " });
	expect(validateImport(bytes("\ufeff\ufefftext"), "a.txt")).toEqual({
		ok: true,
		text: "\ufefftext",
	});
});
test("exactly 1 MiB is accepted; larger files rejected before decoding", () => {
	expect(validateImport(bytes("a".repeat(MAX_TEXT_BYTES)), "a.txt").ok).toBe(
		true,
	);
	const big = new Uint8Array(MAX_TEXT_BYTES + 1).fill(255);
	const r = validateImport(big, "a.txt");
	expect(r.ok).toBe(false);
	if (!r.ok) expect(r.reason).toContain("1 MiB");
});
test("reject invalid UTF-8, UTF-16, NUL, blank and wrong extensions", () => {
	for (const content of [
		new Uint8Array([0xc3, 0x28]),
		new Uint8Array([0xff, 0xfe, 0x61, 0]),
		bytes("hi\0there"),
		bytes(""),
		bytes(" \n "),
	])
		expect(validateImport(content, "a.txt").ok).toBe(false);
	expect(validateImport(bytes("text"), "a.pdf").ok).toBe(false);
});

test("UTF-8 size is counted in bytes rather than characters", () => {
	const text = `${"あ".repeat(349525)}a`;
	expect(bytes(text).byteLength).toBe(MAX_TEXT_BYTES);
	expect(validateImport(bytes(text), "unicode.txt")).toEqual({
		ok: true,
		text,
	});
	expect(validateImport(bytes(`${text}a`), "unicode.txt").ok).toBe(false);
});
