export function toBlocks(text: string): string[] {
	const lines = text.replace(/\r\n?/g, "\n").split("\n");
	let start = 0;
	let end = lines.length;
	while (start < end && !lines[start]?.trim()) start++;
	while (end > start && !lines[end - 1]?.trim()) end--;
	return lines.slice(start, end);
}
