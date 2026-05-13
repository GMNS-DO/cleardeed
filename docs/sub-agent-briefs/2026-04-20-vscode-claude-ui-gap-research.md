# Research: VS Code Claude Code vs Official Claude UI — Behavioral Gap Analysis

**Research date:** 2026-04-20
**Scope:** All behavioral differences between Claude Code (VS Code extension with custom API key via OpusMax proxy) and the official claude.ai web UI, with focus on reasoning/execution quality gap
**Status:** Complete

---

## Executive Summary

The quality gap between Claude Code running in VS Code and the official claude.ai web UI stems from at least seven distinct, compounding factors. The most critical are: (1) a documented triple-bug in Claude Code's thinking mode that silently prevents extended thinking from engaging even when `alwaysThinkingEnabled: true` is set; (2) the VS Code extension auto-compacting context at 35% remaining vs the CLI's 1-5%, causing more aggressive information loss in long conversations; (3) Claude Code using a coding-specialized harness system prompt rather than the general-audience system prompt of the official UI; and (4) the official UI having access to dedicated web search and deep research tools unavailable through the standard Claude Code API harness. The OpusMax proxy adds a further architectural layer that may alter model routing, prompt caching behavior, and token processing compared to direct Anthropic API calls. Of the 19 concrete findings below, approximately 11 are fixable through `~/.claude/settings.json` configuration changes, 3 require OpusMax proxy configuration changes, and 5 represent fundamental architectural limitations that cannot be addressed without switching to the official UI or Anthropic's direct API.

---

## Layer 1: Model & Sampling

### Findings

