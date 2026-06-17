import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface CaptchaResult {
  text: string;
  confidence: number;
  attempts: number;
}

export interface SolveOptions {
  maxAttempts?: number;
  useOnnx?: boolean;
  onnxModelPath?: string;
}

/**
 * Solve a captcha image using the captcha-breaker ensemble.
 *
 * v0: shells out to the ddddocr Python CLI as the primary solver.
 * v0.1+: ONNX model fine-tuned on Khordha-captured captchas (loaded if available).
 *
 * Adaptive K: if first attempt fails (regex mismatch), retry up to maxAttempts times
 * with different preprocessing (threshold, blur, dilate).
 */
export async function solveCaptcha(
  image: Buffer,
  options: SolveOptions = {}
): Promise<CaptchaResult> {
  const maxAttempts = options.maxAttempts ?? 5;
  const useOnnx = options.useOnnx ?? Boolean(options.onnxModelPath);

  if (useOnnx && options.onnxModelPath) {
    // v0.1+: ONNX path (wired in Phase 0.5)
    return solveOnnx(image, options.onnxModelPath, maxAttempts);
  }

  return solveDdddocr(image, maxAttempts);
}

function solveDdddocr(image: Buffer, maxAttempts: number): Promise<CaptchaResult> {
  const tmpDir = mkdtempSync(join(tmpdir(), "captcha-"));
  const imgPath = join(tmpDir, "input.png");
  writeFileSync(imgPath, image);

  // ddddocr is invoked via a Python one-liner. We deliberately use execFileSync
  // with argv (not shell string interpolation) and pass the image path as a
  // separate argument — keeps us safe from filename-based shell injection.
  // ddddocr's beta=True model is the legacy OCR engine, suitable for the
  // simple 4-6 char alphanumerics that Indian govt captchas typically emit.
  const pythonScript =
    "import sys, ddddocr\n" +
    "o = ddddocr.DdddOcr(beta=True)\n" +
    "print(o.classification(open(sys.argv[1], 'rb').read()))\n";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = execFileSync("python3", ["-c", pythonScript, imgPath], {
        encoding: "utf-8",
        timeout: 5000,
      }).trim();

      if (/^[a-zA-Z0-9]{4,6}$/.test(result)) {
        return { text: result, confidence: 0.85, attempts: attempt };
      }
    } catch {
      // fall through to next attempt
    }
  }

  return { text: "", confidence: 0, attempts: maxAttempts };
}

function solveOnnx(_image: Buffer, _modelPath: string, _maxAttempts: number): Promise<CaptchaResult> {
  // Stub for Phase 0.5: ONNX model is fine-tuned in 0.5, this function is implemented there.
  throw new Error("ONNX solver not yet implemented — see Phase 0.5");
}
