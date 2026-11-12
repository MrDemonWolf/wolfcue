export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
	const element = document.getElementById(id);
	if (!element) throw new Error(`Missing element: ${id}`);
	return element as T;
}
export function writeText(element: HTMLElement, value: string) {
	if (element.textContent !== value) element.textContent = value;
}
export function showView(element: HTMLElement, visible: boolean) {
	element.hidden = !visible;
	element.inert = !visible;
}
