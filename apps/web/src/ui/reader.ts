import {
	type Anchor,
	type Block,
	captureAnchor,
	resolveAnchor,
} from "../core/anchor";
import { formatClock } from "../core/clock-format";
import { countdownValue } from "../core/countdown";
import {
	beginCountdown,
	createEngine,
	type Pace,
	pause,
	play,
	relayout,
	restart,
	seekTo,
	setPace,
	step,
} from "../core/engine";
import { remainingSec } from "../core/pace";
import { toBlocks } from "../core/render-plan";
import type { Settings } from "../core/settings";
import { mapKey, type Shortcut } from "../core/shortcuts";
import { countWords } from "../core/words";
import { byId, showView, writeText } from "./dom";

export function createReader(
	getSettings: () => Settings,
	updateSettings: (patch: Partial<Settings>) => void,
	openSettings: () => void,
) {
	const reader = byId("reader");
	const wideScreen = matchMedia("(min-width:700px)");
	const compactScreen = matchMedia("(max-width:300px), (max-height:300px)");
	const sessionControls = byId("paused-controls");
	const sessionSettings = byId("reader-session-controls");
	const settingsDialog = byId<HTMLDialogElement>("settings-dialog");
	const editor = byId("editor");
	const stage = byId("stage");
	const content = byId("script-content");
	const transform = byId("script-transform");
	const toggle = byId<HTMLButtonElement>("toggle-play");
	const slider = byId<HTMLInputElement>("seek");
	let state = createEngine();
	let opened = false;
	let raf = 0;
	let generation = 0;
	let blocks: Block[] = [];
	let anchor: Anchor = { block: 0, fraction: 0, ratio: 0 };
	let anchorAt = 0;
	let stageHeight = 0;
	let guideOffset = 0;
	let words = 0;
	let wakeLock: WakeLockSentinel | null = null;
	let wakePending = false;
	let wakeNoticeShown = false;
	const fullscreenSupported = Boolean(
		document.fullscreenEnabled && document.documentElement.requestFullscreen,
	);
	byId("fullscreen-setting-row").hidden = !fullscreenSupported;
	byId("fullscreen-toggle").hidden = !fullscreenSupported;
	function pace(): Pace {
		const settings = getSettings();
		return settings.paceMode === "target"
			? { mode: "target", targetSec: settings.targetSec }
			: { mode: "wpm", wpm: settings.wpm };
	}
	function cacheAnchor() {
		anchor = captureAnchor(blocks, state.positionPx, state.layout.endPx);
	}
	function placeSessionControls() {
		const inSettings =
			compactScreen.matches ||
			(settingsDialog.open &&
				sessionControls.parentElement === sessionSettings);
		const parent = inSettings ? sessionSettings : byId("reader-chrome");
		if (sessionControls.parentElement !== parent) {
			const focused =
				document.activeElement instanceof HTMLElement &&
				sessionControls.contains(document.activeElement)
					? document.activeElement
					: null;
			if (inSettings) parent.append(sessionControls);
			else parent.insertBefore(sessionControls, byId("reader-status"));
			if (focused) {
				if (inSettings && !settingsDialog.open)
					byId("reader-settings").focus({ preventScroll: true });
				else focused.focus({ preventScroll: true });
			}
		}
		sessionSettings.hidden = !opened || !inSettings;
	}
	function render() {
		if (!opened) return;
		placeSessionControls();
		const phaseChanged = reader.dataset.phase !== state.phase;
		const capChanged = byId("over-target").hidden !== !state.overTarget;
		reader.dataset.phase = state.phase;
		reader.dataset.position = String(state.positionPx);
		reader.dataset.elapsed = String(state.elapsedMs);
		reader.dataset.end = String(state.layout.endPx);
		const playing = state.phase === "playing";
		const counting = state.phase === "countdown";
		const finished = state.phase === "finished";
		writeText(
			toggle,
			counting
				? "Cancel"
				: playing
					? "Pause"
					: finished
						? "Finished"
						: "Resume",
		);
		toggle.disabled = finished;
		sessionControls.hidden =
			sessionControls.parentElement !== sessionSettings &&
			(playing || counting) &&
			!wideScreen.matches;
		slider.disabled = playing || counting;
		const ratio =
			state.layout.endPx > 0 ? state.positionPx / state.layout.endPx : 0;
		slider.value = String(Math.round(ratio * 1000));
		slider.setAttribute(
			"aria-valuetext",
			`${Math.round(ratio * 100)}% through script`,
		);
		writeText(byId("elapsed"), formatClock(state.elapsedMs / 1000, "floor"));
		writeText(byId("percent"), `${Math.round(ratio * 100)}%`);
		const remaining = `${formatClock(remainingSec(state.positionPx, state.layout.endPx, state.pxPerSec), "ceil")} left`;
		writeText(byId("remaining"), remaining);
		writeText(byId("compact-remaining"), remaining);
		writeText(byId("over-target"), "Pace capped");
		writeText(
			byId("reader-state"),
			counting
				? "Get ready"
				: finished
					? "End of script"
					: playing
						? "Reading"
						: "Paused",
		);
		writeText(
			byId("reader-pace"),
			state.pace.mode === "wpm"
				? `${state.pace.wpm} wpm`
				: `Target ${formatClock(state.pace.targetSec)}`,
		);
		byId("over-target").hidden = !state.overTarget;
		byId("progress-fill").style.transform = `scaleX(${ratio})`;
		const dpr = window.devicePixelRatio || 1;
		const y = Math.round((guideOffset - state.positionPx) * dpr) / dpr;
		transform.style.transform = `translate3d(0, ${y}px, 0)`;
		byId("countdown").hidden = !counting;
		if (counting)
			writeText(
				byId("countdown"),
				String(
					countdownValue(
						performance.now(),
						state.countdownStartedMs ?? performance.now(),
					) ?? 1,
				),
			);
		if (phaseChanged || capChanged) queueMicrotask(measure);
	}
	function measure() {
		if (!opened || stage.clientHeight === 0 || content.clientWidth === 0)
			return;
		cacheAnchor();
		stageHeight = stage.clientHeight;
		const settings = getSettings();
		const typography = getComputedStyle(content);
		const lineHeight =
			Number.parseFloat(typography.lineHeight) ||
			Number.parseFloat(typography.fontSize) * settings.lineHeight;
		guideOffset = Math.min(
			Math.round(stageHeight * 0.38),
			Math.max(0, Math.floor(stageHeight - lineHeight)),
		);
		stage.style.setProperty("--guide-y", `${guideOffset}px`);
		blocks = Array.from(content.children, (block) => {
			const element = block as HTMLElement;
			return { top: element.offsetTop, height: element.offsetHeight };
		});
		const endPx = content.offsetHeight;
		state = relayout(
			state,
			{ endPx, words },
			resolveAnchor(blocks, anchor, endPx),
		);
		cacheAnchor();
		render();
	}
	wideScreen.addEventListener("change", render);
	compactScreen.addEventListener("change", render);
	settingsDialog.addEventListener("close", () => {
		placeSessionControls();
		if (opened) {
			render();
			queueMicrotask(measure);
		}
	});
	window.addEventListener("resize", measure);
	new ResizeObserver(measure).observe(stage);
	new ResizeObserver(measure).observe(content);
	function schedule() {
		cancelAnimationFrame(raf);
		raf = requestAnimationFrame(frame);
	}
	function frame(now: number) {
		if (!opened) return;
		if (state.phase === "countdown") {
			if (countdownValue(now, state.countdownStartedMs ?? now) === null)
				state = play(state, now);
		} else state = step(state, now);
		if (now - anchorAt >= 200) {
			cacheAnchor();
			anchorAt = now;
		}
		render();
		if (state.phase === "playing" || state.phase === "countdown") schedule();
		else cacheAnchor();
	}
	function pauseReader() {
		generation++;
		state = pause(state);
		cancelAnimationFrame(raf);
		cacheAnchor();
		render();
		queueMicrotask(measure);
	}
	function notice(message: string) {
		writeText(byId("reader-notice"), message);
		if (opened) queueMicrotask(measure);
	}
	function wantsWakeLock() {
		return (
			opened &&
			document.visibilityState === "visible" &&
			getSettings().keepAwake
		);
	}
	async function syncWakeLock() {
		if (!wantsWakeLock()) {
			const held = wakeLock;
			wakeLock = null;
			try {
				await held?.release();
			} catch {
				/* The browser may have released it already. */
			}
			return;
		}
		if (wakeLock || wakePending) return;
		if (!("wakeLock" in navigator)) {
			if (!wakeNoticeShown) {
				notice("Screen may lock.");
				wakeNoticeShown = true;
			}
			return;
		}
		wakePending = true;
		try {
			const sentinel = await navigator.wakeLock.request("screen");
			if (!wantsWakeLock()) {
				await sentinel.release();
				return;
			}
			wakeLock = sentinel;
			sentinel.addEventListener(
				"release",
				() => {
					if (wakeLock === sentinel) wakeLock = null;
				},
				{ once: true },
			);
		} catch {
			if (!wakeNoticeShown) {
				notice("Screen may lock.");
				wakeNoticeShown = true;
			}
		} finally {
			wakePending = false;
		}
	}
	async function toggleFullscreen() {
		if (!fullscreenSupported) return;
		try {
			if (document.fullscreenElement) await document.exitFullscreen();
			else await document.documentElement.requestFullscreen();
		} catch {
			notice("Fullscreen unavailable.");
		}
	}
	document.addEventListener("fullscreenchange", () => {
		writeText(
			byId("fullscreen-toggle"),
			document.fullscreenElement ? "Exit fullscreen" : "Enter fullscreen",
		);
	});
	byId("fullscreen-toggle").addEventListener("click", toggleFullscreen);
	/**
	 * Startup generation guard adapted from Pocket Teleprompter, Copyright (c) 2026 ttomohisa, MIT License.
	 * https://github.com/ttomohisa/htmlapps-pocket-teleprompter/blob/ad05bf6202bdb9a20e168e1f67521f0a73de90a5/src/index.template.html#L330
	 */
	async function startSession(fullscreen = false) {
		const token = ++generation;
		state = beginCountdown(state, performance.now());
		render();
		void syncWakeLock();
		if (fullscreen && fullscreenSupported && !document.fullscreenElement)
			await toggleFullscreen();
		if (token !== generation || !opened) return;
		const now = performance.now();
		state = getSettings().countdown
			? beginCountdown(state, now)
			: play(state, now);
		render();
		schedule();
	}
	function open(text: string) {
		if (opened || !text.trim()) return;
		opened = true;
		notice("");
		wakeNoticeShown = false;
		showView(reader, true);
		showView(editor, false);
		document.body.classList.add("reading");
		content.replaceChildren();
		for (const line of toBlocks(text)) {
			const block = document.createElement("div");
			block.className = "script-line";
			block.textContent = line;
			content.append(block);
		}
		words = countWords(text);
		state = createEngine(pace());
		anchor = { block: 0, fraction: 0, ratio: 0 };
		applySettings();
		measure();
		reader.focus({ preventScroll: true });
		void startSession(getSettings().fullscreen);
	}
	function close() {
		if (settingsDialog.open) settingsDialog.close();
		pauseReader();
		opened = false;
		sessionSettings.hidden = true;
		generation++;
		showView(reader, false);
		content.replaceChildren();
		showView(editor, true);
		document.body.classList.remove("reading");
		void syncWakeLock();
		if (document.fullscreenElement)
			void document.exitFullscreen().catch(() => {});
		byId("start-reading").focus({ preventScroll: true });
	}
	function togglePlayback() {
		if (state.phase === "playing" || state.phase === "countdown") pauseReader();
		else if (state.phase === "paused") {
			state = play(state, performance.now());
			void syncWakeLock();
			render();
			schedule();
		}
	}
	function seek(position: number) {
		state = seekTo(state, position);
		cacheAnchor();
		render();
	}
	function restartReader() {
		if (state.phase === "countdown") return;
		if (settingsDialog.open) settingsDialog.close();
		reader.focus({ preventScroll: true });
		pauseReader();
		state = restart(state);
		cacheAnchor();
		void startSession();
	}
	function applySettings() {
		if (opened) cacheAnchor();
		const settings = getSettings();
		content.style.setProperty("--reader-font", `${settings.fontSizePx}px`);
		content.style.setProperty(
			"--reader-line-height",
			String(settings.lineHeight),
		);
		content.style.setProperty("--reader-align", settings.align);
		content.classList.toggle("mirrored", settings.mirror);
		byId("reading-guide").hidden = !settings.guide;
		state = setPace(state, pace());
		if (opened) {
			measure();
			void syncWakeLock();
		}
	}
	function changePace(direction: number) {
		const settings = getSettings();
		updateSettings(
			settings.paceMode === "wpm"
				? { wpm: settings.wpm + direction * 5 }
				: { targetSec: settings.targetSec - direction * 5 },
		);
	}
	function shortcut(action: Shortcut) {
		const settings = getSettings();
		switch (action) {
			case "escape":
				if (document.fullscreenElement)
					void document.exitFullscreen().catch(() => {});
				else close();
				break;
			case "toggle":
				togglePlayback();
				break;
			case "slower":
				changePace(-1);
				break;
			case "faster":
				changePace(1);
				break;
			case "seek-back":
				seek(state.positionPx - settings.fontSizePx * settings.lineHeight);
				break;
			case "seek-forward":
				seek(state.positionPx + settings.fontSizePx * settings.lineHeight);
				break;
			case "page-back":
				seek(state.positionPx - stageHeight * 0.8);
				break;
			case "page-forward":
				seek(state.positionPx + stageHeight * 0.8);
				break;
			case "start":
				seek(0);
				break;
			case "end":
				seek(state.layout.endPx);
				break;
			case "restart":
				restartReader();
				break;
			case "mirror":
				updateSettings({ mirror: !settings.mirror });
				break;
			case "guide":
				updateSettings({ guide: !settings.guide });
				break;
			case "smaller":
				updateSettings({ fontSizePx: settings.fontSizePx - 2 });
				break;
			case "larger":
				updateSettings({ fontSizePx: settings.fontSizePx + 2 });
				break;
			case "fullscreen":
				void toggleFullscreen();
				break;
		}
	}
	document.addEventListener("keydown", (event) => {
		const target = event.target instanceof Element ? event.target : null;
		if (
			!opened ||
			document.querySelector("dialog[open]") ||
			(!reader.contains(target) && !reader.contains(document.activeElement))
		)
			return;
		const targetKind = target?.closest(
			"input,textarea,select,[contenteditable]",
		)
			? "editable"
			: target?.closest("button")
				? "button"
				: "other";
		const action = mapKey({
			key: event.key,
			targetKind,
			isComposing: event.isComposing,
			keyCode: event.keyCode,
			ctrlKey: event.ctrlKey,
			metaKey: event.metaKey,
			altKey: event.altKey,
			repeat: event.repeat,
			defaultPrevented: event.defaultPrevented,
		});
		if (!action) return;
		event.preventDefault();
		if (
			state.phase === "countdown" &&
			action !== "escape" &&
			action !== "toggle"
		)
			return;
		shortcut(action);
	});
	toggle.addEventListener("click", togglePlayback);
	byId("restart").addEventListener("click", restartReader);
	byId("exit-reader").addEventListener("click", close);
	byId("reader-settings").addEventListener("click", openSettings);
	slider.addEventListener("input", () =>
		seek((Number(slider.value) / 1000) * state.layout.endPx),
	);
	stage.addEventListener(
		"wheel",
		(event) => {
			if (event.ctrlKey) return;
			event.preventDefault();
			seek(state.positionPx + event.deltaY);
		},
		{ passive: false },
	);
	let pointer: {
		id: number;
		y: number;
		position: number;
		dragged: boolean;
		seekable: boolean;
	} | null = null;
	stage.addEventListener("pointerdown", (event) => {
		if (event.button !== 0 || (pointer && pointer.id !== event.pointerId))
			return;
		pointer = {
			id: event.pointerId,
			y: event.clientY,
			position: state.positionPx,
			dragged: false,
			seekable:
				(event.pointerType === "touch" || event.pointerType === "pen") &&
				(state.phase === "paused" || state.phase === "finished"),
		};
		stage.setPointerCapture(event.pointerId);
	});
	stage.addEventListener("pointermove", (event) => {
		if (!pointer || pointer.id !== event.pointerId) return;
		const delta = pointer.y - event.clientY;
		if (Math.abs(delta) > 5) pointer.dragged = true;
		if (pointer.seekable && pointer.dragged) seek(pointer.position + delta);
	});
	stage.addEventListener("pointerup", (event) => {
		if (!pointer || pointer.id !== event.pointerId) return;
		const tapped = !pointer.dragged;
		pointer = null;
		if (tapped) togglePlayback();
	});
	stage.addEventListener("pointercancel", () => {
		pointer = null;
	});
	function onHidden() {
		if (opened) {
			pauseReader();
			notice("Paused after leaving.");
		}
		void syncWakeLock();
	}
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "hidden") onHidden();
		else void syncWakeLock();
	});
	window.addEventListener("pagehide", onHidden);
	return {
		open,
		close,
		pause: pauseReader,
		applySettings,
		get opened() {
			return opened;
		},
	};
}
