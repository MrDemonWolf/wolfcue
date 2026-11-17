import "@fontsource-variable/montserrat";
import "./styles/base.css";
import "./styles/editor.css";
import "./styles/reader.css";
import "./styles/dialogs.css";
import { formatClock } from "./core/clock-format";
import { spokenText } from "./core/cues";
import { defaultExportName, textFileName } from "./core/export-name";
import { MAX_TEXT_BYTES, validateImport } from "./core/import-validate";
import {
	estimateSec,
	MAX_WPM,
	paceFromSettings,
	seedTargetOnSwitch,
} from "./core/pace";
import {
	buildScriptLink,
	type IncomingLink,
	LONG_LINK_CHARS,
	parseScriptLink,
	readLinkBytes,
	type ScriptLinkResult,
} from "./core/script-link";
import {
	type NumericSetting,
	nudgeSetting,
	PACE_PRESETS,
	type Settings,
	sanitizeSettings,
} from "./core/settings";
import { createStore, getStorage } from "./core/storage";
import { resolveTheme } from "./core/theme";
import { countWords, previewText } from "./core/words";
import { byId, writeText } from "./ui/dom";
import { compressText, inflateBytes } from "./ui/link-codec";
import { createReader } from "./ui/reader";

const store = createStore(getStorage(() => localStorage));
let settings = store.prefs;
const script = byId<HTMLTextAreaElement>("script");
script.value = store.script;
const settingsDialog = byId<HTMLDialogElement>("settings-dialog");
const confirmation = byId<HTMLDialogElement>("confirm-dialog");
const exportDialog = byId<HTMLDialogElement>("export-dialog");
/** The open confirmation: what Accept does, and what to report on any other way out. */
let pending: { accept: () => void; cancel?: () => void } | null = null;
let importGeneration = 0;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
/** Name to offer on export; null means the dated default. */
let filename: string | null = null;
const reader = createReader(() => settings, updateSettings, openSettings);
const systemTheme = matchMedia("(prefers-color-scheme: dark)");
// Focus rings follow the last kind of input: keyboard shows them, taps do not.
// Focus that moves with no recent tap (VoiceOver, scripts after a delay)
// counts as keyboard, so assistive navigation keeps a visible ring.
let lastPointerAt = Number.NEGATIVE_INFINITY;
const markPointer = () => {
	lastPointerAt = performance.now();
	document.documentElement.dataset.input = "pointer";
};
document.addEventListener("pointerdown", markPointer, {
	capture: true,
	passive: true,
});
document.addEventListener("pointerup", markPointer, {
	capture: true,
	passive: true,
});
document.addEventListener(
	"keydown",
	(event) => {
		if (!event.metaKey && !event.ctrlKey)
			document.documentElement.dataset.input = "keyboard";
	},
	{ capture: true },
);
document.addEventListener(
	"focusin",
	() => {
		if (performance.now() - lastPointerAt > 800)
			document.documentElement.dataset.input = "keyboard";
	},
	{ capture: true },
);

