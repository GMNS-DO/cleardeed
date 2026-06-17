/**
 * Before/after comparison for the Odia transliteration rule changes (P5).
 *
 * Runs 10 representative Odia inputs through:
 *   1. PRE-P5 lib.ts (the deterministic rules + 501-token dict from c688e32)
 *   2. POST-P5 lib.ts (the new resolveConjunct() + nukta fix + 630-token dict from ef24cb1)
 *
 * Output: a markdown table showing the side-by-side outputs.
 *
 * Run with: npx tsx qa/before-after-odia.ts
 */

import { transliterateOdiaWithConfidence } from "../agents/consumer-report-writer/src/lib";

// We re-implement the pre-P5 charByChar here so we don't have to swap modules.
// Source: /tmp/lib-pre-p5.ts at commit c688e32.
const PRE_P5_CONSONANT_MAP: Record<string, string> = {
  "କ": "k", "ଖ": "kh", "ଗ": "g", "ଘ": "gh", "ଙ": "ng",
  "ଚ": "ch", "ଛ": "chh", "ଜ": "j", "ଝ": "jh", "ଞ": "n",
  "ଟ": "t", "ଠ": "th", "ଡ": "d", "ଢ": "dh", "ଣ": "n",
  "ତ": "t", "ଥ": "th", "ଦ": "d", "ଧ": "dh", "ନ": "n",
  "଩": "n", "ପ": "p", "ଫ": "ph", "ବ": "b", "ଭ": "bh",
  "ମ": "m", "ଯ": "j", "ର": "r", "଱": "r", "ଲ": "l",
  "ଳ": "l", "ଵ": "w", "ଶ": "sh", "ଷ": "sh", "ସ": "s",
  "ହ": "h",
  // NOTE: pre-P5 did NOT have ୟ in the map.
};
const PRE_P5_NUKTA = new Set(["ଡ଼", "ଢ଼", "ୟ"]); // pre-P5 had 0xB5F in NUKTA
const PRE_P5_NUKTA_MAP: Record<string, string> = {
  "ଡ଼": "d",
  "ଢ଼": "dh",
  "ୟ": "y", // pre-P5 mapped 0xB5F to "y" as a nukta
};
const PRE_P5_VOWELS = new Set([
  "ଅ", "ଆ", "ଇ", "ଈ", "ଉ", "ଊ", "ଋ", "ଌ", "ଏ", "ଐ", "ଓ", "ଔ",
]);
const PRE_P5_VOWEL_MODIFIERS = new Set([
  "ା", "ି", "ୀ", "ୁ", "ୂ", "ୃ", "ୄ", "େ", "ୈ", "ୋ", "ୌ", "ୖ",
]);
const PRE_P5_VIRAMA = "୍";
const PRE_P5_ANUSVARA = new Set(["ଁ", "ଂ"]);
const PRE_P5_CONSONANTS = new Set(Object.keys(PRE_P5_CONSONANT_MAP));
const PRE_P5_CANDRA_BINDU = "଼";
const PRE_P5_VOWEL_MAP: Record<string, string> = {
  "ଅ": "a", "ଆ": "a", "ଇ": "i", "ଈ": "i",
  "ଉ": "u", "ଊ": "u", "ଋ": "ri", "ଌ": "ri",
  "ଏ": "e", "ଐ": "ai", "ଓ": "o", "ଔ": "au",
};
const PRE_P5_MODIFIER_MAP: Record<string, string> = {
  "ା": "a", "ି": "i", "ୀ": "i", "ୁ": "u",
  "ୂ": "u", "ୃ": "ri", "ୄ": "ri", "େ": "e",
  "ୈ": "ai", "ୋ": "o", "ୌ": "au", "ୖ": "au",
};

// Pre-P5 KNOWN_ODIA_NAMES — load from /tmp/dict-pre-p5.json
import { readFileSync } from "fs";
const PRE_P5_DICT: Record<string, string> = JSON.parse(
  readFileSync("/tmp/dict-pre-p5.json", "utf-8")
).tokens;

