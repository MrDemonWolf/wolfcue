import { expect, test } from "bun:test";
import { MAX_TEXT_BYTES } from "./import-validate";
import { buildScriptLink, readScriptLink } from "./script-link";

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
		expect(readScriptLink(url.hash)).toEqual({ ok: true, text });
	}
});
test("unrelated fragments, invalid encoding, NUL and empty links are handled", () => {
	expect(readScriptLink("#guide")).toBeNull();
	expect(readScriptLink("")).toBeNull();
	for (const hash of [
		"#script=",
		"#script=%FF",
		"#script=%",
		"#script=%00",
		"#script=%20%0A",
	])
		expect(readScriptLink(hash)?.ok).toBe(false);
	expect(readScriptLink("#script=one%0D%0Atwo%0Dthree")).toEqual({
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
	expect(readScriptLink(new URL(accepted.url).hash)?.ok).toBe(true);
	expect(
		buildScriptLink("a".repeat(MAX_TEXT_BYTES + 1), "https://example.com/").ok,
	).toBe(false);
	expect(readScriptLink(`#script=${"a".repeat(MAX_TEXT_BYTES + 1)}`)?.ok).toBe(
		false,
	);
	expect(
		readScriptLink(`#script=${"%41".repeat(MAX_TEXT_BYTES + 1)}`)?.ok,
	).toBe(false);
});
