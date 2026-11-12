/**
 * Adapted from Pocket Teleprompter, Copyright (c) 2026 ttomohisa, MIT License.
 * https://github.com/ttomohisa/htmlapps-pocket-teleprompter/blob/ad05bf6202bdb9a20e168e1f67521f0a73de90a5/src/index.template.html#L290
 */
export function formatClock(
	sec: number,
	rounding: "floor" | "ceil" = "floor",
): string {
	const n = Number.isFinite(sec) ? Math.max(0, Math[rounding](sec)) : 0;
	const seconds = String(n % 60).padStart(2, "0");
	const minutes = Math.floor(n / 60) % 60;
	const hours = Math.floor(n / 3600);
	return hours
		? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}`
		: `${minutes}:${seconds}`;
}
