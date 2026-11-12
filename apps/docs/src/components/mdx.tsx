import { Callout } from "fumadocs-ui/components/callout";
import { Card, type CardProps, Cards } from "fumadocs-ui/components/card";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import type { AnchorHTMLAttributes } from "react";
import { SITE_BASE } from "@/lib/site";

function MdxLink({
	href = "",
	...props
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
	if (href === "/docs" || href.startsWith("/docs/"))
		return <Link href={href.slice(5) || "/"} {...props} />;
	if (href.startsWith("/") && !href.startsWith("//"))
		return <a href={`${SITE_BASE}${href}`} {...props} />;
	return <a href={href} {...props} />;
}
function DocCard({ href, ...props }: CardProps) {
	return (
		<Card href={href?.startsWith("/docs/") ? href.slice(5) : href} {...props} />
	);
}
export function getMDXComponents(components?: MDXComponents) {
	return {
		...defaultMdxComponents,
		a: MdxLink,
		Card: DocCard,
		Cards,
		Callout,
		...components,
	} satisfies MDXComponents;
}
export const useMDXComponents = getMDXComponents;
declare global {
	type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
