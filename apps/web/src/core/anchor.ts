export interface Block {
	top: number;
	height: number;
}
export interface Anchor {
	block: number;
	fraction: number;
	ratio: number;
}
const clamp = (v: number) =>
	Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));
export function captureAnchor(
	blocks: readonly Block[],
	positionPx: number,
	endPx: number,
): Anchor {
	const ratio = endPx > 0 ? clamp(positionPx / endPx) : 0;
	let lo = 0;
	let hi = blocks.length - 1;
	while (lo < hi) {
		const mid = Math.ceil((lo + hi) / 2);
		if ((blocks[mid]?.top ?? 0) <= positionPx) lo = mid;
		else hi = mid - 1;
	}
	const b = blocks[lo];
	return {
		block: b ? lo : -1,
		fraction: b && b.height > 0 ? clamp((positionPx - b.top) / b.height) : 0,
		ratio,
	};
}
export function resolveAnchor(
	blocks: readonly Block[],
	anchor: Anchor,
	endPx: number,
): number {
	if (!(endPx > 0)) return 0;
	if (anchor.ratio <= 0) return 0;
	if (anchor.ratio >= 1) return endPx;
	const b = blocks[anchor.block];
	return Math.min(
		endPx,
		Math.max(
			0,
			b && b.height > 0
				? b.top + b.height * clamp(anchor.fraction)
				: clamp(anchor.ratio) * endPx,
		),
	);
}