let lastSaveStatus = store.status;
/** Visible save state; only a new failure is announced, through #file-status. */
function updateSaveStatus() {
	const status = store.status;
	writeText(
		byId("save-status"),
		status === "saved"
			? "Saved on this device"
			: status === "pending"
				? "Saving..."
				: "Not saved: storage is unavailable",
	);
	if (status === "not-saved" && lastSaveStatus !== "not-saved")
		fileStatus("Not saved: storage is unavailable. Export a copy.");
	lastSaveStatus = status;
}
/** Status suffix after replacing the script, honest about failed saves. */
function savedNote() {
	return store.status === "not-saved"
		? " Not saved on this device; export a copy."
		: " Keep an exported copy as a backup.";
}
function flushScript() {
	clearTimeout(saveTimer);
	store.flush();
	updateSaveStatus();
	writeText(byId("link-status"), "");
	prepareScriptLink();
}
function applyTheme() {
	if (settings.theme === "system")
		delete document.documentElement.dataset.theme;
	else document.documentElement.dataset.theme = settings.theme;
	const dark = resolveTheme(settings.theme, systemTheme.matches) === "dark";
	const label = `Switch to ${dark ? "light" : "dark"} theme`;
	const button = byId("theme-toggle");
	button.setAttribute("aria-label", label);
	button.title = label;
	document.getElementById("theme-sun")?.toggleAttribute("hidden", !dark);
	document.getElementById("theme-moon")?.toggleAttribute("hidden", dark);
}
function updateControls() {
	for (const field of document.querySelectorAll<
		HTMLInputElement | HTMLSelectElement
	>("[data-setting]")) {
		const key = field.dataset.setting as keyof Settings;
		const value = settings[key];
		if (field instanceof HTMLInputElement && field.type === "checkbox")
			field.checked = value === true;
		else if (field instanceof HTMLInputElement && field.type === "radio")
			field.checked = field.value === value;
		else field.value = String(value);
	}
	for (const field of document.querySelectorAll<HTMLElement>("[data-pace]"))
		field.hidden = field.dataset.pace !== settings.paceMode;
	for (const button of document.querySelectorAll<HTMLButtonElement>(
		"[data-preset-wpm]",
	))
		button.setAttribute(
			"aria-pressed",
			String(settings.wpm === Number(button.dataset.presetWpm)),
		);
	writeText(
		byId("pace-hint"),
		settings.paceMode === "target"
			? "Scroll completion, not speech timing. Maximum 300 wpm."
			: "",
	);
	updateStats();
}
function updateSettings(patch: Partial<Settings>) {
	settings = seedTargetOnSwitch(
		settings,
		sanitizeSettings({ ...settings, ...patch }),
		countWords(spokenText(script.value)),
	);
	store.savePrefs(settings);
	applyTheme();
	updateControls();
	reader.applySettings();
	updateSaveStatus();
}
function updateStats() {
	// Action cues are not spoken, so they do not count toward pace.
	const words = countWords(spokenText(script.value));
	const hasText = Boolean(script.value.trim());
	const estimate = estimateSec(paceFromSettings(settings), words);
	writeText(
		byId("script-stats"),
		hasText && words === 0
			? "0 words · add words to read; actions alone do not scroll"
			: `${words.toLocaleString()} ${words === 1 ? "word" : "words"} · about ${formatClock(estimate.sec, "ceil")}${estimate.capped ? ` · capped at ${MAX_WPM} wpm` : ""}`,
	);
	for (const id of ["quick-link", "clear", "export"])
		byId<HTMLButtonElement>(id).disabled = !hasText;
	// Reading needs spoken words; a script of only actions would flash past.
	byId<HTMLButtonElement>("start-reading").disabled = words === 0;
}
function invalidateImport() {
	importGeneration++;
	if (pending || confirmation.open) dismissConfirm();
	if (byId("file-status").textContent === "Reading file...") fileStatus("");
}
function replaceScript(text: string, name: string | null = null) {
	script.value = text;
	filename = name;
	saveScript(true);
}
function saveScript(immediate = false) {
	store.setScript(script.value);
	clearTimeout(saveTimer);
	if (immediate) flushScript();
	else saveTimer = setTimeout(flushScript, 400);
	updateStats();
	updateSaveStatus();
}
function openSettings() {
	invalidateImport();
	if (reader.opened) reader.pause();
	settingsDialog.dataset.context = reader.opened ? "reader" : "editor";
	settingsDialog.showModal();
}
function ask(
	title: string,
	message: string,
	accept: string,
	action: () => void,
	onCancel?: () => void,
) {
	writeText(byId("confirm-title"), title);
	writeText(byId("confirm-message"), message);
	writeText(byId("confirm-accept"), accept);
	pending = { accept: action, cancel: onCancel };
	confirmation.showModal();
	byId("confirm-cancel").focus();
}
/** Cancel, Escape, a backdrop tap and newer actions all leave through here. */
function dismissConfirm() {
	const current = pending;
	pending = null;
	importGeneration++;
	if (confirmation.open) confirmation.close();
	current?.cancel?.();
}
byId("confirm-cancel").addEventListener("click", dismissConfirm);
byId("confirm-accept").addEventListener("click", () => {
	const current = pending;
	pending = null;
	confirmation.close();
	current?.accept();
});
confirmation.addEventListener("cancel", (event) => {
	event.preventDefault();
	dismissConfirm();
});
/** One-line description of incoming text so a replacement is recognizable. */
function describeText(text: string) {
	const words = countWords(text);
	return `"${previewText(text)}" (${words.toLocaleString()} ${words === 1 ? "word" : "words"})`;
}
for (const button of document.querySelectorAll<HTMLButtonElement>(
	"[data-close]",
)) {
	button.addEventListener("click", () =>
		byId<HTMLDialogElement>(button.dataset.close ?? "").close(),
	);
}
for (const dialog of document.querySelectorAll<HTMLDialogElement>("dialog")) {
	// WebKit can leave a focused text field partly clipped in a short dialog;
	// settle it fully inside the scroll area instead.
	dialog.addEventListener("focusin", (event) => {
		if (
			event.target instanceof HTMLInputElement ||
			event.target instanceof HTMLTextAreaElement
		)
			event.target.scrollIntoView({ block: "nearest", inline: "nearest" });
	});
	dialog.addEventListener("click", (event) => {
		if (event.target !== dialog) return;
		const bounds = dialog.getBoundingClientRect();
		if (
			event.clientX < bounds.left ||
			event.clientX > bounds.right ||
			event.clientY < bounds.top ||
			event.clientY > bounds.bottom
		) {
			if (dialog === confirmation) dismissConfirm();
			else dialog.close();
		}
	});
}
byId("editor-settings").addEventListener("click", openSettings);
byId("theme-toggle").addEventListener("click", () => {
	const current = resolveTheme(settings.theme, systemTheme.matches);
	const next = current === "dark" ? "light" : "dark";
	// Matching the phone again means following it again.
	const system = systemTheme.matches ? "dark" : "light";
	updateSettings({ theme: next === system ? "system" : next });
});
systemTheme.addEventListener("change", applyTheme);
for (const field of document.querySelectorAll<
	HTMLInputElement | HTMLSelectElement
>("[data-setting]")) {
	field.addEventListener("change", () => {
		if (
			field instanceof HTMLInputElement &&
			field.type === "radio" &&
			!field.checked
		)
			return;
		// An empty or partial number restores the current value instead of the minimum.
		if (
			field instanceof HTMLInputElement &&
			field.type === "number" &&
			(field.value.trim() === "" || !Number.isFinite(field.valueAsNumber))
		) {
			updateControls();
			return;
		}
		const value =
			field instanceof HTMLInputElement && field.type === "checkbox"
				? field.checked
				: field instanceof HTMLInputElement && field.type === "number"
					? field.valueAsNumber
					: field.value;
		updateSettings({ [field.dataset.setting ?? ""]: value });
	});
}
for (const group of document.querySelectorAll<HTMLElement>(
	".pace-presets .preset-row",
))
	for (const preset of PACE_PRESETS) {
		const button = document.createElement("button");
		button.type = "button";
		button.dataset.presetWpm = String(preset.wpm);
		button.setAttribute(
			"aria-label",
			`${preset.label}, ${preset.wpm} words per minute`,
		);
		const name = document.createElement("span");
		name.textContent = preset.label;
		const value = document.createElement("span");
		value.className = "preset-wpm";
		value.textContent = String(preset.wpm);
		button.append(name, value);
		button.addEventListener("click", () =>
			updateSettings({ paceMode: "wpm", wpm: preset.wpm }),
		);
		group.append(button);
	}