function preP5CharByChar(text: string): string {
  const result: string[] = [];
  let i = 0;
  const chars = [...text];
  let lastKind: "plain-a" | "modified" | "punct" | "vowel" = "punct";

  while (i < chars.length) {
    const c = chars[i];

    if (c === PRE_P5_CANDRA_BINDU) {
      if (result.length > 0) {
        result[result.length - 1] += "n";
        lastKind = "modified";
      }
      i++;
      continue;
    }

    if (PRE_P5_ANUSVARA.has(c)) {
      if (result.length > 0) {
        result[result.length - 1] += "n";
        lastKind = "modified";
      } else {
        result.push("n");
        lastKind = "modified";
      }
      i++;
      continue;
    }

    if (PRE_P5_VOWELS.has(c)) {
      result.push(PRE_P5_VOWEL_MAP[c] ?? c);
      lastKind = "vowel";
      i++;
      continue;
    }

    if (PRE_P5_VOWEL_MODIFIERS.has(c)) {
      if (result.length > 0) {
        result[result.length - 1] += PRE_P5_MODIFIER_MAP[c] ?? "";
        lastKind = "modified";
      }
      i++;
      continue;
    }

    if (PRE_P5_CONSONANTS.has(c)) {
      if (i + 2 < chars.length && chars[i + 1] === PRE_P5_VIRAMA) {
        const nextConsonant = chars[i + 2];
        if (PRE_P5_CONSONANTS.has(nextConsonant)) {
          const cur = PRE_P5_CONSONANT_MAP[c] ?? c;
          const nxt = PRE_P5_CONSONANT_MAP[nextConsonant] ?? nextConsonant;
          // Pre-P5 only folded identical-nasal geminate.
          const sameNasal =
            c === nextConsonant &&
            (c === "ନ" || c === "ଣ" || c === "ମ" || c === "ଙ");
          const clusterStr = sameNasal ? nxt : cur + nxt;
          result.push(clusterStr);
          lastKind = "modified";
          i += 3;
          continue;
        }
      }

      if (i + 1 < chars.length && chars[i + 1] === PRE_P5_VIRAMA) {
        result.push(PRE_P5_CONSONANT_MAP[c] ?? c);
        lastKind = "modified";
        i += 2;
        continue;
      }

      // Pre-P5 nukta handling: ଡ + ଼ → "d", ଢ + ଼ → "dh", ଯ + ୟ → "y"
      let out = PRE_P5_CONSONANT_MAP[c] ?? c;
      let j = i + 1;
      let hadModifier = false;
      if (j < chars.length && PRE_P5_NUKTA.has(chars[j])) {
        const nuktaChar = chars[j];
        out = PRE_P5_NUKTA_MAP[nuktaChar] ?? out;
        j++;
        hadModifier = true;
      }
      while (j < chars.length) {
        if (PRE_P5_VOWEL_MODIFIERS.has(chars[j])) {
          out += PRE_P5_MODIFIER_MAP[chars[j]] ?? "";
          j++;
          hadModifier = true;
        } else if (chars[j] === PRE_P5_CANDRA_BINDU) {
          out += "n";
          j++;
          hadModifier = true;
        } else {
          break;
        }
      }
      if (!hadModifier) {
        out += "a";
        lastKind = "plain-a";
      } else {
        lastKind = "modified";
      }
      result.push(out);
      i = j;
      continue;
    }

    if (/\s/.test(c) || /^[.,;:!?-]$/.test(c)) {
      result.push(c);
      lastKind = "punct";
    }
    i++;
  }

  // Pre-P5 final-schwa rule: only when last token is exactly 2 chars (C + 'a')
  if (lastKind === "plain-a" && result.length > 0) {
    const last = result[result.length - 1];
    if (
      last.length === 2 &&
      last.endsWith("a") &&
      /^[bcdfghjklmnpqrstvwxyz]a$/.test(last)
    ) {
      result[result.length - 1] = last.slice(0, -1);
    }
  }

  return result.join("");
}

