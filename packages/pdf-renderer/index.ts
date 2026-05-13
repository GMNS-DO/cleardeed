import serverlessChromium from "@sparticuz/chromium";
import { chromium, type Browser, type LaunchOptions } from "playwright-core";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

let browser: Browser | null = null;

const DEFAULT_CHROMIUM_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
];
const SERVERLESS_CHROMIUM_PNPM_PACKAGE = "@sparticuz+chromium@138.0.2";

function isServerlessBrowserRuntime(): boolean {
  return Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NETLIFY ||
    process.env.CLEARED_USE_SERVERLESS_CHROMIUM === "1"
  );
}

async function buildChromiumLaunchOptions(): Promise<LaunchOptions> {
  const executablePath =
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    process.env.CHROMIUM_EXECUTABLE_PATH;

  if (executablePath) {
    return {
      headless: true,
      executablePath,
      args: DEFAULT_CHROMIUM_ARGS,
    };
  }

  if (isServerlessBrowserRuntime()) {
    const binDir = findServerlessChromiumBinDir();
    return {
      headless: true,
      executablePath: await serverlessChromium.executablePath(binDir),
      args: [...serverlessChromium.args, "--disable-dev-shm-usage"],
    };
  }

  return {
    headless: true,
    args: DEFAULT_CHROMIUM_ARGS,
  };
}

function findServerlessChromiumBinDir(): string | undefined {
  const directCandidates = [
    process.env.SPARTICUZ_CHROMIUM_BIN_DIR,
    join(process.cwd(), "node_modules", "@sparticuz", "chromium", "bin"),
    join(process.cwd(), "node_modules", ".pnpm", SERVERLESS_CHROMIUM_PNPM_PACKAGE, "node_modules", "@sparticuz", "chromium", "bin"),
    join(process.cwd(), "..", "..", "node_modules", ".pnpm", SERVERLESS_CHROMIUM_PNPM_PACKAGE, "node_modules", "@sparticuz", "chromium", "bin"),
    join("/var/task", "node_modules", "@sparticuz", "chromium", "bin"),
    join("/var/task", "node_modules", ".pnpm", SERVERLESS_CHROMIUM_PNPM_PACKAGE, "node_modules", "@sparticuz", "chromium", "bin"),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of directCandidates) {
    if (existsSync(join(candidate, "chromium.br"))) return candidate;
  }

  for (const base of [
    join(process.cwd(), "node_modules", ".pnpm"),
    join(process.cwd(), "..", "..", "node_modules", ".pnpm"),
    join("/var/task", "node_modules", ".pnpm"),
  ]) {
    const discovered = findPnpmChromiumBinDir(base);
    if (discovered) return discovered;
  }

  return undefined;
}

function findPnpmChromiumBinDir(base: string): string | undefined {
  if (!existsSync(base)) return undefined;
  for (const entry of readdirSync(base).filter((name) => name.startsWith("@sparticuz+chromium@")).sort()) {
    const candidate = join(base, entry, "node_modules", "@sparticuz", "chromium", "bin");
    if (existsSync(join(candidate, "chromium.br"))) return candidate;
  }
  return undefined;
}

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch(await buildChromiumLaunchOptions());
  }
  return browser;
}

export interface RenderPdfOptions {
  /** HTML content to render */
  html: string;
}

/**
 * Renders an HTML string to a PDF buffer using Playwright.
 */
export async function renderPdf(options: RenderPdfOptions): Promise<Buffer> {
  const bro = await getBrowser();
  const page = await bro.newPage();
  try {
    await page.setContent(options.html, { waitUntil: "networkidle" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "18mm",
        right: "15mm",
        bottom: "18mm",
        left: "15mm",
      },
    });
    return pdfBuffer;
  } finally {
    await page.close();
  }
}

export async function cleanup(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}