for (const button of document.querySelectorAll<HTMLButtonElement>(
	"[data-adjust]",
)) {
	button.addEventListener("click", () => {
		const key = button.dataset.adjust as NumericSetting;
		updateSettings({
			[key]: nudgeSetting(key, settings[key], Number(button.dataset.direction)),
		});
	});
}
script.addEventListener("input", () => {
	invalidateImport();
	saveScript();
});
byId("start-reading").addEventListener("click", () => {
	invalidateImport();
	flushScript();
	reader.open(script.value);
});
byId("clear").addEventListener("click", () => {
	invalidateImport();
	if (!script.value) return;
	ask(
		"Clear script?",
		"This discards the current script from WolfCue. Export a copy first if you need it.",
		"Clear",
		() => {
			replaceScript("");
			script.focus();
		},
	);
});
byId("erase-data").addEventListener("click", () => {
	settingsDialog.close();
	invalidateImport();
	ask(
		"Erase all local data?",
		"This removes your script, preferences and theme from this browser. Export a copy first if you need it.",
		"Erase",
		() => {
			clearTimeout(saveTimer);
			if (reader.opened) reader.close();
			store.erase();
			script.value = "";
			filename = null;
			// Forget any prepared or shown script link too.
			linkJob++;
			preparedLink = null;
			preparedText = null;
			writeText(byId("link-status"), "");
			byId<HTMLInputElement>("script-link").value = "";
			byId<HTMLTextAreaElement>("copy-fallback").value = "";
			settings = store.prefs;
			applyTheme();
			updateControls();
			updateSaveStatus();
			reader.applySettings();
		},
	);
});
const fileInput = byId<HTMLInputElement>("file-input");
byId("import").addEventListener("click", () => {
	invalidateImport();
	fileInput.value = "";
	fileInput.click();
});
function fileStatus(message: string) {
	writeText(byId("file-status"), message);
}
/**
 * Import generation guard adapted from Pocket Teleprompter, Copyright (c) 2026 ttomohisa, MIT License.
 * https://github.com/ttomohisa/htmlapps-pocket-teleprompter/blob/ad05bf6202bdb9a20e168e1f67521f0a73de90a5/src/index.template.html#L258
 */
