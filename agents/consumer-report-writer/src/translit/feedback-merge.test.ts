/**
 * Tests for the feedback-merge utility and the auto-merge cron.
 *
 * Plan §2.1 P1 P4 gates:
 *   - threshold ≥ 3 unique user_id AND 0 rejections -> auto-merge
 *   - 100% of approved entries appear in the next dict version
 *
 * Tests cover:
 *   - merge utility: dry-run, conflict detection, validation
 *   - cron logic: threshold, rejection blocking, dry-run
 *   - end-to-end: 3-user report triggers auto-merge
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, unlinkSync } from "fs";
import { join } from "path";
import {
  meetsAutoMergeThreshold,
  mergeApprovedFeedback,
  AUTO_MERGE_USER_THRESHOLD,
  ApprovedFeedback,
  readDict,
} from "./feedback-merge";
import {
  runAutoMergeCron,
  groupFeedbackByPair,
  FeedbackRow,
} from "./feedback-cron";

const DICT_PATH = join(__dirname, "..", "dictionaries", "odia-names.json");
const PENDING_PATH = join(__dirname, "..", "dictionaries", "odia-names.pending.json");

describe("meetsAutoMergeThreshold", () => {
  it("returns true when unique users >= threshold AND no rejections", () => {
    const approved: ApprovedFeedback = {
      odiaInput: "କୁମାର",
      suggestedOutput: "Kumar",
      reportedBy: ["u1", "u2", "u3"],
      firstReportedAt: new Date().toISOString(),
    };
    expect(meetsAutoMergeThreshold(approved, 0)).toBe(true);
  });

  it("returns false when unique users < threshold", () => {
    const approved: ApprovedFeedback = {
      odiaInput: "କୁମାର",
      suggestedOutput: "Kumar",
      reportedBy: ["u1", "u2"],
      firstReportedAt: new Date().toISOString(),
    };
    expect(meetsAutoMergeThreshold(approved, 0)).toBe(false);
  });

  it("returns false when there are rejections", () => {
    const approved: ApprovedFeedback = {
      odiaInput: "କୁମାର",
      suggestedOutput: "Kumar",
      reportedBy: ["u1", "u2", "u3", "u4", "u5"],
      firstReportedAt: new Date().toISOString(),
    };
    expect(meetsAutoMergeThreshold(approved, 1)).toBe(false);
  });

  it("returns false when approved is null", () => {
    expect(meetsAutoMergeThreshold(null, 0)).toBe(false);
  });
});

describe("AUTO_MERGE_USER_THRESHOLD", () => {
  it("is 3 per plan §2.1 P1 P4", () => {
    expect(AUTO_MERGE_USER_THRESHOLD).toBe(3);
  });
});

describe("mergeApprovedFeedback — validation", () => {
  it("skips empty input", () => {
    const r = mergeApprovedFeedback(
      [{ odiaInput: "", suggestedOutput: "Kumar", reportedBy: ["u1"], firstReportedAt: "" }],
      { dryRun: true }
    );
    expect(r.skipped).toHaveLength(1);
    expect(r.skipped[0].reason).toBe("empty_input");
  });

  it("skips input without Odia script", () => {
    const r = mergeApprovedFeedback(
      [{ odiaInput: "Kumar", suggestedOutput: "Kumar2", reportedBy: ["u1"], firstReportedAt: "" }],
      { dryRun: true }
    );
    expect(r.skipped).toHaveLength(1);
    expect(r.skipped[0].reason).toBe("no_odia_script");
  });

  it("skips non-Latin suggested output", () => {
    const r = mergeApprovedFeedback(
      [{ odiaInput: "କୁମାର", suggestedOutput: "କୁମାର", reportedBy: ["u1"], firstReportedAt: "" }],
      { dryRun: true }
    );
    expect(r.skipped).toHaveLength(1);
    expect(r.skipped[0].reason).toBe("suggested_output_not_latin");
  });

  it("skips input that is too long", () => {
    const r = mergeApprovedFeedback(
      [{
        odiaInput: "କ".repeat(200),
        suggestedOutput: "K",
        reportedBy: ["u1"],
        firstReportedAt: ""
      }],
      { dryRun: true }
    );
    expect(r.skipped).toHaveLength(1);
    expect(r.skipped[0].reason).toBe("input_too_long");
  });
});

describe("mergeApprovedFeedback — add and conflict", () => {
  it("adds a new entry that isn't in the dict", () => {
    const r = mergeApprovedFeedback(
      [{
        odiaInput: "ଟେଷ୍ଟନାମ",
        suggestedOutput: "Testname",
        reportedBy: ["u1", "u2", "u3"],
        firstReportedAt: new Date().toISOString(),
      }],
      { dryRun: true }
    );
    expect(r.added).toHaveLength(1);
    expect(r.added[0]).toEqual({ odia: "ଟେଷ୍ଟନାମ", latin: "Testname" });
    expect(r.conflicts).toHaveLength(0);
  });

  it("skips an entry that is already in the dict with the same value", () => {
    const dict = readDict();
    const firstKey = Object.keys(dict.tokens)[0];
    const firstVal = dict.tokens[firstKey];
    const r = mergeApprovedFeedback(
      [{
        odiaInput: firstKey,
        suggestedOutput: firstVal,
        reportedBy: ["u1", "u2", "u3"],
        firstReportedAt: new Date().toISOString(),
      }],
      { dryRun: true }
    );
    expect(r.added).toHaveLength(0);
    expect(r.skipped.some((s) => s.reason === "already_in_dict_same_value")).toBe(true);
  });

  it("reports a conflict when suggested differs from existing", () => {
    const dict = readDict();
    const firstKey = Object.keys(dict.tokens)[0];
    const r = mergeApprovedFeedback(
      [{
        odiaInput: firstKey,
        suggestedOutput: "DifferentValue",
        reportedBy: ["u1", "u2", "u3"],
        firstReportedAt: new Date().toISOString(),
      }],
      { dryRun: true }
    );
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0]).toEqual({
      odia: firstKey,
      existing: dict.tokens[firstKey],
      suggested: "DifferentValue",
    });
  });

  it("bumps dict version on every merge", () => {
    const dict = readDict();
    const before = dict._meta.version;
    const r = mergeApprovedFeedback(
      [{
        odiaInput: "ଟେଷ୍ଟନାମ",
        suggestedOutput: "Testname",
        reportedBy: ["u1", "u2", "u3"],
        firstReportedAt: new Date().toISOString(),
      }],
      { dryRun: true }
    );
    expect(r.newVersion).toBe(before + 1);
  });
});

describe("mergeApprovedFeedback — file write", () => {
  it("writes the new dict to odia-names.pending.json", () => {
    // Clean up any leftover from previous tests
    if (existsSync(PENDING_PATH)) unlinkSync(PENDING_PATH);

    const r = mergeApprovedFeedback(
      [{
        odiaInput: "ଟେଷ୍ଟନାମ",
        suggestedOutput: "Testname",
        reportedBy: ["u1", "u2", "u3"],
        firstReportedAt: new Date().toISOString(),
      }],
      { dryRun: false }
    );
    expect(r.added).toHaveLength(1);
    expect(existsSync(PENDING_PATH)).toBe(true);

    // Verify the pending file is valid JSON with the new entry
    const pending = JSON.parse(readFileSync(PENDING_PATH, "utf-8"));
    expect(pending.tokens["ଟେଷ୍ଟନାମ"]).toBe("Testname");
    expect(pending._meta.version).toBe(r.newVersion);

    // Cleanup
    unlinkSync(PENDING_PATH);
  });

  it("does NOT modify the active dict file (production safety)", () => {
    if (existsSync(PENDING_PATH)) unlinkSync(PENDING_PATH);
    const beforeContent = readFileSync(DICT_PATH, "utf-8");

    mergeApprovedFeedback(
      [{
        odiaInput: "ଟେଷ୍ଟନାମ",
        suggestedOutput: "Testname",
        reportedBy: ["u1", "u2", "u3"],
        firstReportedAt: new Date().toISOString(),
      }],
      { dryRun: false }
    );

    const afterContent = readFileSync(DICT_PATH, "utf-8");
    expect(afterContent).toBe(beforeContent);

    if (existsSync(PENDING_PATH)) unlinkSync(PENDING_PATH);
  });
});

describe("groupFeedbackByPair", () => {
  it("groups by (odia, suggestion) pair", () => {
    const rows: FeedbackRow[] = [
      { id: 1, userId: "u1", odiaInput: "କୁମାର", currentOutput: "Kumar", suggestedOutput: "Kumar", status: "pending", createdAt: "2026-06-17T00:00:00Z" },
      { id: 2, userId: "u2", odiaInput: "କୁମାର", currentOutput: "Kumar", suggestedOutput: "Kumar", status: "approved", createdAt: "2026-06-17T00:01:00Z" },
      { id: 3, userId: "u1", odiaInput: "ସୀତା", currentOutput: "Sita", suggestedOutput: "Sita", status: "pending", createdAt: "2026-06-17T00:02:00Z" },
    ];
    const groups = groupFeedbackByPair(rows);
    expect(groups.size).toBe(2);
    const kumarGroup = groups.get("କୁମାର::Kumar");
    expect(kumarGroup?.approved).toHaveLength(1);
    expect(kumarGroup?.pending).toHaveLength(1);
  });
});

describe("runAutoMergeCron — threshold logic", () => {
  it("merges when 3 unique users report same (odia, suggestion)", () => {
    const rows: FeedbackRow[] = [
      { id: 1, userId: "u1", odiaInput: "ନୂଆନାମ", currentOutput: "Nuanam", suggestedOutput: "Newname", status: "pending", createdAt: "2026-06-17T00:00:00Z" },
      { id: 2, userId: "u2", odiaInput: "ନୂଆନାମ", currentOutput: "Nuanam", suggestedOutput: "Newname", status: "pending", createdAt: "2026-06-17T00:01:00Z" },
      { id: 3, userId: "u3", odiaInput: "ନୂଆନାମ", currentOutput: "Nuanam", suggestedOutput: "Newname", status: "pending", createdAt: "2026-06-17T00:02:00Z" },
    ];
    if (existsSync(PENDING_PATH)) unlinkSync(PENDING_PATH);
    const result = runAutoMergeCron(rows, { dryRun: false });
    expect(result.autoApprovedCount).toBe(1);
    expect(result.merged.added).toHaveLength(1);
    expect(result.merged.added[0]).toEqual({ odia: "ନୂଆନାମ", latin: "Newname" });
    if (existsSync(PENDING_PATH)) unlinkSync(PENDING_PATH);
  });

  it("does NOT merge with 2 unique users (below threshold)", () => {
    const rows: FeedbackRow[] = [
      { id: 1, userId: "u1", odiaInput: "ନୂଆନାମ", currentOutput: "Nuanam", suggestedOutput: "Newname", status: "pending", createdAt: "2026-06-17T00:00:00Z" },
      { id: 2, userId: "u2", odiaInput: "ନୂଆନାମ", currentOutput: "Nuanam", suggestedOutput: "Newname", status: "pending", createdAt: "2026-06-17T00:01:00Z" },
    ];
    const result = runAutoMergeCron(rows, { dryRun: true });
    expect(result.autoApprovedCount).toBe(0);
    expect(result.stillPendingCount).toBe(1);
  });

  it("blocks merge when there are any rejections for the pair", () => {
    const rows: FeedbackRow[] = [
      { id: 1, userId: "u1", odiaInput: "ନୂଆନାମ", currentOutput: "X", suggestedOutput: "Newname", status: "pending", createdAt: "2026-06-17T00:00:00Z" },
      { id: 2, userId: "u2", odiaInput: "ନୂଆନାମ", currentOutput: "X", suggestedOutput: "Newname", status: "pending", createdAt: "2026-06-17T00:01:00Z" },
      { id: 3, userId: "u3", odiaInput: "ନୂଆନାମ", currentOutput: "X", suggestedOutput: "Newname", status: "pending", createdAt: "2026-06-17T00:02:00Z" },
      { id: 4, userId: "u4", odiaInput: "ନୂଆନାମ", currentOutput: "X", suggestedOutput: "Newname", status: "rejected", createdAt: "2026-06-17T00:03:00Z" },
    ];
    const result = runAutoMergeCron(rows, { dryRun: true });
    expect(result.autoApprovedCount).toBe(0);
    expect(result.blockedByRejectionCount).toBe(1);
  });

  it("dry-run does not write to disk", () => {
    const rows: FeedbackRow[] = [
      { id: 1, userId: "u1", odiaInput: "ଡ୍ରାଇରୁନ", currentOutput: "X", suggestedOutput: "DryRunName", status: "pending", createdAt: "2026-06-17T00:00:00Z" },
      { id: 2, userId: "u2", odiaInput: "ଡ୍ରାଇରୁନ", currentOutput: "X", suggestedOutput: "DryRunName", status: "pending", createdAt: "2026-06-17T00:01:00Z" },
      { id: 3, userId: "u3", odiaInput: "ଡ୍ରାଇରୁନ", currentOutput: "X", suggestedOutput: "DryRunName", status: "pending", createdAt: "2026-06-17T00:02:00Z" },
    ];
    if (existsSync(PENDING_PATH)) unlinkSync(PENDING_PATH);
    const result = runAutoMergeCron(rows, { dryRun: true });
    expect(result.autoApprovedCount).toBe(1);
    expect(existsSync(PENDING_PATH)).toBe(false);
  });
});

describe("Plan §2.1 P1 P4 gate — end-to-end", () => {
  it("P1 P4 gate: 100% of approved entries appear in next dict version", () => {
    if (existsSync(PENDING_PATH)) unlinkSync(PENDING_PATH);

    const rows: FeedbackRow[] = [
      // 3 unique users report the same Odia name
      { id: 1, userId: "u1", odiaInput: "ଗେଟ", currentOutput: "Ghet", suggestedOutput: "Geet", status: "pending", createdAt: "2026-06-17T00:00:00Z" },
      { id: 2, userId: "u2", odiaInput: "ଗେଟ", currentOutput: "Ghet", suggestedOutput: "Geet", status: "pending", createdAt: "2026-06-17T00:01:00Z" },
      { id: 3, userId: "u3", odiaInput: "ଗେଟ", currentOutput: "Ghet", suggestedOutput: "Geet", status: "pending", createdAt: "2026-06-17T00:02:00Z" },
    ];

    runAutoMergeCron(rows, { dryRun: false });

    // Verify the new entry is in the pending file
    expect(existsSync(PENDING_PATH)).toBe(true);
    const pending = JSON.parse(readFileSync(PENDING_PATH, "utf-8"));
    expect(pending.tokens["ଗେଟ"]).toBe("Geet");

    if (existsSync(PENDING_PATH)) unlinkSync(PENDING_PATH);
  });
});
