import { type Block, captureAnchor, resolveAnchor } from "../core/anchor";
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
import { dimHeightPx, guideOffsetPx } from "../core/guide";
import { paceFromSettings, remainingSec } from "../core/pace";
import { toBlocks } from "../core/render-plan";
import { nudgeSetting, type Settings } from "../core/settings";
import { mapKey, type Shortcut } from "../core/shortcuts";
import { countWords } from "../core/words";
import { byId, showView, writeText } from "./dom";

/** Ignore the main button briefly after the script ends, so a late Pause tap cannot restart a take. */
const FINISH_GUARD_MS = 600;
const WAKE_NOTICE = "Screen may lock.";

export function createReader(
	getSettings: () => Settings,
	updateSettings: (patch: Partial<Settings>) => void,
	openSettings: () => void,
) {
	const reader = byId("reader");
	const compactScreen = matchMedia("(max-width:300px), (max-height:300px)");
	const chrome = byId("reader-chrome");
	const topbar = byId("reader-topbar");
	const sessionControls = byId("paused-controls");
	const sessionSettings = byId("reader-session-controls");
	const settingsDialog = byId<HTMLDialogElement>("settings-dialog");
	const editor = byId("editor");
	const stage = byId("stage");
	const content = byId("script-content");
	const transform = byId("script-transform");
	const toggle = byId<HTMLButtonElement>("toggle-play");
	const slider = byId<HTMLInputElement>("seek");
	const elapsedOutput = byId("elapsed");
	const percentOutput = byId("percent");
	const remainingText = byId("remaining");
	const overTarget = byId("over-target");
	const readerState = byId("reader-state");
	const readerPace = byId("reader-pace");
	const progressFill = byId("progress-fill");
	const countdown = byId("countdown");
	const noticeText = byId("reader-notice");
	const guide = byId("reading-guide");
	const readDim = byId("read-dim");
	const fullscreenToggle = byId("fullscreen-toggle");
	let state = createEngine();
	let opened = false;
	let raf = 0;
	let generation = 0;
	let blocks: Block[] = [];
	let stageHeight = 0;
	let guideOffset = 0;
	let words = 0;
	let typography = "";
	let sliderValue = -1;
	let finishedAt = 0;
	let measurePending = false;
	let wakeLock: WakeLockSentinel | null = null;
	let wakePending = false;
	let wakeUnavailable = false;
	/** Active stage gesture: a tap toggles playback, a drag seeks while paused. */
	let pointer: {
		id: number;
		x: number;
		y: number;
		position: number;
		slop: number;
		dragged: boolean;
		seekable: boolean;
	} | null = null;
	const fullscreenSupported = Boolean(
		document.fullscreenEnabled && document.documentElement.requestFullscreen,
	);
	byId("fullscreen-setting-row").hidden = !fullscreenSupported;
	fullscreenToggle.hidden = !fullscreenSupported;
	const pace = (): Pace => paceFromSettings(getSettings());
	/** Compact windows keep Restart, Exit and Position in Settings. */
	function placeSessionControls() {
		const inSettings =
			compactScreen.matches ||
			(settingsDialog.open &&
				sessionControls.parentElement === sessionSettings);
		const parent = inSettings ? sessionSettings : chrome;
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
		const phaseChanged = reader.dataset.phase !== state.phase;
		const capChanged = overTarget.hidden !== !state.overTarget;
		reader.dataset.phase = state.phase;
		reader.dataset.position = String(state.positionPx);
		reader.dataset.elapsed = String(state.elapsedMs);
		reader.dataset.end = String(state.layout.endPx);
		const playing = state.phase === "playing";
		const counting = state.phase === "countdown";
		const finished = state.phase === "finished";
		if (phaseChanged && finished) finishedAt = performance.now();
		writeText(
			toggle,
			counting ? "Cancel" : playing ? "Pause" : finished ? "Restart" : "Resume",
		);
		sessionControls.hidden =
			sessionControls.parentElement !== sessionSettings &&
			(playing || counting);
		slider.disabled = playing || counting;
		const ratio =
			state.layout.endPx > 0 ? state.positionPx / state.layout.endPx : 0;
		const perMille = Math.round(ratio * 1000);
		if (perMille !== sliderValue) {
			sliderValue = perMille;
			slider.value = String(perMille);
			slider.setAttribute(
				"aria-valuetext",
				`${Math.round(ratio * 100)}% through script`,
			);
		}
		writeText(elapsedOutput, formatClock(state.elapsedMs / 1000, "floor"));
		writeText(percentOutput, `${Math.round(ratio * 100)}%`);
		writeText(
			remainingText,
			`${formatClock(remainingSec(state.positionPx, state.layout.endPx, state.pxPerSec), "ceil")} left`,
		);
		writeText(
			readerState,
			counting
				? "Get ready"
				: finished
					? "End of script"
					: playing
						? "Reading"
						: "Paused",
		);
		writeText(
			readerPace,
			state.pace.mode === "wpm"
				? `${state.pace.wpm} wpm`
				: `Target ${formatClock(state.pace.targetSec)}`,
		);
		overTarget.hidden = !state.overTarget;
		progressFill.style.transform = `scaleX(${ratio})`;
		const dpr = window.devicePixelRatio || 1;
		const y = Math.round((guideOffset - state.positionPx) * dpr) / dpr;
		transform.style.transform = `translate3d(0, ${y}px, 0)`;
		countdown.hidden = !counting;
		if (counting) {
			const now = performance.now();
			writeText(
				countdown,
				String(countdownValue(now, state.countdownStartedMs ?? now) ?? 1),
			);
		}
		if (phaseChanged || capChanged) requestMeasure();
	}
	/** Paused controls that push the stage down on narrow screens. */
	function reservedAboveStage(): number {
		if (sessionControls.hidden || sessionControls.parentElement !== chrome)
			return 0;
		const sameRow =
			sessionControls.offsetTop < topbar.offsetTop + topbar.offsetHeight;
		return sameRow
			? Math.max(0, sessionControls.offsetHeight - topbar.offsetHeight)
			: sessionControls.offsetHeight;
	}
	function measure() {
		measurePending = false;
		if (!opened || stage.clientHeight === 0 || content.clientWidth === 0)
			return;
		// Capture the reading position against the previous geometry first.
		const anchor = captureAnchor(blocks, state.positionPx, state.layout.endPx);
		stageHeight = stage.clientHeight;
		const settings = getSettings();
		const style = getComputedStyle(content);
		const lineHeight =
			Number.parseFloat(style.lineHeight) ||
			Number.parseFloat(style.fontSize) * settings.lineHeight;
		guideOffset = guideOffsetPx(stageHeight, lineHeight, reservedAboveStage());
		stage.style.setProperty("--guide-y", `${guideOffset}px`);
		stage.style.setProperty(
			"--dim-y",
			`${dimHeightPx(guideOffset, lineHeight)}px`,
		);
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
		render();
	}
	function requestMeasure() {
		if (measurePending) return;
		measurePending = true;
		queueMicrotask(measure);
	}
	compactScreen.addEventListener("change", () => {
		placeSessionControls();
		render();
	});
	settingsDialog.addEventListener("close", () => {
		placeSessionControls();
		if (opened) {
			render();
			requestMeasure();
		}
	});
	const resizeObserver = new ResizeObserver(() => requestMeasure());
	resizeObserver.observe(stage);
	resizeObserver.observe(content);
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
		render();
		if (state.phase === "playing" || state.phase === "countdown") schedule();
	}
	function pauseReader() {
		generation++;
		state = pause(state);
		cancelAnimationFrame(raf);
		render();
		requestMeasure();
	}
	function notice(message: string) {
		if (noticeText.textContent === message) return;
		noticeText.textContent = message;
		if (opened) requestMeasure();
	}
	/** Starting or resuming clears old notices but keeps the wake lock warning. */
	function clearNotice() {
		notice(wakeUnavailable ? WAKE_NOTICE : "");
	}
	function setWakeUnavailable(unavailable: boolean) {
		if (wakeUnavailable === unavailable) return;
		wakeUnavailable = unavailable;
		if (unavailable) notice(WAKE_NOTICE);
		else if (noticeText.textContent === WAKE_NOTICE) notice("");
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
			setWakeUnavailable(true);
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
			setWakeUnavailable(false);
			sentinel.addEventListener(
				"release",
				() => {
					if (wakeLock !== sentinel) return;
					wakeLock = null;
					// The system revoked the lock while reading is still on screen.
					if (wantsWakeLock()) setWakeUnavailable(true);
				},
				{ once: true },
			);
		} catch {
			setWakeUnavailable(true);
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
			fullscreenToggle,
			document.fullscreenElement ? "Exit fullscreen" : "Enter fullscreen",
		);
	});
	fullscreenToggle.addEventListener("click", toggleFullscreen);
	/**
	 * Startup generation guard adapted from Pocket Teleprompter, Copyright (c) 2026 ttomohisa, MIT License.
	 * https://github.com/ttomohisa/htmlapps-pocket-teleprompter/blob/ad05bf6202bdb9a20e168e1f67521f0a73de90a5/src/index.template.html#L330
	 */
	async function startSession(fullscreen = false) {
		const token = ++generation;
		clearNotice();
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
		wakeUnavailable = false;
		notice("");
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
		blocks = [];
		pointer = null;
		sliderValue = -1;
		state = createEngine(pace());
		placeSessionControls();
		applySettings();
		measure();
		reader.focus({ preventScroll: true });
		void startSession(getSettings().fullscreen);
	}
	function close() {
		if (settingsDialog.open) settingsDialog.close();
		pauseReader();
		opened = false;
		pointer = null;
		placeSessionControls();
		generation++;
		showView(reader, false);
		content.replaceChildren();
		blocks = [];
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
			clearNotice();
			void syncWakeLock();
			render();
			schedule();
		}
	}
	function seek(position: number) {
		state = seekTo(state, position);
		render();
	}
	function restartReader() {
		if (state.phase === "countdown") return;
		if (settingsDialog.open) settingsDialog.close();
		reader.focus({ preventScroll: true });
		pauseReader();
		state = restart(state);
		void startSession();
	}
	function applySettings() {
		const settings = getSettings();
		content.style.setProperty("--reader-font", `${settings.fontSizePx}px`);
		content.style.setProperty(
			"--reader-line-height",
			String(settings.lineHeight),
		);
		content.style.setProperty("--reader-align", settings.align);
		content.classList.toggle("mirrored", settings.mirror);
		guide.hidden = !settings.guide;
		readDim.hidden = !settings.guide;
		state = setPace(state, pace());
		if (!opened) return;
		const next = `${settings.fontSizePx}|${settings.lineHeight}|${settings.align}`;
		// Only typography changes move lines; pace and theme only need a render.
		if (next !== typography) {
			typography = next;
			measure();
		} else render();
		void syncWakeLock();
	}
	function changePace(direction: number) {
		const settings = getSettings();
		// Faster means a higher wpm or a shorter target time.
		updateSettings(
			settings.paceMode === "wpm"
				? { wpm: nudgeSetting("wpm", settings.wpm, direction) }
				: {
						targetSec: nudgeSetting(
							"targetSec",
							settings.targetSec,
							-direction,
						),
					},
		);
	}
	function shortcut(action: Shortcut) {
		const settings = getSettings();
		const line = settings.fontSizePx * settings.lineHeight;
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
				seek(state.positionPx - line);
				break;
			case "seek-forward":
				seek(state.positionPx + line);
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
				updateSettings({
					fontSizePx: nudgeSetting("fontSizePx", settings.fontSizePx, -1),
				});
				break;
			case "larger":
				updateSettings({
					fontSizePx: nudgeSetting("fontSizePx", settings.fontSizePx, 1),
				});
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
	toggle.addEventListener("click", () => {
		if (state.phase !== "finished") togglePlayback();
		else if (performance.now() - finishedAt >= FINISH_GUARD_MS) restartReader();
	});
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
	stage.addEventListener("pointerdown", (event) => {
		if (event.button !== 0) return;
		// A new primary pointer replaces a record whose release was lost.
		if (pointer && pointer.id !== event.pointerId && !event.isPrimary) return;
		const touch = event.pointerType === "touch" || event.pointerType === "pen";
		pointer = {
			id: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			position: state.positionPx,
			slop: touch ? 10 : 5,
			dragged: false,
			seekable:
				touch && (state.phase === "paused" || state.phase === "finished"),
		};
		stage.setPointerCapture(event.pointerId);
	});
	stage.addEventListener("pointermove", (event) => {
		if (!pointer || pointer.id !== event.pointerId) return;
		const dy = pointer.y - event.clientY;
		if (Math.hypot(event.clientX - pointer.x, dy) > pointer.slop)
			pointer.dragged = true;
		if (pointer.seekable && pointer.dragged) seek(pointer.position + dy);
	});
	stage.addEventListener("pointerup", (event) => {
		if (!pointer || pointer.id !== event.pointerId) return;
		const tapped = !pointer.dragged;
		pointer = null;
		if (tapped) togglePlayback();
	});
	const dropPointer = (event: PointerEvent) => {
		if (pointer?.id === event.pointerId) pointer = null;
	};
	stage.addEventListener("pointercancel", dropPointer);
	stage.addEventListener("lostpointercapture", dropPointer);
	function onHidden() {
		if (opened) {
			const running = state.phase === "playing" || state.phase === "countdown";
			pointer = null;
			pauseReader();
			if (running) notice("Paused after leaving.");
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
