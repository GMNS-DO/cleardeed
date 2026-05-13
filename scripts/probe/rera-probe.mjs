import { chromium } from "playwright";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  console.log("Navigating to https://odisha.verasai.in ...");
  try {
    const response = await page.goto("https://odisha.verasai.in", { waitUntil: "domcontentloaded", timeout: 15000 });
    console.log("Status:", response?.status());
    const title = await page.title();
    console.log("Title:", title);
    
    // Find search links
    const searchLinks = await page.locator("a", { hasText: /search/i }).allTextContents();
    console.log("Search Links found:", searchLinks.length > 0 ? searchLinks : "None");
    
    // Look for project search
    const projectLinks = await page.locator("a", { hasText: /project/i }).allTextContents();
    console.log("Project Links found:", projectLinks.length > 0 ? projectLinks : "None");

  } catch (error) {
    console.error("Navigation failed:", error);
  } finally {
    await browser.close();
  }
}

run();