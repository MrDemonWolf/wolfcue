import "@fontsource-variable/montserrat";
import "./styles/base.css";
import "./styles/editor.css";
import "./styles/reader.css";
import "./styles/dialogs.css";
import { formatClock } from "./core/clock-format";
import { textFileName } from "./core/export-name";
import { MAX_TEXT_BYTES, validateImport } from "./core/import-validate";
import { buildScriptLink, readScriptLink } from "./core/script-link";
import { type Settings, sanitizeSettings } from "./core/settings";
import { createStore, getStorage } from "./core/storage";
import { countWords } from "./core/words";
import { byId, writeText } from "./ui/dom";
import { createReader } from "./ui/reader";

const store = createStore(getStorage(() => localStorage));
let settings = store.prefs;
const script = byId<HTMLTextAreaElement>("script");
script.value = store.script;
const settingsDialog = byId<HTMLDialogElement>("settings-dialog");
const confirmation = byId<HTMLDialogElement>("confirm-dialog");
const exportDialog = byId<HTMLDialogElement>("export-dialog");
let confirmAction: (() => void) | null = null;
let importGeneration = 0;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let filename = "wolfcue-script.txt";
const reader = createReader(() => settings, updateSettings, openSettings);

function updateSaveStatus() {
	writeText(
		byId("save-status"),
		store.status === "saved"
			? "Saved on this device"
			: "Not saved: storage is unavailable",
	);
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
			? "Approximate scroll completion, not a measurement of speech. Capped at 300 wpm."
			: "A comfortable starting point. Adjust as you read.",
	);
	updateStats();
}
function updateSettings(patch: Partial<Settings>) {
	settings = sanitizeSettings({ ...settings, ...patch });
	store.savePrefs(settings);
	applyTheme();
	updateControls();
	reader.applySettings();
	updateSaveStatus();
}
function updateStats() {
	const words = countWords(script.value);
	const estimate =
		settings.paceMode === "target"
			? settings.targetSec
			: (words / settings.wpm) * 60;
	writeText(
		byId("script-stats"),
		`${words.toLocaleString()} ${words === 1 ? "word" : "words"} · about ${formatClock(estimate, "ceil")}`,
	);
	for (const id of ["start-reading", "clear", "export"])
		byId<HTMLButtonElement>(id).disabled = !script.value.trim();
}
function invalidateImport() {
	importGeneration++;
	if (confirmation.open) confirmation.close();
	confirmAction = null;
}
function saveScript(immediate = false) {
	store.setScript(script.value);
	clearTimeout(saveTimer);
	if (immediate) flushScript();
	else saveTimer = setTimeout(flushScript, 400);
	updateStats();
}
function openSettings() {
	invalidateImport();
	if (reader.opened) reader.pause();
	settingsDialog.showModal();
}
function ask(
	title: string,
	message: string,
	accept: string,
	action: () => void,
) {
	writeText(byId("confirm-title"), title);
	writeText(byId("confirm-message"), message);
	writeText(byId("confirm-accept"), accept);
	confirmAction = action;
	confirmation.showModal();
	byId("confirm-cancel").focus();
}
byId("confirm-cancel").addEventListener("click", () => {
	confirmAction = null;
	confirmation.close();
});
byId("confirm-accept").addEventListener("click", () => {
	const action = confirmAction;
	confirmAction = null;
	confirmation.close();
	action?.();
});
confirmation.addEventListener("cancel", () => {
	confirmAction = null;
	importGeneration++;
});
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
			if (dialog === confirmation) {
				confirmAction = null;
				importGeneration++;
			}
			dialog.close();
		}
	});
}
byId("editor-settings").addEventListener("click", openSettings);
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
		const value =
			field instanceof HTMLInputElement && field.type === "checkbox"
				? field.checked
				: field instanceof HTMLInputElement && field.type === "number"
					? Number(field.value)
					: field.value;
		updateSettings({ [field.dataset.setting ?? ""]: value });
	});
}
for (const button of document.querySelectorAll<HTMLButtonElement>(
	"[data-adjust]",
)) {
	button.addEventListener("click", () => {
		const key = button.dataset.adjust as "wpm" | "targetSec" | "fontSizePx";
		updateSettings({ [key]: settings[key] + Number(button.dataset.delta) });
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
			script.value = "";
			filename = "wolfcue-script.txt";
			saveScript(true);
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
			filename = "wolfcue-script.txt";
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
			script.value = result.text;
			filename = textFileName(file.name);
			saveScript(true);
			fileStatus("Script imported. Keep an exported copy as a backup.");
			script.focus();
		};
		if (script.value.trim() && script.value !== result.text)
			ask(
				"Replace script?",
				"This file contains different text. Replace your current script?",
				"Replace",
				apply,
			);
		else apply();
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
	byId<HTMLInputElement>("export-filename").value = filename;
	byId("script-link").hidden = true;
	byId("script-link-label").hidden = true;
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
byId("share-file").addEventListener("click", async () => {
	try {
		await navigator.share({ files: [exportFile()] });
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
		filename = file.name;
		byId<HTMLInputElement>("export-filename").value = filename;
		url = URL.createObjectURL(file);
		link.href = url;
		link.download = filename;
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
	try {
		await navigator.clipboard.writeText(result.url);
		writeText(
			byId("export-status"),
			"Script link copied. Open it in Moblin's private browser.",
		);
	} catch {
		field.focus();
		field.select();
		writeText(
			byId("export-status"),
			"Select the script link below and copy it.",
		);
	}
});
function loadScriptLink() {
	const incoming = readScriptLink(location.hash);
	if (!incoming) return;
	history.replaceState(null, "", location.pathname + location.search);
	invalidateImport();
	if (reader.opened) reader.pause();
	if (!incoming.ok) {
		const message = `${incoming.reason} Your script has not changed.`;
		fileStatus(message);
		if (reader.opened) writeText(byId("reader-notice"), message);
		return;
	}
	const token = importGeneration;
	const apply = () => {
		if (token !== importGeneration) return;
		if (reader.opened) reader.close();
		script.value = incoming.text;
		filename = "wolfcue-script.txt";
		saveScript(true);
		fileStatus(
			"Linked script loaded. Choose Start reading when you are ready.",
		);
	};
	if (script.value.trim() && script.value !== incoming.text)
		ask(
			"Load linked script?",
			"This link contains different text. Replace your current script?",
			"Load script",
			apply,
		);
	else apply();
}
window.addEventListener("hashchange", loadScriptLink);
loadScriptLink();
