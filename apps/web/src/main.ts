import "@fontsource-variable/montserrat";
import "./styles/base.css";
import "./styles/editor.css";
import "./styles/reader.css";
import "./styles/dialogs.css";
import { formatClock } from "./core/clock-format";
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
	LONG_LINK_CHARS,
	readScriptLink,
} from "./core/script-link";
import {
	type NumericSetting,
	nudgeSetting,
	type Settings,
	sanitizeSettings,
} from "./core/settings";
import { createStore, getStorage } from "./core/storage";
import { resolveTheme } from "./core/theme";
import { countWords, previewText } from "./core/words";
import { byId, writeText } from "./ui/dom";
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
		countWords(script.value),
	);
	store.savePrefs(settings);
	applyTheme();
	updateControls();
	reader.applySettings();
	updateSaveStatus();
}
function updateStats() {
	const words = countWords(script.value);
	const estimate = estimateSec(paceFromSettings(settings), words);
	writeText(
		byId("script-stats"),
		`${words.toLocaleString()} ${words === 1 ? "word" : "words"} · about ${formatClock(estimate.sec, "ceil")}${estimate.capped ? ` · capped at ${MAX_WPM} wpm` : ""}`,
	);
	for (const id of ["start-reading", "clear", "export"])
		byId<HTMLButtonElement>(id).disabled = !script.value.trim();
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
byId("export").addEventListener("click", () => {
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
	exportDialog.showModal();
});
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

byId("copy-script-link").addEventListener("click", async () => {
	const result = buildScriptLink(
		script.value,
		new URL(import.meta.env.BASE_URL, location.origin).href,
	);
	if (!result.ok) {
		writeText(byId("export-status"), result.reason);
		return;
	}
	const field = byId<HTMLInputElement>("script-link");
	field.value = result.url;
	field.hidden = false;
	byId("script-link-label").hidden = false;
	byId("script-link-hint").hidden = false;
	const long =
		result.url.length > LONG_LINK_CHARS
			? ` This link is ${Math.ceil(result.url.length / 1024)} KB; if it will not open, use a .txt file instead.`
			: "";
	try {
		await navigator.clipboard.writeText(result.url);
		writeText(
			byId("export-status"),
			`Script link copied. Open it in Moblin's private browser.${long}`,
		);
	} catch {
		field.focus();
		field.select();
		writeText(
			byId("export-status"),
			`Select the script link below and copy it.${long}`,
		);
	}
});
function loadScriptLink() {
	const incoming = readScriptLink(location.hash);
	if (!incoming) return;
	history.replaceState(null, "", location.pathname + location.search);
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
window.addEventListener("hashchange", loadScriptLink);
loadScriptLink();