async function importFile(file: File | undefined) {
	invalidateImport();
	if (!file || reader.opened) return;
	const token = importGeneration;
	if (!/\.txt$/i.test(file.name)) {
		fileStatus("Choose a .txt file.");
		return;
	}
	if (file.size > MAX_TEXT_BYTES) {
		fileStatus("The file is larger than 1 MiB. Your script has not changed.");
		return;
	}
	fileStatus("Reading file...");
	try {
		const bytes = new Uint8Array(await file.arrayBuffer());
		if (token !== importGeneration || reader.opened) return;
		const result = validateImport(bytes, file.name);
		if (!result.ok) {
			fileStatus(result.reason);
			return;
		}
		const apply = () => {
			if (token !== importGeneration || reader.opened) return;
			replaceScript(result.text, textFileName(file.name));
			fileStatus(`Script imported.${savedNote()}`);
			script.focus();
		};
		if (script.value.trim() && script.value !== result.text) {
			fileStatus("");
			ask(
				"Replace script?",
				`This file contains different text: ${describeText(result.text)}. Replace your current script?`,
				"Replace",
				apply,
				() => fileStatus("Import canceled. Your script has not changed."),
			);
		} else apply();
	} catch {
		if (token === importGeneration)
			fileStatus("Could not read this file. Your script has not changed.");
	}
}
fileInput.addEventListener("change", () => {
	const file = fileInput.files?.[0];
	fileInput.value = "";
	void importFile(file);
});
fileInput.addEventListener("cancel", invalidateImport);
function exportFile() {
	return new File(
		[script.value],
		textFileName(byId<HTMLInputElement>("export-filename").value),
		{ type: "text/plain;charset=utf-8" },
	);
}
function openExport() {
	byId<HTMLInputElement>("export-filename").value =
		filename ?? defaultExportName(new Date());
	byId("script-link").hidden = true;
	byId("script-link-label").hidden = true;
	byId("script-link-hint").hidden = true;
	byId("copy-fallback").hidden = true;
	byId("copy-fallback-label").hidden = true;
	writeText(byId("export-status"), "");
	let shareSupported = false;
	try {
		shareSupported = Boolean(
			typeof navigator.share === "function" &&
				navigator.canShare?.({ files: [exportFile()] }),
		);
	} catch {
		/* Share support can vary by file type. */
	}
	byId("share-file").hidden = !shareSupported;
	prepareScriptLink();
	exportDialog.showModal();
}
byId("export").addEventListener("click", openExport);
/** Keep an edited export name for this session; the dated default stays current. */
function commitFileName(file: File) {
	if (file.name !== defaultExportName(new Date())) filename = file.name;
	byId<HTMLInputElement>("export-filename").value = file.name;
}
byId("share-file").addEventListener("click", async () => {
	try {
		const file = exportFile();
		commitFileName(file);
		await navigator.share({ files: [file] });
		writeText(
			byId("export-status"),
			"Share sheet closed. Check where you saved the file.",
		);
	} catch (error) {
		writeText(
			byId("export-status"),
			error instanceof DOMException && error.name === "AbortError"
				? "Sharing canceled. Your script is unchanged."
				: "Sharing is unavailable. Try Copy text.",
		);
	}
});
byId("download-file").addEventListener("click", () => {
	let url: string | null = null;
	const link = document.createElement("a");
	try {
		const file = exportFile();
		commitFileName(file);
		url = URL.createObjectURL(file);
		link.href = url;
		link.download = file.name;
		document.body.append(link);
		link.click();
		writeText(
			byId("export-status"),
			"Download requested. Check your browser's files; in-app browsers may block it.",
		);
	} catch {
		writeText(
			byId("export-status"),
			"Could not request a download. Try Copy text.",
		);
	} finally {
		link.remove();
		if (url) {
			const objectUrl = url;
			setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
		}
	}
});
byId("copy-text").addEventListener("click", async () => {
	try {
		await navigator.clipboard.writeText(script.value);
		writeText(byId("export-status"), "Text copied.");
	} catch {
		const fallback = byId<HTMLTextAreaElement>("copy-fallback");
		fallback.value = script.value;
		fallback.hidden = false;
		byId("copy-fallback-label").hidden = false;
		fallback.focus();
		fallback.select();
		writeText(
			byId("export-status"),
			"Copy is unavailable here. Select the text below and use your browser's Copy command.",
		);
	}
});
window.addEventListener("pagehide", flushScript);
document.addEventListener("visibilitychange", () => {
	if (document.visibilityState === "hidden") flushScript();
});
writeText(byId("year"), String(new Date().getFullYear()));
if (__COMMIT_HASH__ !== "dev") {
	const link = document.createElement("a");
	link.href = `https://github.com/MrDemonWolf/wolfcue/commit/${__COMMIT_HASH__}`;
	link.textContent = __COMMIT_HASH__.slice(0, 7);
	link.setAttribute(
		"aria-label",
		`View build commit ${__COMMIT_HASH__.slice(0, 7)}`,
	);
	byId("build-stamp").replaceChildren("Build ", link);
}
applyTheme();
updateControls();
updateSaveStatus();

