#!/usr/bin/env node

import { Buffer } from "node:buffer";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { RawArchive, utcDateStamp } from "../lib/raw-archive.mjs";

const execFileAsync = promisify(execFile);
const RESULT_MARKER = "__BHULEKH_SAMPLE_RESULT__";

const SAMPLE_INPUTS = [
  {
    artifactId: "mendhasala-plot-415-ror",
    label: "Mendhasala plot 415 RoR sample",
    input: {
      tehsil: "Bhubaneswar",
      tehsilCode: "2",
      village: "Mendhasala",
      villageCode: "105",
      searchMode: "Plot",
      identifierValue: "415",
      identifierLabel: "415",
      previewOnly: true,
    },
  },
];

function parseArgs(argv) {
  const options = {
    root: "pid/data/raw",
    runDate: utcDateStamp(),
  };

  for (const arg of argv.slice(2)) {
    if (arg.startsWith("--root=")) options.root = arg.slice("--root=".length);
    else if (arg.startsWith("--date=")) options.runDate = arg.slice("--date=".length);
  }

  return options;
}

async function runBhulekhFetcher(input) {
  const inlineScript = `
    import { fetch, cleanup } from './packages/fetchers/bhulekh/src/index.ts';
    const input = ${JSON.stringify(input)};
    (async () => {
      try {
        const result = await fetch(input);
        console.log('${RESULT_MARKER}' + JSON.stringify(result));
      } finally {
        await cleanup?.();
      }
    })().catch((error) => {
      console.error(error);
      process.exit(1);
    });
  `;

  const { stdout } = await execFileAsync("npx", ["tsx", "-e", inlineScript], {
    encoding: "utf8",
    maxBuffer: 120 * 1024 * 1024,
    timeout: 120_000,
  });
  const line = stdout.split(/\r?\n/).find((value) => value.startsWith(RESULT_MARKER));
  if (!line) {
    throw new Error(`Bhulekh fetcher did not emit result marker. Output:\n${stdout.slice(-2000)}`);
  }
  return JSON.parse(line.slice(RESULT_MARKER.length));
}

async function main() {
  const options = parseArgs(process.argv);
  const archive = new RawArchive({
    root: options.root,
    runDate: options.runDate,
    collectorVersion: "pid-bhulekh-sample-v1",
  });

  const sourceId = "bhulekh_ror_samples";
  const results = [];

  for (const sample of SAMPLE_INPUTS) {
    const fetched = await runBhulekhFetcher(sample.input);
    const rawResponse = fetched.rawResponse ? JSON.parse(fetched.rawResponse) : null;
    const rawHtml = rawResponse?.raw?.rawHtml ?? "";

    if (rawHtml) {
      await archive.saveFetchedArtifact({
        sourceId,
        artifactId: sample.artifactId,
        artifactType: "html",
        sourceUrl: fetched.data?.sourceDocument ?? rawResponse?.source?.finalUrl ?? "https://bhulekh.ori.nic.in/RoRView.aspx",
        query: {
          label: sample.label,
          ...sample.input,
        },
        httpStatus: 200,
        contentType: "text/html; charset=UTF-8",
        body: Buffer.from(rawHtml, "utf8"),
        accessMode: "public_web_browser_session",
        parseStatus: fetched.status === "success" ? "raw_saved_parsed" : "raw_saved_fetch_failed",
        notes: "Controlled Bhulekh RoR sample using the existing browser-backed fetcher; not a bulk scrape.",
      });
    }

    const summary = {
      artifact_id: sample.artifactId,
      label: sample.label,
      source_url: fetched.data?.sourceDocument ?? rawResponse?.source?.finalUrl ?? null,
      status: fetched.status,
      status_reason: fetched.statusReason,
      verification: fetched.verification,
      fetched_at: fetched.fetchedAt,
      parser_version: fetched.parserVersion,
      location: rawResponse?.location ?? null,
      khatiyan_no: rawResponse?.record?.khatiyanNo ?? fetched.data?.khataNo ?? null,
      plot_rows: rawResponse?.plotTable?.rows?.length ?? null,
      owner_blocks: rawResponse?.record?.ownerBlocks?.length ?? null,
      plot_table_totals: rawResponse?.plotTable?.totals ?? null,
      extracted_data: fetched.data ?? null,
      inputs_tried: fetched.inputsTried ?? [],
      validators: fetched.validators ?? [],
    };

    await archive.saveDerivedJson(sourceId, `${sample.artifactId}_summary`, summary);
    await archive.saveDerivedJson(sourceId, `${sample.artifactId}_fetch_result`, fetched);
    results.push(summary);
  }

  const runSummary = {
    source_id: sourceId,
    label: "Bhulekh Odisha RoR controlled samples",
    source_class: "wave3_browser_session_sample",
    artifact_count: results.length,
    results,
  };
  await archive.saveDerivedJson(sourceId, "source_sample_summary", runSummary);

  console.log(JSON.stringify(runSummary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
