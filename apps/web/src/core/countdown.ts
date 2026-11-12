export function countdownValue(
	nowMs: number,
	startedMs: number,
): number | null {
	const elapsed = Math.max(0, nowMs - startedMs);
	return elapsed >= 3000 || !Number.isFinite(elapsed)
		? null
		: 3 - Math.floor(elapsed / 1000);
}
