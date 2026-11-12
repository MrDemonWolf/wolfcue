import { llms, loader } from "fumadocs-core/source";
import { metaSchema, pageSchema } from "fumadocs-core/source/schema";
import { defineDocs } from "fumadocs-mdx/macro";

import { DOCS_PATH } from "./site";

const docs = defineDocs({
	dir: "content/docs",
	docs: {
		schema: pageSchema,
		postprocess: { includeProcessedMarkdown: true },
	},
	meta: { schema: metaSchema },
});

export const source = loader({ baseUrl: "/", source: docs.toFumadocsSource() });

export const docsLlms = llms(source, {
	renderPage: async (page) =>
		`# ${page.data.title} (${DOCS_PATH}${page.url})\n\n${await page.data.getText("processed")}`,
});
