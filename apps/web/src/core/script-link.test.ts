import { expect, test } from "bun:test";
import { MAX_TEXT_BYTES } from "./import-validate";
import {
	buildScriptLink,
	fromBase64Url,
	parseScriptLink,
	readLinkBytes,
	toBase64Url,
} from "./script-link";

const plainText = (hash: string) => {
	const payload = parseScriptLink(hash);
	if (payload?.kind !== "text") throw new Error(`Expected text for ${hash}`);
	return payload.result;
};

test("Unicode script links round trip without path/query contents", () => {
	const text = "Hello café 世界 🐺\n+ & # = % ? / <script>plain text</script>";
	for (const base of [
		"https://wolfcue.mrdemonwolf.dev/",
		"http://localhost:4173/wolfcue/?old=1#old",
	]) {
		const result = buildScriptLink(text, base);
		expect(result.ok).toBe(true);
		if (!result.ok) throw new Error(result.reason);
		const url = new URL(result.url);
		expect(url.pathname).toBe(new URL(base).pathname);
		expect(url.search).toBe("");
		expect(plainText(url.hash)).toEqual({ ok: true, text });
	}
});
test("plain links never contain the compressed marker", () => {
	const result = buildScriptLink(
		"z: starts like a marker: yes",
		"https://e.com/",
	);
	if (!result.ok) throw new Error(result.reason);
	expect(new URL(result.url).hash.startsWith("#script=z:")).toBe(false);
	expect(plainText(new URL(result.url).hash)).toEqual({
		ok: true,
		text: "z: starts like a marker: yes",
	});
});
test("the shorter of plain and compressed forms is used", () => {
	const text = "words ".repeat(200);
	const small = new Uint8Array([1, 2, 3]);
	const packed = buildScriptLink(text, "https://e.com/", small);
	if (!packed.ok) throw new Error(packed.reason);
	expect(new URL(packed.url).hash).toBe(`#script=z:${toBase64Url(small)}`);
	expect(parseScriptLink(new URL(packed.url).hash)).toEqual({
		kind: "compressed",
		bytes: small,
	});
	const huge = new Uint8Array(5000);
	const plain = buildScriptLink("hi", "https://e.com/", huge);
	if (!plain.ok) throw new Error(plain.reason);
	expect(new URL(plain.url).hash).toBe("#script=hi");
});
test("base64url round trips every length and rejects bad input", () => {
	for (let length = 0; length < 70; length++) {
		const bytes = Uint8Array.from(
			{ length },
			(_, i) => (i * 37 + length) & 255,
		);
		const encoded = toBase64Url(bytes);
		expect(encoded).toMatch(/^[A-Za-z0-9_-]*$/);
		expect(fromBase64Url(encoded)).toEqual(bytes);
	}
	expect(fromBase64Url("a")).toBeNull();
	expect(fromBase64Url("ab+/")).toBeNull();
	expect(fromBase64Url("ab=")).toBeNull();
	expect(parseScriptLink("#script=z:ab+/")).toEqual({
		kind: "text",
		result: { ok: false, reason: "This script link contains invalid text." },
	});
});
test("unrelated fragments, invalid encoding, NUL and empty links are handled", () => {
	expect(parseScriptLink("#guide")).toBeNull();
	expect(parseScriptLink("")).toBeNull();
	for (const hash of [
		"#script=",
		"#script=%FF",
		"#script=%",
		"#script=%00",
		"#script=%20%0A",
	])
		expect(plainText(hash).ok).toBe(false);
	expect(plainText("#script=one%0D%0Atwo%0Dthree")).toEqual({
		ok: true,
		text: "one\ntwo\nthree",
	});
	expect(buildScriptLink("", "https://example.com/").ok).toBe(false);
	expect(buildScriptLink("hi", "javascript:alert(1)").ok).toBe(false);
});
test("inclusive byte limit is shared with text import", () => {
	const accepted = buildScriptLink(
		"a".repeat(MAX_TEXT_BYTES),
		"https://example.com/",
	);
	expect(accepted.ok).toBe(true);
	if (!accepted.ok) throw new Error(accepted.reason);
	expect(plainText(new URL(accepted.url).hash).ok).toBe(true);
	expect(
		buildScriptLink("a".repeat(MAX_TEXT_BYTES + 1), "https://example.com/").ok,
	).toBe(false);
	expect(plainText(`#script=${"a".repeat(MAX_TEXT_BYTES + 1)}`).ok).toBe(false);
	expect(plainText(`#script=${"%41".repeat(MAX_TEXT_BYTES + 1)}`).ok).toBe(
		false,
	);
	expect(plainText(`#script=z:${"A".repeat(MAX_TEXT_BYTES * 2)}`)).toEqual({
		ok: false,
		reason: "This script link is larger than 1 MiB.",
	});
	expect(readLinkBytes(new Uint8Array(MAX_TEXT_BYTES + 1).fill(65)).ok).toBe(
		false,
	);
});
test("link problems use link wording, not file wording", () => {
	expect(plainText("#script=")).toEqual({
		ok: false,
		reason: "This script link is empty.",
	});
	expect(plainText("#script=%00")).toEqual({
		ok: false,
		reason: "This script link contains invalid text.",
	});
	expect(readLinkBytes(new TextEncoder().encode("a\0b"))).toEqual({
		ok: false,
		reason: "This script link contains invalid text.",
	});
	const big = buildScriptLink("a".repeat(MAX_TEXT_BYTES + 1), "https://e.com/");
	expect(big).toEqual({
		ok: false,
		reason: "This script is larger than 1 MiB. Export a .txt file instead.",
	});
});
