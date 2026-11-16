import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import Image from "next/image";

import { DOCS_PATH, SITE_BASE } from "./site";

const iconProps = {
	width: 18,
	height: 18,
	viewBox: "0 0 24 24",
} as const;

function TeleprompterIcon() {
	return (
		<svg
			aria-hidden="true"
			{...iconProps}
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<rect x="3" y="4" width="18" height="16" rx="2" />
			<path d="M7 9h10M7 13h10M7 17h6" />
		</svg>
	);
}
function GitHubIcon() {
	return (
		<svg aria-hidden="true" {...iconProps} fill="currentColor">
			<path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.6 18.3 5 18.3 5c.7 1.6.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3" />
		</svg>
	);
}
function GlobeIcon() {
	return (
		<svg
			aria-hidden="true"
			{...iconProps}
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<circle cx="12" cy="12" r="10" />
			<path d="M2 12h20" />
			<path d="M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20Z" />
		</svg>
	);
}

export function baseOptions(): BaseLayoutProps {
	return {
		nav: {
			title: (
				<span className="inline-flex items-center gap-2">
					<Image
						src={`${DOCS_PATH}/mrdemonwolf-logo.svg`}
						className="rounded-md bg-white p-0.5"
						alt=""
						width={32}
						height={32}
					/>
					<span>WolfCue</span>
				</span>
			),
			url: "/",
		},
		// Same-tab links: Moblin's browser ignores links that open new tabs.
		links: [
			{
				type: "custom",
				children: (
					<a
						href={`${SITE_BASE}/`}
						className="text-fd-muted-foreground hover:bg-fd-accent/50 hover:text-fd-accent-foreground/80 relative flex flex-row items-center gap-2 rounded-lg p-2 text-start transition-colors [&_svg]:size-4 [&_svg]:shrink-0"
					>
						<TeleprompterIcon />
						Open teleprompter
					</a>
				),
			},
			{
				type: "icon",
				label: "WolfCue on GitHub",
				text: "GitHub",
				url: "https://github.com/MrDemonWolf/wolfcue",
				external: false,
				icon: <GitHubIcon />,
			},
			{
				type: "icon",
				label: "MrDemonWolf website",
				text: "MrDemonWolf website",
				url: "https://www.mrdemonwolf.com",
				external: false,
				icon: <GlobeIcon />,
			},
		],
		themeSwitch: { enabled: true, mode: "light-dark-system" },
	};
}