/**
 * Script links are compressed when that is shorter. Compression is async, so
 * the link is prepared when Export opens; copying it then needs no await,
 * which keeps Safari's clipboard permission for the tap.
 */
let preparedLink: ScriptLinkResult | null = null;
let preparedText: string | null = null;
let linkJob = 0;
const linkBase = () => new URL(import.meta.env.BASE_URL, location.origin).href;
/** Compresses the current script in the background so a copy tap never waits. */
function prepareScriptLink() {
	const text = script.value;
	if (preparedLink && preparedText === text) return;
	const job = ++linkJob;
	void compressText(text).then((compressed) => {
		if (job !== linkJob) return;
		preparedText = text;
		preparedLink = buildScriptLink(text, linkBase(), compressed);
	});
}
/**
 * The compressed link when it is ready for this exact text, otherwise the
 * plain link at once: waiting would lose Safari's clipboard permission.
 */
function currentScriptLink(): ScriptLinkResult {
	return preparedLink && preparedText === script.value
		? preparedLink
		: buildScriptLink(script.value, linkBase());
}
function longLinkNote(url: string) {
	return url.length > LONG_LINK_CHARS
		? ` This link is ${Math.ceil(url.length / 1024)} KB; if it will not open, use a .txt file instead.`
		: "";
}
/** Shows the link in Export; selects it when the clipboard is blocked. */
function showScriptLink(url: string, select: boolean) {
	const field = byId<HTMLInputElement>("script-link");
	field.value = url;
	field.hidden = false;
	byId("script-link-label").hidden = false;
	byId("script-link-hint").hidden = false;
	if (select) {
		field.focus();
		field.select();
		writeText(
			byId("export-status"),
			`Select the script link below and copy it.${longLinkNote(url)}`,
		);
	}
}
byId("copy-script-link").addEventListener("click", async () => {
	const result = currentScriptLink();
	if (!result.ok) {
		writeText(byId("export-status"), result.reason);
		return;
	}
	showScriptLink(result.url, false);
	try {
		await navigator.clipboard.writeText(result.url);
		writeText(
			byId("export-status"),
			`Script link copied. Open it in Moblin's private browser.${longLinkNote(result.url)}`,
		);
	} catch {
		showScriptLink(result.url, true);
	}
});
byId("quick-link").addEventListener("click", async () => {
	const result = currentScriptLink();
	if (!result.ok) {
		writeText(byId("link-status"), result.reason);
		return;
	}
	try {
		await navigator.clipboard.writeText(result.url);
		writeText(
			byId("link-status"),
			`Link copied. Open it in Moblin's private browser. Anyone with the link can read it.${longLinkNote(result.url)}`,
		);
	} catch {
		// Blocked clipboard: hand over the selectable link in Export.
		openExport();
		showScriptLink(result.url, true);
	}
});
const INFLATE_REASONS = {
	size: "This script link is larger than 1 MiB.",
	unsupported:
		"This browser cannot open compressed script links. Use a .txt file instead.",
	invalid: "This script link contains invalid text.",
} as const;
async function inflateLink(bytes: Uint8Array): Promise<IncomingLink> {
	const inflated = await inflateBytes(bytes, MAX_TEXT_BYTES);
	return inflated.ok
		? readLinkBytes(inflated.bytes)
		: { ok: false, reason: INFLATE_REASONS[inflated.problem] };
}
let incomingJob = 0;
async function loadScriptLink() {
	const payload = parseScriptLink(location.hash);
	if (!payload) return;
	history.replaceState(null, "", location.pathname + location.search);
	const job = ++incomingJob;
	const generation = importGeneration;
	const incoming =
		payload.kind === "text" ? payload.result : await inflateLink(payload.bytes);
	// A newer link replaced this one while it was inflating.
	if (job !== incomingJob) return;
	// Typing, clearing or importing during inflation wins over the link.
	if (generation !== importGeneration) {
		fileStatus("Link not loaded because the script changed. Open it again.");
		return;
	}
	// Reopening a link that matches the current script changes nothing.
	if (incoming.ok && incoming.text === script.value) {
		if (!reader.opened) fileStatus("This link matches your current script.");
		return;
	}
	invalidateImport();
	if (reader.opened) reader.pause();
	if (!incoming.ok) {
		const message = `${incoming.reason} Your script has not changed.`;
		fileStatus(message);
		if (reader.opened) writeText(byId("reader-notice"), "Link invalid.");
		return;
	}
	const token = importGeneration;
	const apply = () => {
		if (token !== importGeneration) return;
		if (reader.opened) reader.close();
		replaceScript(incoming.text);
		fileStatus(
			`Linked script loaded. Choose Start reading when you are ready.${store.status === "not-saved" ? " Not saved on this device." : ""}`,
		);
	};
	if (script.value.trim())
		ask(
			"Load linked script?",
			`This link contains different text: ${describeText(incoming.text)}. If you did not just open a link, choose Cancel.`,
			"Load script",
			apply,
			() => fileStatus("Link not loaded. Your script has not changed."),
		);
	else apply();
}
window.addEventListener("hashchange", () => void loadScriptLink());
void loadScriptLink();
prepareScriptLink();
