/** Reading line height as a share of the stage: the upper quarter keeps more upcoming text in view. */
export const GUIDE_RATIO = 0.25;
/**
 * Pixel offset of the reading line from the stage top. Keeps at least one
 * line above it when room allows and always one full line below it.
 * `reservedPx` is chrome that temporarily covers the top of the stage (paused
 * controls on narrow screens); the line keeps the same on-screen position.
 */
export function guideOffsetPx(
	stageHeight: number,
	lineHeight: number,
	reservedPx = 0,
): number {
	const safe = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0);
	const stage = safe(stageHeight);
	const line = safe(lineHeight);
	const reserved = safe(reservedPx);
	const ideal =
		Math.max(line, Math.round((stage + reserved) * GUIDE_RATIO)) - reserved;
	return Math.min(Math.max(0, ideal), Math.max(0, Math.floor(stage - line)));
}
/** Height of the dimmed band: only lines fully above the one being read. */
export function dimHeightPx(guideOffset: number, lineHeight: number): number {
	return Math.max(0, Math.round(guideOffset - lineHeight));
}
