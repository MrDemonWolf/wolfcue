try {
	const wolfcueTheme = localStorage.getItem("wolfcue:theme");
	if (wolfcueTheme === "light" || wolfcueTheme === "dark") {
		document.documentElement.dataset.theme = wolfcueTheme;
	}
} catch {}
