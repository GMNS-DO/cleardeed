import { chromium } from "playwright";

async function probeBhulekh() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout;

  const result: {
    pageLoaded: boolean;
    loginPageUrl: string;
    formFields: Array<{ name: string; id: string; type: string; value: string; visible: boolean }>;
    viewState: string;
    eventValidation: string;
    viewStateGenerator: string;
    captchaImageUrl: string;
    captchaSessionGuid: string;
    loginErrorBlank: string;
    loginErrorDummy: string;
    loginErrorCaptchaOnly: string;
    screenshotPath: string;
    anyOtherObservations: string;
  } = {
    pageLoaded: false,
    loginPageUrl: "",
    formFields: [],
    viewState: "",
    eventValidation: "",
    viewStateGenerator: "",
    captchaImageUrl: "",
    captchaSessionGuid: "",
    loginErrorBlank: "",
    loginErrorDummy: "",
    loginErrorCaptchaOnly: "",
    screenshotPath: "/tmp/bhulekh-login.png",
    anyOtherObservations: "",
  };

  try {
    // --- Navigate to Index.aspx (the login page) ---
    console.error("Navigating to bhulekh.ori.nic.in/Index.aspx...");
    const response = await page.goto("https://bhulekh.ori.nic.in/Index.aspx", {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    console.error(`Response status: ${response?.status()}`);
    result.pageLoaded = true;
    result.loginPageUrl = page.url();

    // Screenshot
    await page.screenshot({ path: result.screenshotPath, fullPage: true });
    console.error("Screenshot saved to", result.screenshotPath);

    // --- Extract ALL form fields ---
    const inputCount = await page.locator("input").count();
    const fields: Array<{ name: string; id: string; type: string; value: string; visible: boolean }> = [];
    for (let i = 0; i < inputCount; i++) {
      const el = page.locator("input").nth(i);
      fields.push({
        name: (await el.getAttribute("name")) || "",
        id: (await el.getAttribute("id")) || "",
        type: (await el.getAttribute("type")) || "text",
        value: ((await el.inputValue().catch(() => "N/A")) || "").substring(0, 200),
        visible: await el.isVisible().catch(() => false),
      });
    }
    result.formFields = fields;
    console.error(`Found ${fields.length} input fields.`);

    // --- Extract __VIEWSTATE values ---
    const vsLocator = page.locator("[name='__VIEWSTATE']").first();
    const evLocator = page.locator("[name='__EVENTVALIDATION']").first();
    const vsgLocator = page.locator("[name='__VIEWSTATEGENERATOR']").first();
    if (await vsLocator.count() > 0) result.viewState = (await vsLocator.inputValue()).substring(0, 100);
    if (await evLocator.count() > 0) result.eventValidation = (await evLocator.inputValue()).substring(0, 100);
    if (await vsgLocator.count() > 0) result.viewStateGenerator = (await vsgLocator.inputValue()).substring(0, 100);

    // --- Extract captcha image URL ---
    const captchaImg = page.locator("img[alt='Captcha']").first();
    if (await captchaImg.count() > 0) {
      result.captchaImageUrl = (await captchaImg.getAttribute("src")) || "";
      // Extract the guid from the URL
      const guidMatch = result.captchaImageUrl.match(/guid=([a-f0-9-]+)/i);
      if (guidMatch) result.captchaSessionGuid = guidMatch[1];
    }

    // Helper to get body text
    const getBodyText = async () => (await page.locator("body").innerText()).replace(/\s+/g, " ").trim();

    // Helper to get error/validation messages from page
    const getLoginError = async (label: string): Promise<string> => {
      const bodyText = await getBodyText();
      const url = page.url();
      return JSON.stringify({ label, url, bodySnippet: bodyText.substring(0, 500) });
    };

    // --- TEST 1: Blank submit (all fields empty) ---
    console.error("TEST 1: Submitting with all fields blank...");
    await page.locator("[name='txtUserId']").fill("");
    await page.locator("[name='txtPassword']").fill("");
    await page.locator("[name='txtCaptcha']").fill("");
    await page.locator("[name='btnLogin']").click();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout;
    result.loginErrorBlank = await getLoginError("blank_submit");
    console.error("TEST 1 result:", (JSON.parse(result.loginErrorBlank)).bodySnippet.substring(0, 200));

    // --- TEST 2: Dummy credentials (no captcha) ---
    console.error("TEST 2: Submitting with dummy credentials, no captcha...");
    await page.goto("https://bhulekh.ori.nic.in/Index.aspx", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForLoadState("domcontentloaded");
    await page.locator("[name='txtUserId']").fill("test");
    await page.locator("[name='txtPassword']").fill("test");
    await page.locator("[name='txtCaptcha']").fill("");
    await page.locator("[name='btnLogin']").click();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout;
    result.loginErrorDummy = await getLoginError("dummy_no_captcha");
    console.error("TEST 2 result:", (JSON.parse(result.loginErrorDummy)).bodySnippet.substring(0, 200));

    // --- TEST 3: Dummy credentials with wrong captcha ---
    console.error("TEST 3: Submitting with dummy credentials and wrong captcha...");
    await page.goto("https://bhulekh.ori.nic.in/Index.aspx", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForLoadState("domcontentloaded");
    await page.locator("[name='txtUserId']").fill("test");
    await page.locator("[name='txtPassword']").fill("test");
    await page.locator("[name='txtCaptcha']").fill("WRONGCAPTCHA");
    await page.locator("[name='btnLogin']").click();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout;
    result.loginErrorCaptchaOnly = await getLoginError("dummy_wrong_captcha");
    console.error("TEST 3 result:", (JSON.parse(result.loginErrorCaptchaOnly)).bodySnippet.substring(0, 200));

    // --- Check accessible pages without login ---
    console.error("Checking accessible pages...");
    const accessible: string[] = [];
    const linksToTry = [
      "https://bhulekh.ori.nic.in/Home.aspx",
      "https://bhulekh.ori.nic.in/SearchRecord.aspx",
      "https://bhulekh.ori.nic.in/lander.aspx",
      "https://bhulekh.ori.nic.in/Default.aspx",
      "https://bhulekh.ori.nic.in/Index.aspx?IsAjax=true",
    ];
    for (const url of linksToTry) {
      try {
        const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 10000 });
        const body = (await page.locator("body").innerText().catch(() => "")).substring(0, 100);
        accessible.push(`${url} -> HTTP ${resp?.status()} | ${body.replace(/\n/g, " ").trim().substring(0, 80)}`);
      } catch (e: unknown) {
        accessible.push(`${url} -> ERROR: ${e instanceof Error ? e.message.slice(0, 80) : ""}`);
      }
    }
    result.anyOtherObservations = "Accessible pages (no auth):\n" + accessible.join("\n");

    // Also check main landing page
    try {
      await page.goto("https://bhulekh.ori.nic.in/", { waitUntil: "networkidle", timeout: 15000 });
      const mainPageText = (await page.locator("body").innerText()).substring(0, 300);
      result.anyOtherObservations += "\n\nMain landing page (root): " + mainPageText.replace(/\s+/g, " ").trim().substring(0, 200);
    } catch (e: unknown) {
      result.anyOtherObservations += "\n\nMain landing page error: " + (e instanceof Error ? e.message : "");
    }

  } catch (err: unknown) {
    result.anyOtherObservations += `\nERROR: ${err instanceof Error ? err.message : String(err)}`;
    console.error("Error during probe:", err);
  } finally {
    await browser.close();
  }

  // Output JSON to stdout
  console.log(JSON.stringify(result, null, 2));
}

probeBhulekh().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
