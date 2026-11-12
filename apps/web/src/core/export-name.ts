/**
 * Adapted from Pocket Teleprompter, Copyright (c) 2026 ttomohisa, MIT License.
 * https://github.com/ttomohisa/htmlapps-pocket-teleprompter/blob/ad05bf6202bdb9a20e168e1f67521f0a73de90a5/src/index.template.html#L242
 */
export function textFileName(value: string): string {
	// biome-ignore lint/suspicious/noControlCharactersInRegex: Strip unsafe filename characters, as upstream does.
	const unsafeCharacters = /[\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/g;
	let name =
		(value || "")
			.split(/[\\/]/)
			.pop()
			?.replace(unsafeCharacters, "")
			.replace(/[<>:"|?*]/g, "_")
			.trim() ?? "";
	name = name
		.replace(/\.txt$/i, "")
		.replace(/[. ]+$/g, "")
		.trim();
	if (!name) return "wolfcue.txt";
	if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name))
		name = `_${name}`;
	const encoder = new TextEncoder();
	let bounded = "";
	let bytes = 0;
	for (const character of [...name].slice(0, 100)) {
		const size = encoder.encode(character).length;
		if (bytes + size > 236) break;
		bounded += character;
		bytes += size;
	}
	return `${bounded.replace(/[. ]+$/g, "")}.txt`;
}
