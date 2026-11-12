import { defineConfig, devices } from "@playwright/test";
import { siteConfig } from "./scripts/site-config";

const { basePath } = siteConfig();
const baseURL = process.env.TEST_BASE_URL ?? `http://127.0.0.1:4173${basePath}`;
export default defineConfig({
	testDir: "./apps/web/e2e",
	testMatch: "**/*.e2e.ts",
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: 0,
	workers: process.env.CI ? 1 : 3,
	reporter: "list",
	outputDir: "node_modules/.cache/playwright-results",
	use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure" },
	projects: [
		{
			name: "moblin-250",
			use: { ...devices["iPhone 15"], viewport: { width: 250, height: 250 } },
		},
		{
			name: "iphone-portrait",
			use: { ...devices["iPhone 15"], viewport: { width: 390, height: 844 } },
		},
		{
			name: "iphone-landscape",
			use: { ...devices["iPhone 15"], viewport: { width: 844, height: 390 } },
		},
	],
	webServer: process.env.TEST_BASE_URL
		? undefined
		: {
				command: "bun scripts/serve-site.ts",
				url: baseURL,
				reuseExistingServer: false,
				timeout: 30000,
			},
});
