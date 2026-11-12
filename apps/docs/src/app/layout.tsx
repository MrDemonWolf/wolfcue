import type { Metadata } from "next";
import { Provider } from "@/components/provider";
import { DOCS_OG_IMAGE, DOCS_PATH, SITE_URL } from "@/lib/site";
import "@fontsource-variable/inter";
import "@fontsource-variable/montserrat";
import "./global.css";

const description =
	"Read and manage scripts in WolfCue, a local-first browser teleprompter for Moblin's private browser.";
export const metadata: Metadata = {
	metadataBase: new URL(SITE_URL),
	title: { default: "WolfCue Docs", template: "%s | WolfCue" },
	description,
	applicationName: "WolfCue",
	authors: [{ name: "MrDemonWolf, Inc." }],
	icons: { icon: `${DOCS_PATH}/favicon.svg` },
	openGraph: {
		type: "website",
		locale: "en_US",
		siteName: "WolfCue",
		title: "WolfCue Docs",
		description,
		images: [DOCS_OG_IMAGE],
	},
	twitter: {
		card: "summary_large_image",
		title: "WolfCue Docs",
		description,
		images: [DOCS_OG_IMAGE],
	},
};

export default function Layout({ children }: LayoutProps<"/">) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<meta
					httpEquiv="Content-Security-Policy"
					content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'"
				/>
			</head>
			<body>
				<Provider>{children}</Provider>
			</body>
		</html>
	);
}
