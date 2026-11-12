import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { webkit } from "@playwright/test";

const output = resolve(import.meta.dirname, "../apps/web/public");
await mkdir(output, { recursive: true });
const logo = (await readFile(`${output}/mrdemonwolf-logo.svg`)).toString(
	"base64",
);
const font = (
	await readFile(
		resolve(
			import.meta.dirname,
			"../apps/web/node_modules/@fontsource-variable/montserrat/files/montserrat-latin-wght-normal.woff2",
		),
	)
).toString("base64");
const browser = await webkit.launch();
try {
	const page = await browser.newPage({
		viewport: { width: 1200, height: 630 },
		deviceScaleFactor: 1,
	});
	for (const card of [
		{
			file: "og-v2.png",
			title: "Your words.<br>At your pace.",
			description:
				"Read your script while Moblin records.<br>No account. No script uploads.",
			label: "Free browser teleprompter",
			preview:
				'<div class="reader-bar"><span class="pause">Pause</span><span>150 wpm</span></div><div class="script"><p>Take a breath.</p><p class="cue">Find your next line.</p><p>Keep your pace.</p></div>',
		},
		{
			file: "og-docs-v2.png",
			title: "Set up.<br>Start reading.",
			description:
				"Guides for Moblin, pacing, and scripts.<br>One step at a time.",
			label: "Docs and guides",
			preview:
				'<div class="guide-title">Start here</div><div class="guide"><span>01</span>Get started</div><div class="guide"><span>02</span>Read in Moblin</div><div class="guide"><span>03</span>Keep a script copy</div>',
		},
	]) {
		await page.setContent(`<!doctype html><html lang="en"><meta charset="utf-8"><style>
@font-face{font-family:Montserrat;src:url(data:font/woff2;base64,${font}) format("woff2");font-weight:100 900}
*{box-sizing:border-box}body{margin:0;background:#171717;color:#f5f5f5;font-family:system-ui,sans-serif}
.card{width:1200px;height:630px;padding:56px 64px;display:flex;flex-direction:column}
header{display:flex;align-items:center;gap:18px}.logo{width:64px;height:64px;padding:6px;border-radius:14px;background:#fff}
.brand{font:750 36px/1.1 Montserrat,sans-serif;letter-spacing:-1.6px}.label{color:#b8b8b8;font-size:18px;margin-top:7px}
.content{display:grid;grid-template-columns:1fr 316px;gap:38px;align-items:center;flex:1;margin:28px 0 24px}
h1{font:700 72px/1.08 Montserrat,sans-serif;letter-spacing:-3px;margin:0 0 22px}p{margin:0}main p{font-size:24px;line-height:1.5;color:#b8b8b8}
.preview{height:290px;border:1px solid #808080;background:#242424;border-radius:16px;padding:24px}
.reader-bar{display:flex;align-items:center;justify-content:space-between;color:#b8b8b8;font-size:16px}.pause{background:#00aced;color:#04121f;padding:9px 18px;border-radius:8px;font-size:18px;font-weight:650}
.script{margin-top:25px}.script p{font-size:22px;line-height:1.4;color:#b8b8b8}.script .cue{margin:13px 0;padding:10px 6px;background:#303030;border-left:4px solid #00aced;color:#f5f5f5;font-weight:600}
.guide-title{font:650 24px/1.2 Montserrat,sans-serif;margin:4px 0 20px}.guide{display:flex;align-items:center;gap:16px;min-height:56px;border-top:1px solid #3d3d3d;font-size:19px}.guide span{color:#7fd7ff;font-size:14px;font-variant-numeric:tabular-nums}
footer{display:flex;justify-content:space-between;align-items:center;border-top:1px solid #808080;padding-top:20px;font-size:18px;color:#b8b8b8}.domain{color:#7fd7ff;font-size:21px}
</style><div class="card"><header><img class="logo" alt="" src="data:image/svg+xml;base64,${logo}"><div><div class="brand">WolfCue</div><div class="label">${card.label}</div></div></header><div class="content"><main><h1>${card.title}</h1><p>${card.description}</p></main><aside class="preview">${card.preview}</aside></div><footer><span>WolfCue by MrDemonWolf, Inc.</span><span class="domain">wolfcue.mrdemonwolf.dev</span></footer></div></html>`);
		await page.evaluate(() => document.fonts.ready);
		assert.deepEqual(
			await page.evaluate(() =>
				Array.from(document.body.querySelectorAll("*"))
					.filter((element) => {
						const bounds = element.getBoundingClientRect();
						return (
							bounds.left < 0 ||
							bounds.top < 0 ||
							bounds.right > 1200 ||
							bounds.bottom > 630 ||
							(element.clientWidth > 0 &&
								element.scrollWidth > element.clientWidth)
						);
					})
					.map((element) => ({
						name: `${element.tagName}.${element.className}`,
						bounds: element.getBoundingClientRect().toJSON(),
					})),
			),
			[],
			`${card.file} must fit the card without clipped text`,
		);
		await page.screenshot({ path: `${output}/${card.file}`, scale: "css" });
	}
	const svg = await readFile(`${output}/favicon.svg`, "utf8");
	await page.setViewportSize({ width: 180, height: 180 });
	await page.setContent(
		`<style>html,body{margin:0;width:180px;height:180px}svg{display:block;width:180px;height:180px}</style>${svg}`,
	);
	await page.screenshot({
		path: `${output}/apple-touch-icon.png`,
		scale: "css",
		omitBackground: true,
	});
	await page.setViewportSize({ width: 32, height: 32 });
	await page.setContent(
		`<style>html,body{margin:0;width:32px;height:32px}svg{display:block;width:32px;height:32px}</style>${svg}`,
	);
	const png = await page.screenshot({ scale: "css", omitBackground: true });
	const header = Buffer.alloc(22);
	header.writeUInt16LE(1, 2);
	header.writeUInt16LE(1, 4);
	header[6] = 32;
	header[7] = 32;
	header.writeUInt16LE(1, 10);
	header.writeUInt16LE(32, 12);
	header.writeUInt32LE(png.length, 14);
	header.writeUInt32LE(22, 18);
	await writeFile(`${output}/favicon.ico`, Buffer.concat([header, png]));
	console.log(
		"Generated two 1200x630 OG cards, 180x180 touch icon and 32x32 ICO.",
	);
} finally {
	await browser.close();
}
