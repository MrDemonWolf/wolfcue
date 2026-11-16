import type { Settings } from "./settings";
export type Theme = Settings["theme"];
export function resolveTheme(
	theme: Theme,
	systemDark: boolean,
): "light" | "dark" {
	return theme === "system" ? (systemDark ? "dark" : "light") : theme;
}
