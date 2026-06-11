#!/usr/bin/env node

import { access, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { basename, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";

const execFileAsync = promisify(execFile);

const DEFAULT_RUN = "2026-05-26-orera-50";
const DEFAULT_ORERA_ROOT = "pid/data/raw/orera";
const DEFAULT_CANDIDATES = "pid/research/generated/orera_50_pattern_candidates.json";
const DEFAULT_OUT_DIR = "pid/research/generated/pdf_text_poc";

function parseArgs(argv) {
  const options = {
    run: DEFAULT_RUN,
    oreraRoot: DEFAULT_ORERA_ROOT,
    candidates: DEFAULT_CANDIDATES,
    outDir: DEFAULT_OUT_DIR,
    limit: 12,
    ocrLimit: 3,
    keepImages: false,
    field: null,
    pageLimit: 2,
    rotations: [0],
    lang: "eng",
  };

  for (const arg of argv) {
    if (arg.startsWith("--run=")) options.run = arg.slice("--run=".length);
    else if (arg.startsWith("--orera-root=")) options.oreraRoot = arg.slice("--orera-root=".length);
    else if (arg.startsWith("--candidates=")) options.candidates = arg.slice("--candidates=".length);
    else if (arg.startsWith("--out-dir=")) options.outDir = arg.slice("--out-dir=".length);
    else if (arg.startsWith("--limit=")) options.limit = Number(arg.slice("--limit=".length));
    else if (arg.startsWith("--ocr-limit=")) options.ocrLimit = Number(arg.slice("--ocr-limit=".length));
    else if (arg.startsWith("--field=")) options.field = arg.slice("--field=".length).split(",").map((field) => field.trim().toLowerCase()).filter(Boolean);
    else if (arg.startsWith("--page-limit=")) options.pageLimit = Number(arg.slice("--page-limit=".length));
    else if (arg.startsWith("--rotations=")) options.rotations = arg.slice("--rotations=".length).split(",").map((value) => Number(value.trim())).filter((value) => Number.isFinite(value));
    else if (arg.startsWith("--lang=")) options.lang = arg.slice("--lang=".length);
    else if (arg === "--keep-images") options.keepImages = true;
    else if (arg === "--no-ocr") options.ocrLimit = 0;
  }

  return options;
}

async function pathExists(path) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function commandPath(name) {
  try {
    const { stdout } = await execFileAsync("bash", ["-lc", `command -v ${name} || true`], { encoding: "utf8" });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function compactWhitespace(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

function textQuality(text) {
  const value = String(text ?? "");
  if (!value.length) return { chars: 0, printable_ratio: 0, alpha_ratio: 0, word_count: 0 };
  const printable = [...value].filter((char) => /[\n\r\t\x20-\x7E]/.test(char)).length;
  const alpha = [...value].filter((char) => /[A-Za-z]/.test(char)).length;
  const words = value.match(/[A-Za-z]{3,}/g) ?? [];
  return {
    chars: value.length,
    printable_ratio: Number((printable / value.length).toFixed(3)),
    alpha_ratio: Number((alpha / value.length).toFixed(3)),
    word_count: words.length,
  };
}

function isUsableText(text) {
  const quality = textQuality(text);
  return quality.chars >= 500 && quality.printable_ratio >= 0.85 && quality.alpha_ratio >= 0.35 && quality.word_count >= 60;
}

function qualityScore(text, confidence = 0) {
  const quality = textQuality(text);
  return (quality.word_count * 4) + (quality.alpha_ratio * 100) + (quality.printable_ratio * 25) + Number(confidence ?? 0);
}

function crudePdfLiteralText(buffer) {
  const raw = buffer.toString("latin1");
  const chunks = [];
  const literalPattern = /\(([^()]{8,})\)/g;
  let match;
  while ((match = literalPattern.exec(raw)) !== null && chunks.join(" ").length < 12000) {
    const text = match[1]
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\\(/g, "(")
      .replace(/\\\)/g, ")");
    if (isUsableText(text) || (/[A-Za-z]{3,}/.test(text) && textQuality(text).printable_ratio >= 0.9)) {
      chunks.push(text);
    }
  }
  return compactWhitespace(chunks.join(" "));
}

function countNeedles(buffer, needle) {
  const text = buffer.toString("latin1");
  let count = 0;
  let index = 0;
  while ((index = text.indexOf(needle, index)) !== -1) {
    count += 1;
    index += needle.length;
  }
  return count;
}

function extractDctImages(buffer, limit = 1) {
  const text = buffer.toString("latin1");
  const images = [];
  let searchFrom = 0;

  while (images.length < limit) {
    const marker = text.indexOf("/DCTDecode", searchFrom);
    if (marker === -1) break;
    const stream = text.indexOf("stream", marker);
    if (stream === -1) break;

    let start = stream + "stream".length;
    if (buffer[start] === 13 && buffer[start + 1] === 10) start += 2;
    else if (buffer[start] === 10) start += 1;

    const end = text.indexOf("endstream", start);
    if (end === -1) break;

    let image = buffer.subarray(start, end);
    while (image.length && (image[image.length - 1] === 10 || image[image.length - 1] === 13)) {
      image = image.subarray(0, image.length - 1);
    }
    images.push(image);
    searchFrom = end + "endstream".length;
  }

  return images;
}

async function prepareOcrImageVariants({ dctImages, imageDir, fileBaseName, pageLimit, rotations }) {
  const pageCandidates = [];

  for (let index = 0; index < dctImages.length; index += 1) {
    try {
      const metadata = await sharp(dctImages[index]).metadata();
      const width = metadata.width ?? 0;
      const height = metadata.height ?? 0;
      if (width < 400 || height < 400) continue;
      pageCandidates.push({ index, image: dctImages[index], width, height, area: width * height });
    } catch {
      // Ignore malformed or unsupported image streams.
    }
  }

  const selectedPages = pageCandidates
    .sort((a, b) => b.area - a.area)
    .slice(0, pageLimit);

  const variants = [];
  for (const page of selectedPages) {
    for (const rotation of rotations) {
      const imagePath = join(imageDir, `${fileBaseName}-img${page.index + 1}-rot${rotation}.jpg`);
      let pipeline = sharp(page.image).rotate(rotation).grayscale().normalize();
      const metadata = await sharp(page.image).rotate(rotation).metadata();
      const maxWidth = 2200;
      if ((metadata.width ?? 0) > maxWidth) {
        pipeline = pipeline.resize({ width: maxWidth, withoutEnlargement: true });
      }
      await pipeline.jpeg({ quality: 92 }).toFile(imagePath);
      variants.push({
        image_path: imagePath,
        source_image_index: page.index,
        source_width: page.width,
        source_height: page.height,
        rotation,
      });
    }
  }

  return variants;
}

async function ocrImage(worker, imagePath) {
  const result = await worker.recognize(imagePath);
  return {
    ok: true,
    text: compactWhitespace(result.data.text).slice(0, 8000),
    confidence: result.data.confidence ?? null,
  };
}

async function ocrBestVariant({ worker, variants, keepImages }) {
  const attempts = [];
  for (const variant of variants) {
    let attempt;
    try {
      const ocr = await ocrImage(worker, variant.image_path);
      attempt = {
        ok: true,
        ...variant,
        text: ocr.text,
        confidence: ocr.confidence,
        quality: textQuality(ocr.text),
        score: qualityScore(ocr.text, ocr.confidence),
      };
    } catch (error) {
      attempt = { ok: false, ...variant, error: error.message, score: 0 };
    }
    attempts.push(attempt);
    if (!keepImages) await rm(variant.image_path, { force: true });
  }

  const best = attempts.toSorted((a, b) => b.score - a.score)[0] ?? null;
  return best ? {
    ok: best.ok,
    language: null,
    text: best.text ?? "",
    confidence: best.confidence ?? null,
    quality: best.quality ?? null,
    score: best.score ?? 0,
    best_variant: {
      source_image_index: best.source_image_index,
      source_width: best.source_width,
      source_height: best.source_height,
      rotation: best.rotation,
    },
    attempts: attempts.map((attempt) => ({
      ok: attempt.ok,
      source_image_index: attempt.source_image_index,
      source_width: attempt.source_width,
      source_height: attempt.source_height,
      rotation: attempt.rotation,
      confidence: attempt.confidence ?? null,
      quality: attempt.quality ?? null,
      score: attempt.score ?? 0,
      error: attempt.error,
    })),
  } : null;
}

function candidatesToPdfRefs(candidates, run) {
  const refs = new Map();

  for (const card of candidates.candidate_cards ?? []) {
    for (const signal of card.candidate_signals ?? []) {
      for (const ref of signal.evidence_refs ?? []) {
        if (!ref || typeof ref !== "object" || !ref.file_path?.endsWith(".pdf")) continue;
        if (!refs.has(ref.file_path)) {
          refs.set(ref.file_path, {
            file_path: ref.file_path,
            file_name: basename(ref.file_path),
            file_id: ref.file_id ?? null,
            field: ref.field ?? null,
            run,
            linked_cards: [],
          });
        }
        refs.get(ref.file_path).linked_cards.push({
          project_id: card.identifiers?.project_id ?? null,
          project_name: card.identifiers?.project_name ?? null,
          promoter_name: card.identifiers?.promoter_name ?? null,
          mouza: card.identifiers?.mouza ?? null,
          khata_no: card.identifiers?.khata_no ?? null,
          plot_no: card.identifiers?.plot_no ?? null,
          signal_id: signal.signal_id,
        });
      }
    }
  }

  return [...refs.values()];
}

async function fallbackPdfRefs(options) {
  const artifactsDir = join(options.oreraRoot, options.run, "artifacts");
  const names = await readdir(artifactsDir);
  return names
    .filter((name) => name.endsWith(".pdf"))
    .sort()
    .map((name) => {
      const match = name.match(/^project-(\d+)-doc-(\d+)-(.+)\.pdf$/);
      return {
        file_path: join(artifactsDir, name),
        file_name: name,
        file_id: match?.[2] ?? null,
        field: match?.[3] ?? null,
        run: options.run,
        linked_cards: [],
      };
    });
}

function triageStatus({ crudeText, imageCount, ocr }) {
  if (isUsableText(crudeText)) return "text_layer_found";
  if (ocr?.ok && isUsableText(ocr.text)) return "ocr_text_found";
  if (imageCount > 0 && ocr?.ok) return "image_pdf_ocr_weak";
  if (imageCount > 0) return "image_pdf_ocr_pending";
  return "no_text_or_dct_image_found";
}

function firstMatch(text, pattern) {
  const match = String(text ?? "").match(pattern);
  return match?.[1] ? compactWhitespace(match[1]) : null;
}

function allMatches(text, pattern) {
  return [...String(text ?? "").matchAll(pattern)]
    .map((match) => compactWhitespace(match[1] ?? match[0]))
    .filter(Boolean);
}

function extractContentHints(text, field) {
  const value = String(text ?? "");
  const hints = {
    document_type: null,
    extracted_fields: {},
    phrases: [],
    case_or_reference_numbers: [],
  };

  if (/certificate of encumbrance/i.test(value) || /encumbrance on property/i.test(value)) {
    hints.document_type = "encumbrance_certificate";
    hints.extracted_fields.application_no = firstMatch(value, /Application\s+No\s*:?\s*([A-Z0-9/.-]+)/i);
    hints.extracted_fields.certificate_no = firstMatch(value, /Certificate\s+No\s*:?\s*([A-Z0-9/.-]+)/i);
    hints.extracted_fields.applicant_name = firstMatch(value, /Applicant\s+Name\s*:?\s*([A-Z .]+?)(?:Owner\s+Name|Having\s+applied|$)/i);
    hints.extracted_fields.owner_name_as_application = firstMatch(value, /Owner\s+Name(?:\(As\s+per\s+Application\))?\s*:?\s*([A-Z .]+?)(?:Having\s+applied|SL\s+Village|$)/i);
    hints.extracted_fields.search_period = firstMatch(value, /for\s+acts\s+and\s+encumbrances\s+affecting\s+the\s+said\s+property\s+and\s+that\s+on\s+such\s+search|for\s+(\d+\s+years\s+\d{2}-[A-Z]{3}-\d{4}\s+to\s+\d{2}-[A-Z]{3}-\d{4})/i)
      ?? firstMatch(value, /(\d{2}-[A-Z]{3}-\d{4}\s+to\s+\d{2}-[A-Z]{3}-\d{4})/i);
    if (/no acts? or encumbrance/i.test(value) || /no.*encumbrance.*found/i.test(value)) {
      hints.phrases.push("no_acts_or_encumbrance_found_phrase");
    }
    hints.case_or_reference_numbers.push(...allMatches(value, /\b(EC\d{6,})\b/gi));
  }

  if (/certified copy of ror/i.test(value) || /tahasildar/i.test(value) || field === "plotRorId") {
    hints.document_type = hints.document_type ?? "record_of_rights";
    if (/certified copy of ror/i.test(value)) hints.phrases.push("certified_copy_of_ror_phrase");
    hints.extracted_fields.office = firstMatch(value, /Office\s+of\s+the\s+([^,.]+(?:,\s*[^,.]+){0,2})/i);
    hints.case_or_reference_numbers.push(...allMatches(value, /\b([A-Z. ]{0,8}Case\s+No\.?\s*[:.]?\s*[A-Z0-9/ -]+)\b/gi));
    hints.case_or_reference_numbers.push(...allMatches(value, /\b(O\.?L\.?R\.?.{0,20}?Case\s+No\.?\s*[:.]?\s*[A-Z0-9/ -]+)\b/gi));
  }

  hints.case_or_reference_numbers = [...new Set(hints.case_or_reference_numbers)].slice(0, 12);
  return hints.document_type || Object.values(hints.extracted_fields).some(Boolean) || hints.phrases.length || hints.case_or_reference_numbers.length
    ? hints
    : null;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const filesDir = join(options.outDir, "files");
  const imageDir = join(options.outDir, "images");
  await mkdir(filesDir, { recursive: true });
  await mkdir(imageDir, { recursive: true });

  const environment = {
    pdftotext: await commandPath("pdftotext"),
    tesseract_cli: await commandPath("tesseract"),
    sips: await commandPath("sips"),
    sharp: "available",
    tesseract_js: null,
  };

  try {
    environment.tesseract_js = (await import.meta.resolve?.("tesseract.js")) ?? "available";
  } catch {
    try {
      await import("tesseract.js");
      environment.tesseract_js = "available";
    } catch {
      environment.tesseract_js = null;
    }
  }

  let refs = [];
  if (await pathExists(options.candidates)) {
    refs = candidatesToPdfRefs(await readJson(options.candidates), options.run);
  }
  if (!refs.length) refs = await fallbackPdfRefs(options);
  if (options.field?.length) {
    refs = refs.filter((ref) => options.field.includes(String(ref.field ?? "").toLowerCase()));
  }
  refs = refs.slice(0, options.limit);

  const results = [];
  let ocrUsed = 0;
  let worker = null;

  if (environment.tesseract_js && options.ocrLimit > 0) {
    const module = await import("tesseract.js");
    worker = await module.createWorker(options.lang);
  }

  try {
    for (const ref of refs) {
      const buffer = await readFile(ref.file_path);
      const crudeText = crudePdfLiteralText(buffer);
      const dctImages = extractDctImages(buffer, 80);
      const imageCount = countNeedles(buffer, "/DCTDecode");
      let ocr = null;

      if (dctImages.length && worker && ocrUsed < options.ocrLimit) {
        const variants = await prepareOcrImageVariants({
          dctImages,
          imageDir,
          fileBaseName: basename(ref.file_name, ".pdf"),
          pageLimit: options.pageLimit,
          rotations: options.rotations,
        });
        ocrUsed += 1;
        if (variants.length) {
          ocr = await ocrBestVariant({ worker, variants, keepImages: options.keepImages });
          if (ocr) ocr.language = options.lang;
        } else {
          ocr = { ok: false, error: "no large embedded image candidates found" };
        }
      }

      const result = {
        file: ref,
        bytes: buffer.length,
        detected: {
          dct_image_count: imageCount,
          crude_literal_text_chars: crudeText.length,
          crude_literal_text_quality: textQuality(crudeText),
          crude_literal_text_sample: crudeText.slice(0, 1200),
        },
        ocr,
        content_hints: extractContentHints(ocr?.text ?? crudeText, ref.field),
        triage_status: triageStatus({ crudeText, imageCount, ocr }),
        next_step: imageCount > 0
          ? "Use OCR with orientation/language preprocessing, then human review for legal signals."
          : "Investigate PDF parser support or source artifact validity.",
      };

      const resultPath = join(filesDir, `${basename(ref.file_name, ".pdf")}.json`);
      await writeFile(resultPath, JSON.stringify(result, null, 2));
      results.push(result);
    }
  } finally {
    if (worker) await worker.terminate();
  }

  const statusCounts = {};
  const fieldCounts = {};
  for (const result of results) {
    statusCounts[result.triage_status] = (statusCounts[result.triage_status] ?? 0) + 1;
    const field = result.file.field ?? "unknown";
    fieldCounts[field] = (fieldCounts[field] ?? 0) + 1;
  }

  const summary = {
    generated_at: new Date().toISOString(),
    purpose: "PDF text/OCR triage for PID evidence promotion. This does not create final risk findings.",
    options,
    environment,
    processed_count: results.length,
    ocr_attempted_count: results.filter((result) => result.ocr).length,
    status_counts: statusCounts,
    field_counts: fieldCounts,
    files: results.map((result) => ({
      file_name: result.file.file_name,
      file_path: result.file.file_path,
      field: result.file.field,
      linked_card_count: result.file.linked_cards.length,
      bytes: result.bytes,
      dct_image_count: result.detected.dct_image_count,
      crude_literal_text_chars: result.detected.crude_literal_text_chars,
      ocr_chars: result.ocr?.text?.length ?? 0,
      ocr_quality: result.ocr?.text ? textQuality(result.ocr.text) : null,
      ocr_confidence: result.ocr?.confidence ?? null,
      ocr_score: result.ocr?.score ?? null,
      best_variant: result.ocr?.best_variant ?? null,
      content_hint_type: result.content_hints?.document_type ?? null,
      content_hint_count: result.content_hints
        ? Object.values(result.content_hints.extracted_fields ?? {}).filter(Boolean).length + (result.content_hints.phrases?.length ?? 0) + (result.content_hints.case_or_reference_numbers?.length ?? 0)
        : 0,
      triage_status: result.triage_status,
    })),
  };

  await writeFile(join(options.outDir, "pdf_text_poc_summary.json"), JSON.stringify(summary, null, 2));
  await writeFile(join(options.outDir, "pdf_text_poc_summary.md"), markdown(summary));

  console.log(JSON.stringify({
    summary_json: join(options.outDir, "pdf_text_poc_summary.json"),
    summary_md: join(options.outDir, "pdf_text_poc_summary.md"),
    processed_count: summary.processed_count,
    ocr_attempted_count: summary.ocr_attempted_count,
    status_counts: summary.status_counts,
  }, null, 2));
}

function markdown(summary) {
  const statusRows = Object.entries(summary.status_counts)
    .map(([status, count]) => `| ${status} | ${count} |`)
    .join("\n");
  const fileRows = summary.files
    .map((file) => `| ${file.file_name} | ${file.field ?? ""} | ${file.dct_image_count} | ${file.crude_literal_text_chars} | ${file.ocr_chars} | ${file.content_hint_type ?? ""} | ${file.content_hint_count} | ${file.triage_status} |`)
    .join("\n");

  return `# PDF Text/OCR POC Summary

Generated: ${summary.generated_at}

Purpose: ${summary.purpose}

## Environment

| Capability | Available |
|---|---|
| pdftotext CLI | ${summary.environment.pdftotext ? "yes" : "no"} |
| tesseract CLI | ${summary.environment.tesseract_cli ? "yes" : "no"} |
| tesseract.js | ${summary.environment.tesseract_js ? "yes" : "no"} |
| sips | ${summary.environment.sips ? "yes" : "no"} |
| sharp | ${summary.environment.sharp ? "yes" : "no"} |

## Status Counts

| Status | Count |
|---|---:|
${statusRows}

## Files

| File | Field | DCT images | Raw text chars | OCR chars | Hint type | Hints | Triage |
|---|---|---:|---:|---:|---|---:|---|
${fileRows}

## Interpretation

- \`image_pdf_ocr_weak\` means the PDF is image-based and OCR returned low or noisy text in this first pass.
- \`image_pdf_ocr_pending\` means the PDF is image-based and OCR was not attempted in this capped run.
- Strong fraud/dispute labels still require better OCR or manual review of the linked evidence.
`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
