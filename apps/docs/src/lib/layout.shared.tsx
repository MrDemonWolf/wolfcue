import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import Image from "next/image";

import { DOCS_PATH, SITE_BASE } from "./site";

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
		links: [
			{
				type: "custom",
				children: <a href={`${SITE_BASE}/`}>Open teleprompter</a>,
			},
			{
				type: "custom",
				children: <a href="https://github.com/MrDemonWolf/wolfcue">GitHub</a>,
			},
		],
		themeSwitch: { enabled: true, mode: "light-dark-system" },
	};
}
