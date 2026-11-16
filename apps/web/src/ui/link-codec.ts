/** Browser compression for script links (CompressionStream, Safari 16.4+). */
const FORMAT = "deflate-raw";

export type Inflated =
	| { ok: true; bytes: Uint8Array }
	| { ok: false; problem: "unsupported" | "invalid" | "size" };

/** Deflates UTF-8 text; null when this browser cannot compress. */
export async function compressText(text: string): Promise<Uint8Array | null> {
	if (typeof CompressionStream !== "function") return null;
	try {
		const stream = new Blob([text])
			.stream()
			.pipeThrough(new CompressionStream(FORMAT));
		return new Uint8Array(await new Response(stream).arrayBuffer());
	} catch {
		return null;
	}
}

/** Inflates at most `maxBytes`, stopping early so a hostile link cannot balloon. */
export async function inflateBytes(
	bytes: Uint8Array,
	maxBytes: number,
): Promise<Inflated> {
	if (typeof DecompressionStream !== "function")
		return { ok: false, problem: "unsupported" };
	const chunks: Uint8Array[] = [];
	let total = 0;
	try {
		const reader = new Blob([bytes as Uint8Array<ArrayBuffer>])
			.stream()
			.pipeThrough(new DecompressionStream(FORMAT))
			.getReader();
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			total += value.byteLength;
			if (total > maxBytes) {
				await reader.cancel().catch(() => {});
				return { ok: false, problem: "size" };
			}
			chunks.push(value);
		}
	} catch {
		return { ok: false, problem: "invalid" };
	}
	const out = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		out.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return { ok: true, bytes: out };
}