function preP5Transliterate(text: string): string {
  if (!text) return "";
  if (PRE_P5_DICT[text]) return PRE_P5_DICT[text];
  const trimmed = text.trim();
  if (PRE_P5_DICT[trimmed]) return PRE_P5_DICT[trimmed];
  const words = trimmed.split(/\s+/);
  return words.map((w) => PRE_P5_DICT[w] ?? preP5CharByChar(w)).join(" ");
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ─── 10 sample inputs (mix of common + tricky) ─────────────────────────────
const SAMPLES: { odia: string; want: string; note: string }[] = [
  { odia: "ସରୋଜିନୀ", want: "Sarojini", note: "dict hit, common" },
  { odia: "ପୁର୍ଣ୍ଣିମା", want: "Purnima", note: "geminate conjunct (ଣ୍ଣ)" },
  { odia: "ମଙ୍ଗଳା", want: "Mangala", note: "nasal conjunct (ଙ୍ଗ)" },
  { odia: "ଅର୍ଜୁନ", want: "Arjuna", note: "long name with conjunct" },
  { odia: "ଚିତ୍ରଲେଖା", want: "Chitralekha", note: "multi-conjunct (ତ୍ର)" },
  { odia: "ବନ୍ଦନା", want: "Bandana", note: "3-consonant cluster (ନ୍ଦ)" },
  { odia: "ହେମାଙ୍ଗି", want: "Hemangi", note: "nasal conjunct + ି" },
  { odia: "ଭଗବତ", want: "Bhagabat", note: "trailing schwa suppression" },
  { odia: "ରଞ୍ଜିତା", want: "Ranjita", note: "ଞ୍ଜ conjunct" },
  { odia: "ଗଜେନ୍ଦ୍ର", want: "Gajendra", note: "multiple conjuncts (ଜ + େ + ନ୍ଦ୍ର)" },
];

// Additional 10 production-shaped samples — the actual inputs
// the report pipeline sees (multi-token, with father names, with
// native Latin text mixed in).
const PRODUCTION_SAMPLES: { odia: string; want: string; note: string }[] = [
  {
    odia: "ଅଭୟ କୁମାର ମହାପାତ୍ର",
    want: "Abhaya Kumar Mahapatra",
    note: "full name (3 tokens) — first token has the nukta-bug case",
  },
  {
    odia: "ସରୋଜିନୀ ଦେବୀ s/o ହେମାଙ୍ଗ",
    want: "Sarojini Devi s/o Hemang",
    note: "name with Latin 's/o' marker (PII redaction in production strips this BEFORE transliteration, so this case never hits the rule in real reports — the 's/o' is being mangled here as a pre-prod edge case)",
  },
  {
    odia: "ଗଙ୍ଗେଶ୍ୱର ପଣ୍ଡିତ",
    want: "Gangeshwar Pandit",
    note: "ଶ୍ୱ conjunct (post-fix only)",
  },
  {
    odia: "Ramesh Kumar",
    want: "Ramesh Kumar",
    note: "Latin-only input — passthrough",
  },
  {
    odia: "ପୁର୍ଣ୍ଣିମା ଜେନା",
    want: "Purnima Jena",
    note: "geminate conjunct + common surname",
  },
  {
    odia: "ଅନ୍ୱର ଖାନ",
    want: "Anwar Khan",
    note: "ନ୍ୱ conjunct (post-fix only) + non-Odia surname",
  },
  {
    odia: "ସୁଶୀଲ କୁମାର ମିଶ୍ର",
    want: "Sushil Kumar Mishra",
    note: "ଶ୍ର conjunct (post-fix only)",
  },
  {
    odia: "ପ୍ରଫୁଲ୍ଲ କୁମାର ସାହୁ",
    want: "Prafulla Kumar Sahu",
    note: "ଲ୍ଲ conjunct (post-fix only)",
  },
  {
    odia: "ଗୀତା ସ୍ୱାଇଁ",
    want: "Geeta Swain",
    note: "ସ୍ୱ conjunct (post-fix only)",
  },
  {
    odia: "ଶକ୍ତି ପ୍ରସାଦ ଦାସ",
    want: "Shakti Prasad Das",
    note: "କ୍ତ conjunct (post-fix only)",
  },
];

// ─── Run and tabulate ────────────────────────────────────────────────────────
function runSampleSet(samples: typeof SAMPLES, title: string): { preP5Pass: number; postP5Pass: number } {
  let preP5Pass = 0;
  let postP5Pass = 0;
  console.log();
  console.log(`## ${title}`);
  console.log();
  console.log("| # | Odia | Expected | Pre-P5 | Post-P5 | Δ | Note |");
  console.log("|--:|------|----------|--------|---------|---|------|");

  samples.forEach((s, i) => {
    const pre = titleCase(preP5Transliterate(s.odia));
    const post = transliterateOdiaWithConfidence(s.odia).english;

    const preOk = pre.toLowerCase() === s.want.toLowerCase();
    const postOk = post.toLowerCase() === s.want.toLowerCase();
    if (preOk) preP5Pass++;
    if (postOk) postP5Pass++;

    const delta = preOk === postOk
      ? (preOk ? "✅ both" : "❌ both")
      : (postOk ? "🟢 FIXED" : "🔴 REGRESSION");

    const odiaCell = s.odia.replace(/\|/g, "\\|");
    const preCell = pre.replace(/\|/g, "\\|");
    const postCell = post.replace(/\|/g, "\\|");
    const wantCell = s.want.replace(/\|/g, "\\|");

    console.log(`| ${i + 1} | ${odiaCell} | ${wantCell} | ${preCell} | ${postCell} | ${delta} | ${s.note} |`);
  });

  console.log();
  console.log(`**Pre-P5 pass rate: ${preP5Pass}/${samples.length} (${((preP5Pass / samples.length) * 100).toFixed(0)}%)**`);
  console.log(`**Post-P5 pass rate: ${postP5Pass}/${samples.length} (${((postP5Pass / samples.length) * 100).toFixed(0)}%)**`);

  return { preP5Pass, postP5Pass };
}

console.log();
console.log("# Odia transliteration: before vs after P5");
console.log();
console.log(`Pre-P5:  commit c688e32 (501-token dict, inline conjunct rule, U+0B5F as nukta)`);
console.log(`Post-P5: commit ef24cb1 (630-token dict, resolveConjunct(), U+0B5F as base consonant)`);

const r1 = runSampleSet(SAMPLES, "Sample Set 1: Single-token names (mix of common, conjunct-heavy)");
const r2 = runSampleSet(PRODUCTION_SAMPLES, "Sample Set 2: Production-shaped inputs (multi-token, mixed Odia + Latin)");

// ─── IGR RoR samples (real names from production fixtures) ──────────────────
// These are the names the report pipeline ACTUALLY processes. Sourced
// from golden-path.ts, consumer-report-writer/src/index.test.ts,
// ownership-reasoner/index.test.ts, bhulekh/src/index.test.ts, and
// demo-fixture.ts (real names, not hand-curated).
import { readFileSync } from "fs";
const IGR_ROR_SAMPLES: { odia: string; want: string; source: string; note: string }[] = JSON.parse(
  readFileSync("qa/fixtures/igr-ror-samples.json", "utf-8")
).map((s: { odia: string; want: string; source: string; note: string }) => ({
  odia: s.odia,
  want: s.want,
  source: s.source,
  note: s.note,
}));

const r3 = runSampleSet(IGR_ROR_SAMPLES, "Sample Set 3: Real IGR RoR fixture names (45 samples from production code)");

const totalPre = r1.preP5Pass + r2.preP5Pass + r3.preP5Pass;
const totalPost = r1.postP5Pass + r2.postP5Pass + r3.postP5Pass;
const total = SAMPLES.length + PRODUCTION_SAMPLES.length + IGR_ROR_SAMPLES.length;

console.log();
console.log("## Verdict");
console.log();
console.log(`**Combined pre-P5:  ${totalPre}/${total} (${((totalPre / total) * 100).toFixed(0)}%)**`);
console.log(`**Combined post-P5: ${totalPost}/${total} (${((totalPost / total) * 100).toFixed(0)}%)**`);
console.log();
console.log(`P5 fixes ${totalPost - totalPre} of ${total} names.`);
console.log();
console.log(`### Set-by-set breakdown`);
console.log();
console.log(`| Set | Pre-P5 | Post-P5 | Δ |`);
console.log(`|-----|--------|---------|---|`);
console.log(`| 1. Single-token (${SAMPLES.length}) | ${r1.preP5Pass}/${SAMPLES.length} | ${r1.postP5Pass}/${SAMPLES.length} | +${r1.postP5Pass - r1.preP5Pass} |`);
console.log(`| 2. Production-shaped (${PRODUCTION_SAMPLES.length}) | ${r2.preP5Pass}/${PRODUCTION_SAMPLES.length} | ${r2.postP5Pass}/${PRODUCTION_SAMPLES.length} | +${r2.postP5Pass - r2.preP5Pass} |`);
console.log(`| 3. Real IGR RoR fixture (${IGR_ROR_SAMPLES.length}) | ${r3.preP5Pass}/${IGR_ROR_SAMPLES.length} | ${r3.postP5Pass}/${IGR_ROR_SAMPLES.length} | +${r3.postP5Pass - r3.preP5Pass} |`);
console.log();