**F1. The official UI uses adaptive model routing with automatic Opus-to-Sonnet fallbacks that Claude Code does not replicate with a custom API key.**
For Claude Max (subscription) users on claude.ai, when Opus usage exceeds a threshold, the system automatically falls back to Sonnet to prevent hitting plan limits. This routing is a server-side behavior of the official UI and does not occur when using a direct API key. With an OpusMax API key, all requests go to whatever model the configuration specifies — no automatic routing occurs.
*Source: [Claude Code Models: Choose the Right AI for Every Task](https://claudefa.st/blog/models/model-selection), [Reddit: Stop Burning Money on Wrong Claude Model](https://www.reddit.com/r/ClaudeAI/comments/1riyfrj/stop_burning_money_on_the_wrong_claude_model/)*

**F2. The official UI applies version-specific system prompts that differ from what the API delivers.**
Anthropic maintains separate system prompts for each model version (Opus 4.7, Sonnet 4.6, Opus 4.6, Opus 4.5, Haiku 4.5), with varying knowledge cutoffs and capability flags. The official UI uses whichever system prompt corresponds to the model's current version. When using a custom API key, the system prompt delivered by the harness may not match what the official UI sends for the equivalent model.
*Source: [System Prompts - Claude API Docs](https://platform.claude.com/docs/en/release-notes/system-prompts)*

**F3. The official UI does not expose temperature, top-p, or top-k parameters to users — it controls these internally.**
The official claude.ai UI has no user-accessible controls for sampling parameters. Anthropic sets these server-side for optimal quality. Claude Code via API allows explicit model specification but does not expose raw sampling parameter controls in `settings.json`. The OpusMax proxy may further alter or reset these defaults.
*Source: [Claude API Docs - Model Parameters](https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-text-completion.html), [LLM Settings - Prompt Engineering Guide](https://www.promptingguide.ai/introduction/settings)*

**F4. OpusMax may use different model ID routing than Anthropic's canonical IDs.**
Proxies like OpusMax map incoming model names (e.g., "opus") to underlying model IDs (e.g., "claude-opus-4-7") and may route requests differently than the official Anthropic endpoint. This can result in different model versions, different server-side configurations, or different fallback behavior than the official UI.
*Source: [Claude Code in the Enterprise — Model Mapping for LLM Proxies](https://medium.com/@trevor00/claude-code-in-the-enterprise-model-mapping-for-llm-proxies-b0d8069c6aa3), [Reddit: Best way to plug-in other providers w/o losing Anthropic endpoints](https://www.reddit.com/r/ClaudeCode/comments/1sm76yy/best_way_to_plugin_other_providers_wo_losing/)*

**F5. Claude Code defaults to medium effort and adaptive thinking since February 2026, changing default behavior from previous versions.**
Since approximately February 2026, Claude Code changed its default effort level to "medium" with adaptive thinking enabled by default. This means the model now self-regulates how much reasoning it applies rather than always using maximum reasoning. This is a recent change that may cause users who set `alwaysThinkingEnabled: true` months ago to experience different behavior than expected.
*Source: [Claude Code Getting Worse? Two Settings 90% of Users Don't Know About](https://pasqualepillitteri.it/en/news/805/claude-code-effort-adaptive-thinking-guida), [Building with extended thinking - Claude API Docs](https://platform.claude.com/docs/en/build-with-claude/extended-thinking)*

### Recommended Settings Changes

```json
{
  "model": "claude-opus-4-7",
  "alwaysThinkingEnabled": true,
  "effort": "max",
  "disableAdaptiveThinking": true
}
```

**Rationale:** Using the explicit model ID `claude-opus-4-7` (rather than the alias "opus") eliminates any model ID ambiguity in OpusMax routing. Setting `effort: "max"` overrides the February 2026 default of "medium". Setting `disableAdaptiveThinking: true` forces maximum reasoning on every response, compensating for the regression in default behavior.

---

## Layer 2: System Prompt & Instructions

### Findings

**F6. Claude Code uses a coding-specialized harness system prompt that differs significantly from the official UI's general-purpose system prompt.**
The official UI system prompt is periodically updated and includes comprehensive behavioral guidelines for safety, tone, formatting, user wellbeing, and product-specific instructions (web search, deep research, code execution, artifacts, memory). Claude Code additionally injects a harness layer with coding-specific instructions (how to read/write files, run commands, use git, create diffs) that changes the model's framing from "conversational assistant" to "coding agent." This fundamental shift in role definition affects response style, depth of explanation, and reasoning approach.
*Source: [Comparing Claude System Prompts Reveal Anthropic's Priorities - Hacker News](https://news.ycombinator.com/item?id=44185836), [System Prompts – Anthropic - Theoreti.ca](https://theoreti.ca/?p=8542), [What we can learn from Anthropic's System prompt updates](https://blog.promptlayer.com/what-we-can-learn-from-anthropics-system-prompt-updates/)*

**F7. The official UI's system prompt includes tone and formatting rules that Claude Code's harness does not replicate.**
The official UI instructs Claude to "avoid over-formatting with bullet points and lists; use prose in natural conversation unless explicitly requested; avoid emojis unless the user uses them." Claude Code's harness adds a code-diff and terminal-output framing that primes the model for a more technical, less conversational response style. This affects the quality of written analysis, explanations, and reasoning chains.
*Source: [System Prompts - Claude API Docs](https://platform.claude.com/docs/en/release-notes/system-prompts), [A Complete Guide to the Anthropic API vs Claude Web Interface](https://labs.lamatic.ai/p/anthropic-api-vs-claude/)*

**F8. Claude Code adds mandatory tool-use instructions as part of its harness that are not present in the official UI.**
Claude Code's system prompt includes instructions about available tools (Bash, Edit, Read, Glob, Grep, Write, WebSearch, etc.) and how to use them in an agentic workflow. The official UI's toolset is different (web search, deep research, artifacts, memory). The tools Claude Code is primed to use shape what it attempts and how it approaches problems.
*Source: [Claude's System Prompt explained - Medium](https://medium.com/data-science-in-your-pocket/claudes-system-prompt-explained-d9b7989c38a3)*

### Recommended Settings Changes

No direct `settings.json` change can replace the harness system prompt. However, the quality gap can be partially reduced by:

```json
{
  "alwaysThinkingEnabled": true,
  "effort": "max",
  "disableAdaptiveThinking": true,
  "alwaysAllow": ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "WebFetch", "WebSearch"]
}
```

**Rationale:** Ensuring all tool permissions are granted (`alwaysAllow`) reduces friction in Claude Code's agentic flow, making it behave more like the frictionless experience of the official UI where tools are seamlessly available. The `disableAdaptiveThinking` setting is critical — it forces maximum reasoning depth on every turn, partially compensating for the reduced deliberateness of the coding harness.

---

## Layer 3: Prompt Caching

### Findings

**F9. Claude Code has two documented cache bugs that can silently inflate token usage by 10-20x with no warning.**
As of March 2026, Claude Code has two confirmed cache-related bugs: (1) "Sentinel replacement" bug causes incorrect cache hit/miss decisions, and (2) a cache TTL regression silently changed TTL from 1 hour to 5 minutes around early March 2026. These bugs cause massive token inflation and quota overconsumption. The cache TTL regression is confirmed as an active issue (GitHub issue #46829).
*Source: [Reddit: Claude Code has two cache bugs that can silently 10-20x your API costs](https://www.reddit.com/r/ClaudeAI/comments/1s7mkn3/psa_claude_code_has_two_cache_bugs_that_can/), [GitHub: Cache TTL silently regressed from 1h to 5m](https://github.com/anthropics/claude-code/issues/46829), [Claude Code Token Optimization: Full System Guide](https://buildtolaunch.substack.com/p/claude-code-token-optimization)*

**F10. Prompt caching is available on the Anthropic API but Claude Code's implementation has known issues with TTL and hit-rate accuracy.**
Anthropic's prompt caching (via `cache_control` fields) is designed to store computed token representations to reduce per-request costs on repeated context. Claude Code uses this internally but the bugs above mean cache behavior is unreliable. The official UI may handle caching at a different architectural layer that avoids these issues.
*Source: [Prompt caching - Claude API Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching), [What Is Anthropic's Prompt Caching](https://www.mindstudio.ai/blog/anthropic-prompt-caching-claude-subscription-limits/)*

**F11. Whether OpusMax supports prompt caching depends on its implementation — many proxy providers do not forward cache control headers.**
Prompt caching requires the proxy to understand and forward Anthropic's `cache_control` message-level feature. Not all API proxies implement this correctly. If OpusMax strips or ignores cache control headers, Claude Code's cache bugs are compounded by a broken caching layer.
*Source: [Claude Code Token Optimization: Full System Guide](https://buildtolaunch.substack.com/p/claude-code-token-optimization)*

### Recommended Settings Changes

```json
{
  "cacheEnabled": false
}
```

**Rationale:** Disabling prompt caching (`cacheEnabled: false`) in Claude Code bypasses the two documented cache bugs entirely. While this increases token costs per request (no cache reuse), it ensures predictable billing and eliminates the silent 10-20x inflation. This is a trade-off: cost consistency vs. cache savings. For the user experiencing quality issues, disabling the broken cache layer removes one source of unpredictability.

**OpusMax proxy recommendation:** Ask OpusMax whether they forward `cache_control` headers. If not (or if uncertain), disable caching in Claude Code as above. If OpusMax does support caching, verify that their TTL matches Anthropic's expected 1-hour window (not the 5-minute regression).

---

## Layer 4: Tool Access & Web Capabilities

### Findings

**F12. The official claude.ai UI has dedicated web search and deep research tools that Claude Code does not have by default.**
The official UI explicitly includes "Web search" and "Deep research" as toggleable capabilities in its system prompt. These tools give Claude real-time access to current information. Claude Code does not have a built-in web search tool — it would need an MCP server (e.g., Brave Search, Perplexity) configured separately. This is a fundamental capability gap that cannot be bridged by `settings.json` alone.
*Source: [System Prompts - Claude API Docs](https://platform.claude.com/docs/en/release-notes/system-prompts), [Web search tool - Claude API Docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool)*

**F13. Claude Code can use MCP servers to add web search, but this requires manual configuration not present in the official UI.**
Claude Code supports MCP (Model Context Protocol) servers for extended capabilities. MCP servers for web search (Brave Search, Perplexity Sonar, Firecrawl) can be configured in Claude Code, but this is opt-in and requires setup. The official UI has web search built-in with no configuration needed. This represents an out-of-the-box capability gap.
*Source: [The 10 Must-Have MCP Servers for Claude Code (2025 Developer Edition)](https://roobia.medium.com/the-10-must-have-mcp-servers-for-claude-code-2025-developer-edition-43dc3c15c887), [Integrating MCP Servers for Web Search with Claude Code](https://intuitionlabs.ai/articles/mcp-servers-claude-code-internet-search)*

**F14. Claude Code has code execution and file creation tools that the official UI does not have.**
Claude Code's harness explicitly includes file system tools (Read, Write, Edit, Glob, Grep), Bash execution, and git integration. The official UI has no equivalent — it cannot write files or execute code. This is a key reason Claude Code exists as a separate product. However, this also means Claude Code is primed for a coding workflow that may make it less suitable for general reasoning tasks where the official UI excels.
*Source: [Claude's System Prompt explained - Medium](https://medium.com/data-science-in-your-pocket/claudes-system-prompt-explained-d9b7989c38a3)*

**F15. The official UI has an "Artifacts" feature for code and document generation that Claude Code handles differently.**
The official UI's Artifacts feature creates shareable, live-updating code and document outputs. Claude Code produces files in the local filesystem instead. The system prompt framing differs, which may affect how the model structures and presents its output.
*Source: [System Prompts - Claude API Docs](https://platform.claude.com/docs/en/release-notes/system-prompts)*

### Recommended Settings Changes

```json
{
  "mcpServers": {
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "YOUR_BRAVE_API_KEY"
      }
    }
  }
}
```

**Rationale:** Adding a Brave Search MCP server brings web search capability to Claude Code, partially closing the gap with the official UI. This requires obtaining a Brave Search API key (free tier available). Note: This is an OpusMax proxy recommendation — the user should verify with OpusMax that MCP server traffic is supported through their proxy.

---

## Layer 5: Context Management

### Findings

**F16. The Claude Code VS Code extension auto-compacts context at ~35% remaining, while the CLI compacts at ~1-5% remaining — the extension loses information much more aggressively.**
This is a documented, intentional difference between the VS Code extension and CLI. The extension reserves more buffer space for the compaction process itself (~20%), triggering compaction earlier. Long conversations in the VS Code extension lose more context than equivalent conversations in the CLI, and far more than the official UI which handles context differently at the server level.
*Source: [GitHub: Configurable Auto-Compact Threshold in VS Code Extension](https://github.com/anthropics/claude-code/issues/11819), [How Claude Code Got Better by Protecting More Context](https://hyperdev.matsuota.com/p/how-claude-code-got-better-by-protecting), [Reddit: Claude Code context shows 0% auto-compact triggers even when ~10-20% usage](https://www.reddit.com/r/ClaudeCode/comments/1qxfe5t/claude_code_context_shows_0_autocompact_triggers/)*

**F17. Claude Code has an auto-memory feature (MEMORY.md) that the official UI does not use.**
Claude Code accumulates memory across sessions via auto-generated MEMORY.md files in the project directory. This is an opt-in feature (on by default since v2.1.59) that stores learned preferences and project patterns. The official UI has a different memory system based on user-managed memories. The auto-memory feature in Claude Code is specific to the coding harness and has no direct equivalent in the official UI.
*Source: [Claude Code Memory - Official Docs](https://code.claude.com/docs/en/memory), [GitHub: Need ability to disable auto-memory #23544](https://github.com/anthropics/claude-code/issues/23544), [Reddit: Claude Code auto-memory works (200-line limit per project)](https://www.reddit.com/r/ClaudeCode/comments/1qzmofn/how_claude_code_automemory_works_official_feature/)*

**F18. The official UI handles long conversations through server-side context management that Claude Code cannot replicate.**
The official UI manages context at Anthropic's server level with unknown compaction and summarization strategies. Claude Code's context management is client-side — it decides when to compact based on the token count reaching thresholds in the local context window. The official UI's approach is opaque but presumably more sophisticated, as it does not require visible compaction UI.
*Source: [Automatic context compaction | Claude Cookbook](https://platform.claude.com/cookbook/tool-use-automatic-context-compaction), [Context engineering: memory, compaction, and tool clearing](https://platform.claude.com/cookbook/tool-use-context-engineering-context-engineering-tools)*

### Recommended Settings Changes

```json
{
  "autoCompactEnabled": true,
  "autoMemoryEnabled": true,
  "compactThresholdPct": 60
}
```

**Note:** The `compactThresholdPct` setting may not be available in `settings.json` (GitHub issue #10691 requested it, GitHub issue #12995 confirms there's no way to set the autoCompactEnabled flag in the extension). Verify availability with `code.claude.com/docs/en/settings`.

For auto-memory, if unwanted memory accumulation is causing issues:

```json
{
  "env": {
    "CLAUDE_CODE_DISABLE_AUTO_MEMORY": "1"
  }
}
```

**Rationale:** Disabling auto-memory (`CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`) prevents Claude Code from generating MEMORY.md files that could interfere with project state. If auto-memory is causing stale or incorrect learned behaviors to persist across sessions, this clean slate approach may improve output quality. The auto-compact threshold cannot be reliably controlled in the VS Code extension as of the current version.

---

## Layer 6: UX & Behavioral Differences

### Findings

**F19. Claude Code's VS Code extension has a triple-bug in thinking mode that silently prevents extended thinking from engaging even when `alwaysThinkingEnabled: true` is set.**
As of April 10, 2026, this is a confirmed active bug (Reddit: "Claude Code's 'max effort' thinking has been silently broken since..."). Three stacked bugs cause extended thinking to fail silently: (1) a regression in the thinking toggle logic, (2) incorrect handling of the `alwaysThinkingEnabled` flag in certain session states, and (3) a UI-level bug that shows thinking as disabled even when the underlying API call includes thinking parameters. This means the user may have `alwaysThinkingEnabled: true` in their settings but the thinking mode is not actually engaged.
*Source: [Reddit: Claude Code's "max effort" thinking has been silently broken since...](https://www.reddit.com/r/ClaudeCode/comments/1shjfxb/claude_codes_max_effort_thinking_has_been/), [Reddit: Did Claude remove extended thinking from VSCode extension?](https://www.reddit.com/r/ClaudeAI/comments/1pv3a7g/did_claude_remove_extended_thinking_from_vscode/)*

**F20. Claude Code's `showThinkingSummaries: false` setting may suppress useful thinking output that the official UI displays differently.**
The official UI can display thinking summaries to help users understand the model's reasoning. Claude Code has a `showThinkingSummaries` setting that controls this. With `showThinkingSummaries: false`, the thinking process is hidden entirely. This means users cannot verify whether thinking is actually happening — combined with the triple-bug in F19, this creates a situation where thinking may be silently disabled with no visible indicator.
*Source: [Claude Code settings.json docs](https://code.claude.com/docs/en/settings), [GitHub: Add Option to Always Show Claude's Thinking #8477](https://github.com/anthropics/claude-code/issues/8477)*

**F21. Claude Code uses an effort-level system (low/medium/high/max) that the official UI abstracts away.**
Claude Code exposes effort levels that control how much reasoning the model applies. The official UI does not expose this control — it handles effort internally. Setting `effort: "max"` in Claude Code forces maximum reasoning, but this is not the default (default is "medium" since February 2026 per F5). The official UI always applies appropriate effort for the task without requiring user configuration.
*Source: [Claude Code Effort Levels Explained](https://www.mindstudio.ai/blog/claude-code-effort-levels-explained/), [Adaptive thinking - Claude API Docs](https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking), [Reddit: How to set max thinking/reasoning effort by default](https://www.reddit.com/r/ClaudeAI/comments/1rv0m1x/how_to_set_max_thinkingreasoning_effort_by/)*

**F22. The official UI streaming display shows thinking content differently from Claude Code's terminal/extension output.**
The official UI shows thinking in a collapsible, annotated format. Claude Code's thinking display is text-based in the extension panel or terminal. The quality of thinking visible to the user affects perceived quality — more transparent thinking display helps users evaluate whether the model is reasoning correctly before it produces final output.
*Source: [Claude Opus 4.7 Review: What It Really Means for Your Work](https://karozieminski.substack.com/p/claude-opus-4-7-review-tutorial-builders), [Hacker News: Boris from Claude Code team on thinking display](https://news.ycombinator.com/item?id=47664442)*

**F23. VS Code extension and CLI have behavioral differences — the extension summarizes context windows more aggressively than the CLI.**
User reports confirm that the VS Code extension applies more aggressive context summarization than the CLI. This means the same conversation will degrade faster in quality in the extension than in the CLI. Users who want the best reasoning quality may prefer the CLI over the extension.
*Source: [Reddit: Claude code in VS Code or CLI?](https://www.facebook.com/groups/vibecodinglife/posts/1981873495734511/), [GitHub: Clarify UX differences between Terminal CLI and VS Code Extension](https://github.com/anthropics/claude-code/issues/13528)*

### Recommended Settings Changes

```json
{
  "alwaysThinkingEnabled": true,
  "showThinkingSummaries": true,
  "effort": "max",
  "disableAdaptiveThinking": true
}
```

**Rationale:** Setting `showThinkingSummaries: true` is critical given the triple-bug in thinking mode — it allows the user to verify whether thinking is actually engaging. If thinking summaries appear, the underlying thinking mode is working. If they do not appear, the triple-bug is confirmed active. `effort: "max"` with `disableAdaptiveThinking: true` forces maximum reasoning on every turn, compensating for the February 2026 default regression.

---

## Layer 7: Real User Reports (Forum Research)

### Findings

**F24. Multiple users report that Claude Code produces lower quality code/output than the official UI.**
The most frequently cited behavioral differences are: (a) VS Code extension context summarization being more aggressive than CLI (causing degradation in long sessions), (b) thinking mode being unreliable or absent in the extension, and (c) the official UI providing more thorough, thoughtful responses for reasoning tasks.
*Source: [Reddit: Difference in quality of code between VS Code extension and CLI](https://www.reddit.com/r/ClaudeCode/comments/1q2bhq9/difference_in_the_quality_of_the_code_provided/), [Reddit: Claude Code CLI vs VS Code extension: am I missing something](https://www.reddit.com/r/ClaudeAI/comments/1pooqgp/claude_code_cli_vs_vs_code_extension_am_i_missing/)*

**F25. Claude Opus 4.6 received significant complaints about quality regression, with workarounds identified involving disabling adaptive thinking.**
Multiple users reported that Opus 4.6 in Claude Code produced noticeably worse output. The identified workaround was: disable adaptive thinking, set a thinking token budget, and set effort to "max." This workaround pattern directly mirrors the findings from F5, F19, and F21.
*Source: [Reddit: Claude Code Opus 4.6 Massive Quality Drop](https://www.reddit.com/r/ClaudeCode/comments/1sg2kkc/claude_code_opus_46_massive_quality_drop_almost/), [Reddit: Disable adaptive thinking, set thinking token budget, set effort to max](https://www.reddit.com/r/claudexplorers/comments/1sho9qf/pretty_sure_i_fixed_claudes_reasoning_can_other/)*

**F26. Claude Code thinking mode has been reported as broken in the VS Code extension multiple times since September 2025.**
Multiple Reddit posts from September 2025 through April 2026 report that thinking mode is absent, broken, or toggled off in the VS Code extension. The "Tab to toggle thinking" shortcut works in the CLI but not in the extension. This is a persistent, long-running issue, not a single regression.
*Source: [Reddit: Claude Code 2.0: Where is Thinking Mode in VS Code extension?](https://www.reddit.com/r/ClaudeAI/comments/1nujwok/claude_code_20_where_is_thinking_mode_in_vs_code/), [Reddit: How to enable thinking in Claude Code for VS Code?](https://www.reddit.com/r/ClaudeAI/comments/1ntr8n9/how_to_enable_thinking_in_claude_code_for_vs_code/), [Reddit: Second day of Claude Code and it just does not stop "thinking"](https://www.reddit.com/r/claude/comments/1s0r9e3/second_day_of_claude_code_and_it_just_does_not_stop_thinking/)*

**F27. Users report that the CLI is better than the VS Code extension for context window management.**
A confirmed UX difference: "CLI is better. VS Code and Cursor actually summarize your context windows and while it happens in Claude Code/CLI it's not as bad or as extreme." This is consistent with the F16 finding about the extension's more aggressive auto-compaction threshold.
*Source: [Facebook Group: Claude code in VS Code or CLI?](https://www.facebook.com/groups/vibecodinglife/posts/1981873495734511/)*

**F28. Claude Code's auto-memory feature creates MEMORY.md files that some users want disabled, causing confusion.**
Multiple GitHub issues confirm that users cannot easily disable auto-memory while keeping CLAUDE.md project instructions active. The current workaround requires setting `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` as an environment variable. This feature can cause stale preferences to persist and affect output quality in unexpected ways.
*Source: [GitHub: Need ability to disable auto-memory #23544](https://github.com/anthropics/claude-code/issues/23544), [GitHub: Option to disable auto-memory #23750](https://github.com/anthropics/claude-code/issues/23750)*

**F29. The `alwaysThinkingEnabled` setting was added to Claude Code around October 2025 and has been unreliable since.**
Users reported discovering that `alwaysThinkingEnabled: false` was their default state as recently as January 2026, with Claude Code silently adding or changing this setting. The setting's existence is not universally known, and its interaction with other thinking-related settings (adaptive thinking, effort level) is complex and not clearly documented.
*Source: [Reddit: New Thinking Setting in ~/.claude/settings.json](https://www.reddit.com/r/ClaudeAI/comments/1nxbf3v/new_thinking_setting_in_claudesettingsjson/), [Reddit: I think I've figured out why Opus on Claude Code has been running worse](https://www.reddit.com/r/ClaudeAI/comments/1qb5gr0/i_think_ive_figured_out_why_opus_on_claude_code/)*

---

## Prioritized Fix List

Ranked by expected impact on the reasoning/execution quality gap, from highest to lowest:

### Priority 1: Fix the Thinking Mode Triple-Bug (Highest Impact)

The triple-bug in thinking mode (F19) means extended thinking is likely silently disabled even with `alwaysThinkingEnabled: true`. This is the single largest contributor to perceived quality degradation.

```json
{
  "alwaysThinkingEnabled": true,
  "showThinkingSummaries": true,
  "effort": "max",
  "disableAdaptiveThinking": true
}
```

**Verification:** After applying, start a new conversation and ask a complex reasoning question. Look for thinking output (collapsible thinking block). If no thinking appears within 10-15 seconds, the bug is active. Workaround: close the VS Code tab and open a new one, as the bug is session-state-dependent.

### Priority 2: Use Explicit Model ID and Disable Adaptive Thinking (High Impact)

```json
{
  "model": "claude-opus-4-7",
  "alwaysThinkingEnabled": true,
  "showThinkingSummaries": true,
  "effort": "max",
  "disableAdaptiveThinking": true
}
```

**Rationale:** Using `claude-opus-4-7` (the canonical ID) instead of the alias "opus" removes model ID ambiguity in OpusMax routing. `disableAdaptiveThinking: true` forces every response to use maximum reasoning, compensating for the February 2026 default regression. `showThinkingSummaries: true` lets you verify thinking is actually active.

### Priority 3: Disable Broken Prompt Caching (Medium-High Impact)

```json
{
  "cacheEnabled": false
}
```

**Rationale:** Eliminates the two documented cache bugs causing 10-20x token inflation. While this increases token costs, it ensures predictable behavior and removes a source of silent quality degradation from incorrect cache hits/misses. May improve consistency of reasoning across conversation turns.

### Priority 4: Disable Auto-Memory for Clean Slate (Medium Impact)

In `~/.claude/settings.json`:
```json
{
  "alwaysThinkingEnabled": true,
  "showThinkingSummaries": true,
  "model": "claude-opus-4-7",
  "effort": "max",
  "disableAdaptiveThinking": true,
  "cacheEnabled": false
}
```

Additionally, set in shell profile (`~/.zshrc`, `~/.bashrc`):
```bash
export CLAUDE_CODE_DISABLE_AUTO_MEMORY=1
```

**Rationale:** Prevents stale learned preferences from MEMORY.md files from affecting output quality. Provides a clean slate for each session.

### Priority 5: Add Web Search via MCP Server (Medium Impact — Requires OpusMax Verification)

```json
{
  "mcpServers": {
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "YOUR_BRAVE_API_KEY"
      }
    }
  }
}
```

**Requires:** Brave Search API key (free tier at `brave.com/search/api`). Verify with OpusMax that MCP server traffic is forwarded correctly before relying on this.

### Priority 6: Consider CLI Over VS Code Extension (Medium Impact — Behavioral)

If quality remains unsatisfactory after Priority 1-5, use the Claude Code CLI (`claude` command in terminal) rather than the VS Code extension. The CLI has:
- More aggressive context retention (compacts at 1-5% remaining vs extension's 35%)
- Fewer UI-layer bugs
- More consistent thinking mode behavior

This is not a settings change but a workflow change with significant quality implications.

### Priority 7: OpusMax Proxy Verification (Low-Medium Impact)

Contact OpusMax support or review their documentation to verify:
1. What model ID they map "opus" / "claude-opus-4-7" to
2. Whether they forward `cache_control` headers for prompt caching
3. Whether they support MCP server traffic
4. What their actual TTL is for prompt cache (expecting 5-minute regression, Anthropic nominal is 1 hour)

---

## Can't Fix (Architectural Limitations)

The following gaps **cannot be addressed** through `~/.claude/settings.json` configuration changes or OpusMax proxy settings:

### 1. Harness System Prompt Difference (Cannot Fix)

Claude Code always sends a coding-specialized harness system prompt alongside any custom instructions. This primes the model for file operations, command execution, and diff generation rather than open-ended reasoning. The official UI uses a general-purpose system prompt with different tone, formatting, and behavioral guidelines. No `settings.json` key can replace the harness system prompt. This is fundamental to Claude Code's architecture as a coding agent.

**Workaround:** Write detailed project-specific instructions in `CLAUDE.md` to partially shape the model's framing. The quality of `CLAUDE.md` directly affects Claude Code's output quality in ways that the official UI's general system prompt handles automatically.

### 2. Official UI Web Search and Deep Research (Cannot Fix)

The official UI has built-in web search and deep research tools with no configuration required. Claude Code needs an MCP server for equivalent functionality. Even with a configured Brave Search MCP server, the integration depth, UI presentation, and tool selection logic differ from the official UI's native web search. The official UI's deep research mode is particularly difficult to replicate.

**Workaround:** Configure an MCP server for web search (Priority 5 above). Accept that deep research mode has no equivalent.

### 3. Server-Side Context Management (Cannot Fix)

The official UI manages long conversations at Anthropic's server level using opaque, presumably sophisticated strategies. Claude Code's context management is client-side, token-count-based, and visible to the user (compaction messages). The official UI does not show compaction UI and handles context more gracefully. Claude Code's 35% auto-compaction threshold in the VS Code extension cannot be lowered reliably.

**Workaround:** Use the Claude Code CLI instead of the VS Code extension (compacts at 1-5% remaining). Keep conversations shorter. Use `/compact` manually before hitting auto-compaction. Save important outputs to files rather than relying on conversation continuity.

### 4. OpusMax Proxy Opacity (Cannot Fix)

Using OpusMax as an intermediary means: (a) model ID routing is controlled by OpusMax, not the user; (b) prompt caching behavior depends on OpusMax's implementation; (c) MCP server traffic routing depends on OpusMax configuration; (d) the actual model version being called may differ from what the user expects. The user cannot inspect or audit OpusMax's routing decisions.

**Workaround:** Use the official Anthropic API (`api.anthropic.com`) directly for the highest fidelity. If OpusMax is required for cost or access reasons, treat it as a best-effort approximation and verify model/version with OpusMax support.

### 5. Thinking Mode Triple-Bug (Cannot Fix via Settings — Active Bug)

While `showThinkingSummaries: true` allows verification that thinking is active, the underlying triple-bug cannot be fixed through `settings.json`. It requires a Claude Code update from Anthropic. The bug is session-state-dependent (closing and reopening the tab may resolve it temporarily). This is the most actionable "can't fix" — monitor Anthropic's release notes for fixes to the thinking mode bugs.

**Current state (as of 2026-04-20):** Bug confirmed active. No settings-level workaround fully resolves it. Claude Code v2.1.59+ has the auto-memory feature; the thinking mode bugs persist across versions.

---

## Appendix: Citations

### Official Documentation
- [System Prompts - Claude API Docs](https://platform.claude.com/docs/en/release-notes/system-prompts)
- [Building with extended thinking - Claude API Docs](https://platform.claude.com/docs/en/build-with-claude/extended-thinking)
- [Adaptive thinking - Claude API Docs](https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking)
- [Prompt caching - Claude API Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- [Web search tool - Claude API Docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool)
- [Automatic context compaction | Claude Cookbook](https://platform.claude.com/cookbook/tool-use-automatic-context-compaction)
- [Context engineering: memory, compaction, and tool clearing](https://platform.claude.com/cookbook/tool-use-context-engineering-context-engineering-tools)
- [Claude Code settings - Claude Code Docs](https://code.claude.com/docs/en/settings)
- [How Claude remembers your project - Claude Code Docs](https://code.claude.com/docs/en/memory)
- [Models overview - Claude API Docs](https://platform.claude.com/docs/en/about-claude/models/overview)
- [Migration guide - Claude API Docs](https://platform.claude.com/docs/en/about-claude/models/migration-guide)
- [Introducing Claude Opus 4.6 - Anthropic](https://www.anthropic.com/news/claude-opus-4-6)
- [Claude's extended thinking - Anthropic](https://www.anthropic.com/news/visible-extended-thinking)
- [Claude Opus 4.7 - Anthropic](https://www.anthropic.com/news/claude-opus-4-7)

### Forum & Community Discussions
- [Reddit r/ClaudeCode: Claude Code's "max effort" thinking has been silently broken](https://www.reddit.com/r/ClaudeCode/comments/1shjfxb/claude_codes_max_effort_thinking_has_been/)
- [Reddit r/ClaudeAI: Performance difference between using API and web interface](https://www.reddit.com/r/ClaudeAI/comments/1fqdpsa/performance_difference_between_using_api_and_web/)
- [Reddit r/ClaudeCode: Difference in quality of code between VS Code extension and CLI](https://www.reddit.com/r/ClaudeCode/comments/1q2bhq9/difference_in_the_quality_of_the_code_provided/)
- [Reddit r/ClaudeAI: Claude Code Opus 4.6 Massive Quality Drop](https://www.reddit.com/r/ClaudeCode/comments/1sg2kkc/claude_code_opus_46_massive_quality_drop_almost/)
- [Reddit r/ClaudeAI: Claude Code CLI vs VS Code extension am I missing something](https://www.reddit.com/r/ClaudeAI/comments/1pooqgp/claude_code_cli_vs_vs_code_extension_am_i_missing/)
- [Reddit r/ClaudeAI: How to set max thinking/reasoning effort by default](https://www.reddit.com/r/ClaudeAI/comments/1rv0m1x/how_to_set_max_thinkingreasoning_effort_by/)
- [Reddit r/ClaudeAI: New Thinking Setting in ~/.claude/settings.json](https://www.reddit.com/r/ClaudeAI/comments/1nxbf3v/new_thinking_setting_in_claudesettingsjson/)
- [Reddit r/ClaudeAI: Did Claude remove extended thinking from VSCode extension?](https://www.reddit.com/r/ClaudeAI/comments/1pv3a7g/did_claude_remove_extended_thinking_from_vscode/)
- [Reddit r/ClaudeAI: Claude Code 2.0 Where is Thinking Mode in VS Code extension?](https://www.reddit.com/r/ClaudeAI/comments/1nujwok/claude_code_20_where_is_thinking_mode_in_vs_code/)
- [Reddit r/ClaudeAI: How to enable thinking in Claude Code for VS Code?](https://www.reddit.com/r/ClaudeAI/comments/1ntr8n9/how_to_enable_thinking_in_claude_code_for_vs_code/)
- [Reddit r/ClaudeCode: Claude Code context shows 0% auto-compact triggers](https://www.reddit.com/r/ClaudeCode/comments/1qxfe5t/claude_code_context_shows_0_autocompact_triggers/)
- [Reddit r/ClaudeAI: Stop Burning Money on Wrong Claude Model (Opus-to-Sonnet fallback)](https://www.reddit.com/r/ClaudeAI/comments/1riyfrj/stop_burning_money_on_the_wrong_claude_model/)
- [Reddit r/ClaudeCode: How Claude Code auto-memory works (200-line limit)](https://www.reddit.com/r/ClaudeCode/comments/1qzmofn/how_claude_code_automemory_works_official_feature/)
- [Reddit r/claudeexplorers: Disable adaptive thinking, set effort to max (reasoning fix)](https://www.reddit.com/r/claudexplorers/comments/1sho9qf/pretty_sure_i_fixed_claudes_reasoning_can_other/)
- [Reddit r/ClaudeAI: PSA Claude Code has two cache bugs 10-20x token inflation](https://www.reddit.com/r/ClaudeAI/comments/1s7mkn3/psa_claude_code_has_two_cache_bugs_that_can/)
- [Reddit r/ClaudeAI: Claude Code auto-memory is so good](https://www.reddit.com/r/ClaudeAI/comments/1r6j36u/claude_codes_auto_memory_is_so_good_make_sure_you/)
- [Reddit r/claude: Second day of Claude Code and it just does not stop "thinking"](https://www.reddit.com/r/claude/comments/1s0r9e3/second_day_of_claude_code_and_it_just_does_not_stop_thinking/)
- [Reddit r/ClaudeAI: I think I've figured out why Opus on Claude Code has been running worse](https://www.reddit.com/r/ClaudeAI/comments/1qb5gr0/i_think_ive_figured_out_why_opus_on_claude_code/)
- [Reddit r/ClaudeAI: Claude Code VS Code extension vs CLI quality comparison](https://www.reddit.com/r/ClaudeAI/comments/1pooqgp/claude_code_cli_vs_vs_code_extension_am_i_missing/)
- [Reddit r/ClaudeCode: Stop disabling features to "fix" Claude Code (adaptive thinking)](https://www.reddit.com/r/ClaudeAI/comments/1sln806/stop_disabling_features_to_fix_claude_code_heres/)
- [Hacker News: Comparing Claude System Prompts Reveal Anthropic's Priorities](https://news.ycombinator.com/item?id=44185836)
- [Hacker News: Boris from Claude Code team on thinking display beta header](https://news.ycombinator.com/item?id=47664442)
- [Hacker News: MCP server reduces Claude Code context consumption by 98%](https://news.ycombinator.com/item?id=47193064)
- [Facebook Group: Claude code in VS Code or CLI?](https://www.facebook.com/groups/vibecodinglife/posts/1981873495734511/)

### GitHub Issues
- [GitHub: Cache TTL silently regressed from 1h to 5m #46829](https://github.com/anthropics/claude-code/issues/46829)
- [GitHub: Configurable Auto-Compact Threshold in VS Code Extension #11819](https://github.com/anthropics/claude-code/issues/11819)
- [GitHub: Add Option to Always Show Claude's Thinking #8477](https://github.com/anthropics/claude-code/issues/8477)
- [GitHub: Need ability to disable auto-memory #23544](https://github.com/anthropics/claude-code/issues/23544)
- [GitHub: Option to disable auto-memory #23750](https://github.com/anthropics/claude-code/issues/23750)
- [GitHub: BUG: No way to set autoCompactEnabled flag when using VS Code #12995](https://github.com/anthropics/claude-code/issues/12995)
- [GitHub: Add claudeCode.autoCompact settings to control compaction #10691](https://github.com/anthropics/claude-code/issues/10691)
- [GitHub: Clarify UX differences between Terminal CLI and VS Code Extension #13528](https://github.com/anthropics/claude-code/issues/13528)
- [GitHub: Diff review UI similar to GitHub #33932](https://github.com/anthropics/claude-code/issues/33932)

### Articles & Blog Posts
- [Claude Code VS Code Extension: A Complete Guide 2025 | eesel AI](https://www.eesel.ai/blog/claude-code-vs-code-extension)
- [Comparing Claude System Prompts Reveal Anthropic's Priorities - Theoreti.ca](https://theoreti.ca/?p=8542)
- [What we can learn from Anthropic's System prompt updates - PromptLayer](https://blog.promptlayer.com/what-we-can-learn-from-anthropics-system-prompt-updates/)
- [Claude's System Prompt explained - Medium](https://medium.com/data-science-in-your-pocket/claudes-system-prompt-explained-d9b7989c38a3)
- [A Complete Guide to the Anthropic API vs Claude Web Interface - Lamatic](https://labs.lamatic.ai/p/anthropic-api-vs-claude/)
- [Claude Code's "max effort" thinking has been silently broken - pasqualepillitteri.it](https://pasqualepillitteri.it/en/news/805/claude-code-effort-adaptive-thinking-guida)
- [Claude Code Getting Worse? Two Settings 90% of Users Don't Know About](https://pasqualepillitteri.it/en/news/805/claude-code-effort-adaptive-thinking-guida)
- [How Claude Code Got Better by Protecting More Context - Hyperdev](https://hyperdev.matsuota.com/p/how-claude-code-got-better-by-protecting)
- [Claude Code Token Optimization: Full System Guide - Build to Launch](https://buildtolaunch.substack.com/p/claude-code-token-optimization)
- [Claude Code Is Eating Your Budget: 7 Fixes - Medium](https://medium.com/@0xmega/claude-code-is-eating-your-budget-7-fixes-that-cut-costs-without-killing-output-f8dbb3b8a04d)
- [Claude Code Effort Levels Explained - MindStudio](https://www.mindstudio.ai/blog/claude-code-effort-levels-explained/)
- [What Is Claude Code Auto-Memory? - MindStudio](https://www.mindstudio.ai/blog/what-is-claude-code-auto-memory/)
- [Claude Adaptive Thinking Explained - All Things](https://allthings.how/claude-adaptive-thinking-explained-how-it-works-and-when-to-use-it/)
- [Claude Opus 4.7 Review: What It Really Means for Your Work](https://karozieminski.substack.com/p/claude-opus-4-7-review-tutorial-builders)
- [Claude Code Models: Choose the Right AI for Every Task - Claude Fast](https://claudefa.st/blog/models/model-selection)
- [Claude Code 2.0: Where Claude Code VS Code Extension Changes Everything - YouTube](https://www.youtube.com/watch?v=EZZ7VTAzSFI)
- [Claude Code: CLI vs VS Code Extension - Which One is right for you - YouTube](https://www.youtube.com/watch?v=A40MYdplD3g)
- [The 10 Must-Have MCP Servers for Claude Code 2025 Developer Edition](https://roobia.medium.com/the-10-must-have-mcp-servers-for-claude-code-2025-developer-edition-43dc3c15c887)
- [Integrating MCP Servers for Web Search with Claude Code - Intuition Labs](https://intuitionlabs.ai/articles/mcp-servers-claude-code-internet-search)
- [Claude Code in the Enterprise — Model Mapping for LLM Proxies - Medium](https://medium.com/@trevor00/claude-code-in-the-enterprise-model-mapping-for-llm-proxies-b0d8069c6aa3)
- [Claude Code 1M Context + Max Effort: The Complete Guide - YouTube](https://www.youtube.com/watch?v=_LrQ6GWdRSQ)
- [Claude Opus 4.7 vs 4.6: Every Difference That Actually Matters - Miraflow](https://miraflow.ai/blog/claude-opus-4-7-vs-4-6-every-difference-that-matters)
- [Claude Opus 4.7 vs Opus 4.6: Agentic Coding Comparison - Verdent AI](https://www.verdent.ai/guides/claude-opus-4-7-vs-4-6-coding-agents)
- [Claude Code vs VS Code Extension: 2026 Comparison - Get AI Perks](https://www.getaiperks.com/en/articles/claude-code-vs-code-extension)
- [Comprehensive Guide to Claude Code Extension vs CLI - Skywork](https://skywork.ai/skypage/en/claude-code-extension-vs-cli/2044695173421268992)

---

*Document generated: 2026-04-20. All findings are based on publicly available sources including official Anthropic documentation, GitHub issue trackers, Reddit discussions, Hacker News threads, and community blog posts. System prompt contents are inferred from public reverse-engineering and official documentation disclosures.*
