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
/** Short, single-line preview of a script for confirmations. */
export function previewText(text: string, maxChars = 60): string {
	const flat = text.trim().replace(/\s+/g, " ");
	const chars = [...flat];
	return chars.length > maxChars
		? `${chars.slice(0, maxChars).join("").trimEnd()}...`
		: flat;
}
