import { chromium } from "playwright";
import { writeFileSync } from "fs";

void (async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  console.log("Loading login page...");
  await page.goto("https://bhulekh.ori.nic.in/Index.aspx", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });

  const [vs, ev, vsg, hfRandom] = await Promise.all([
    page.$eval("#__VIEWSTATE", (el) => el.value),
    page.$eval("#__EVENTVALIDATION", (el) => el.value),
    page.$eval("#__VIEWSTATEGENERATOR", (el) => el.value),
    page.$eval("#hfRandom", (el) => el.value),
  ]);
  console.log("ViewState:", vs.substring(0, 40) + "...");
  console.log("EventValidation:", ev.substring(0, 40) + "...");
  console.log("ViewStateGen:", vsg, "hfRandom:", hfRandom);

  // Get captcha image element
  const captchaImg = page.locator("img[src*='CaptchaImage']").first();
  let captchaText = "0000";
  if (await captchaImg.count() > 0) {
    const src = await captchaImg.getAttribute("src");
    console.log("Captcha src:", src);
    try {
      const imgDataUrl = await captchaImg.evaluate((el) => {
        const canvas = document.createElement("canvas");
        canvas.width = el.clientWidth || 150;
        canvas.height = el.clientHeight || 50;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(el, 0, 0);
        return canvas.toDataURL("image/png");
      });
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      const { data } = await worker.recognize(imgDataUrl);
      await worker.terminate();
      captchaText = data.text.replace(/[^A-Z0-9]/gi, "").substring(0, 4);
      console.log("OCR captcha:", captchaText);
    } catch (e) {
      console.log("OCR failed:", e);
    }
  }

  // Fill form with Playwright native methods (avoids multi-arg evaluate issue)
  console.log("\nSubmitting login...");
  await page.fill("#txtUserId", "testuser");
  await page.fill("#txtPassword", "testpass");
  await page.fill("#txtCaptcha", captchaText);
  await page.click("#btnLogin");
  await page.waitForTimeout;

  const urlAfterLogin = page.url();
  const bodyAfterLogin = await page.evaluate(() => document.body.innerText.substring(0, 800));
  const hasDistrictDropdown = (await page.$("#ddl_district")) !== null;

  console.log("URL after login:", urlAfterLogin);
  console.log("Has district dropdown:", hasDistrictDropdown);
  console.log("Body after login:\n", bodyAfterLogin.substring(0, 500));

  writeFileSync("/tmp/bhulekh-login-result.json", JSON.stringify({
    urlAfterLogin,
    bodySnippet: bodyAfterLogin,
    hasDistrictDropdown,
    captchaUsed: captchaText,
    viewState: vs.substring(0, 100),
    eventValidation: ev.substring(0, 100),
    viewStateGen: vsg,
    hfRandom,
  }, null, 2));
  console.log("Saved to /tmp/bhulekh-login-result.json");

  await browser.close();
  process.exit(0);
})();
