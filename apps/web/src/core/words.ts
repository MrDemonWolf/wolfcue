export function countWords(text: string): number {
	if (typeof Intl.Segmenter === "function") {
		const segments = new Intl.Segmenter("en", { granularity: "word" }).segment(
			text,
		);
		let count = 0;
		for (const part of segments) if (part.isWordLike) count++;
		return count;
	}
	return text.trim() ? text.trim().split(/\s+/u).length : 0;
}
