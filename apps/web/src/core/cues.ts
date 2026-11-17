/** A run of script text: spoken words, or an action cue written as *like this*. */
export interface CuePart {
	text: string;
	action: boolean;
}
/**
 * An action is text between single asterisks on one line, with no space just
 * inside them. Asterisks touching letters, digits or other asterisks stay
 * literal, so "5*3*2" and "**bold**" read as typed.
 */
const ACTION =
	/(?<![\p{L}\p{N}*])\*([^*\s](?:[^*\n]*[^*\s])?)\*(?![\p{L}\p{N}*])/gu;

/** Splits one script line into spoken text and action cues, in order. */
export function splitCues(line: string): CuePart[] {
	const parts: CuePart[] = [];
	let last = 0;
	for (const match of line.matchAll(ACTION)) {
		const start = match.index ?? 0;
		if (start > last)
			parts.push({ text: line.slice(last, start), action: false });
		parts.push({ text: match[1] ?? "", action: true });
		last = start + match[0].length;
	}
	if (last < line.length) parts.push({ text: line.slice(last), action: false });
	return parts;
}

/** Script text without action cues, for word counts and pacing. */
export function spokenText(text: string): string {
	return text.replace(ACTION, " ");
}
