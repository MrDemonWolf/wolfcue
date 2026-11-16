import { expect, test } from "bun:test";
import {
	buildScriptLink,
	parseScriptLink,
	readLinkBytes,
} from "../core/script-link";
import { compressText, inflateBytes } from "./link-codec";

const script = Array.from(
	{ length: 45 },
	(_, i) =>
		`Line ${i + 1}. These are synthetic words for a steady reading session.`,
).join("\n");

test("compressed links round trip and are much shorter", async () => {
	for (const text of [script, `${"話す 🐺 ".repeat(400)}end`]) {
		const compressed = await compressText(text);
		expect(compressed).not.toBeNull();
		const plain = buildScriptLink(text, "https://e.com/");
		const packed = buildScriptLink(text, "https://e.com/", compressed);
		if (!plain.ok || !packed.ok) throw new Error("link failed");
		expect(packed.url.length).toBeLessThan(plain.url.length / 2);
		const payload = parseScriptLink(new URL(packed.url).hash);
		if (payload?.kind !== "compressed") throw new Error("not compressed");
		const inflated = await inflateBytes(payload.bytes, 1_048_576);
		if (!inflated.ok) throw new Error(inflated.problem);
		expect(readLinkBytes(inflated.bytes)).toEqual({ ok: true, text });
	}
});
test("inflating stops at the size limit and rejects garbage", async () => {
	const bomb = await compressText("a".repeat(2_000_000));
	if (!bomb) throw new Error("compression unavailable");
	expect(bomb.length).toBeLessThan(10_000);
	expect(await inflateBytes(bomb, 1_048_576)).toEqual({
		ok: false,
		problem: "size",
	});
	expect(await inflateBytes(new Uint8Array([255, 0, 1, 2, 3]), 1000)).toEqual({
		ok: false,
		problem: "invalid",
	});
});
