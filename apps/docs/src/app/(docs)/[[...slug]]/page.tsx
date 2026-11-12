import {
	DocsBody,
	DocsDescription,
	DocsPage,
	DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMDXComponents } from "@/components/mdx";
import { DOCS_OG_IMAGE, DOCS_PATH, SITE_BASE, SITE_ORIGIN } from "@/lib/site";
import { source } from "@/lib/source";

export default async function Page(props: PageProps<"/[[...slug]]">) {
	const { slug } = await props.params;
	const page = source.getPage(slug);
	if (!page) notFound();
	const MDX = page.data.body;
	const commit = process.env.COMMIT_SHA ?? "dev";
	return (
		<DocsPage toc={page.data.toc}>
			<DocsTitle>{page.data.title}</DocsTitle>
			<DocsDescription>{page.data.description}</DocsDescription>
			<DocsBody>
				<MDX components={getMDXComponents()} />
			</DocsBody>
			<footer className="docs-footer">
				<p className="affiliation">
					WolfCue is an independent, open-source tool. Not affiliated with,
					endorsed by, or sponsored by Moblin.
				</p>
				<div className="footer-bottom">
					<div className="footer-credit">
						<p>
							© {new Date().getFullYear()} WolfCue by{" "}
							<a href="https://www.mrdemonwolf.com">MrDemonWolf, Inc.</a>
						</p>
						<span className="footer-build">
							Build{" "}
							{commit === "dev" ? (
								"dev"
							) : (
								<a
									aria-label={`View build commit ${commit.slice(0, 7)}`}
									href={`https://github.com/MrDemonWolf/wolfcue/commit/${commit}`}
								>
									{commit.slice(0, 7)}
								</a>
							)}
						</span>
					</div>
					<nav aria-label="Project links">
						<a href={`${SITE_BASE}/`}>App</a>
						<a href="https://github.com/MrDemonWolf/wolfcue">GitHub</a>
						<a href="https://mrdwolf.net/discord">Discord</a>
						<a href={`${SITE_BASE}/third-party-notices.txt`}>
							Third-party notices
						</a>
					</nav>
				</div>
			</footer>
		</DocsPage>
	);
}
export function generateStaticParams() {
	return source.generateParams();
}
export async function generateMetadata(
	props: PageProps<"/[[...slug]]">,
): Promise<Metadata> {
	const { slug } = await props.params;
	const page = source.getPage(slug);
	if (!page) notFound();
	const path = `${DOCS_PATH}${page.url === "/" ? "/" : `${page.url.replace(/\/$/, "")}/`}`;
	const canonical = new URL(path, SITE_ORIGIN).toString();
	return {
		title: page.data.title,
		description: page.data.description,
		alternates: { canonical },
		openGraph: {
			type: page.url === "/" ? "website" : "article",
			locale: "en_US",
			siteName: "WolfCue",
			title: page.data.title,
			description: page.data.description,
			url: canonical,
			images: [DOCS_OG_IMAGE],
		},
		twitter: {
			card: "summary_large_image",
			title: page.data.title,
			description: page.data.description,
			images: [DOCS_OG_IMAGE],
		},
	};
}
