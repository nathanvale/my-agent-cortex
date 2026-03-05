---
title: "feat: Add beat-reporter agent to cortex-engineering plugin"
type: feat
status: completed
date: 2026-03-04
---

# Add beat-reporter agent to cortex-engineering plugin

## Overview

Add a general-purpose `beat-reporter` agent to the cortex-engineering plugin -- a CLI-powered community intelligence agent modeled on the 1920s/30s beat reporter archetype. Streetwise, cynical, sharp-witted, and addicted to the next story. Uses the `@side-quest/word-on-the-street` CLI to gather engagement-ranked Reddit, X, and YouTube data, then chases leads across the web.

The agent is reusable across any workflow that needs "what's the community saying about X?" -- research, plan reviews, code reviews, or adversarial arena debates. The arena skill adds a bias layer at dispatch time; the reporter's core personality and workflow stay the same.

## Problem Statement / Motivation

The arena skill currently declares a hard dependency on `newsroom:beat-reporter` from a separate repository (`side-quest-plugins`). This creates three problems:

1. **Broken dependency chain** -- the newsroom plugin is not registered in this marketplace, so the arena skill always fails its prerequisite check
2. **Cross-repo fragility** -- the arena skill cannot function without a plugin from another repository being loaded
3. **Narrow reuse** -- the newsroom beat-reporter is tightly coupled to the desk skill's JSON assignment protocol. Other cortex-engineering workflows (research, plan reviews, code reviews) could benefit from community intel but can't easily dispatch the newsroom version

The `@side-quest/word-on-the-street` CLI is the core engine -- it returns structured, engagement-ranked data with real upvotes, likes, and comments that WebSearch alone cannot provide. The CLI dependency stays.

## Proposed Solution

### Architecture: two concerns, cleanly separated

```
Any Cortex Skill (arena, research, plan review, code review)
  |
  └─ Dispatch beat-reporter(s) via Agent tool
        |
        └─ Beat Reporter (1920s archetype -- streetwise, cynical, sharp)
              |
              └─ CLI (@side-quest/word-on-the-street) → Reddit, X, YouTube, Web
                    → structured report with engagement metrics
                    → voice openers/sign-offs, factual data sections

Arena Skill (specific orchestration)
  |
  ├─ Adds bias framing to beat-reporter dispatch prompt (per-team advocacy)
  ├─ Dispatches N biased reporters in parallel
  ├─ Receives intel filtered through bias lens
  └─ Judge synthesizes verdict from biased reports
```

**beat-reporter** = general-purpose community intel agent (CLI-powered, 1920s personality, reusable)
**Arena bias layer** = prompt-level framing added by the arena skill at dispatch time (not a separate agent)

The beat-reporter files structured reports with personality -- voice openers, lean data, punchy sign-offs. When the arena skill dispatches it, the arena adds bias instructions to the prompt -- "You are reporting for Team A, find the strongest evidence for their position." The reporter's core workflow doesn't change; the framing shifts what it emphasizes. The arena skill's judge then synthesizes across biased reports.

### Reference implementation

The newsroom beat-reporter at `/Users/nathanvale/code/side-quest-plugins/plugins/newsroom/agents/beat-reporter.md` is the direct reference. Key adaptations for cortex-engineering:

| Newsroom beat-reporter | Cortex beat-reporter |
|------------------------|---------------------|
| Structured JSON assignment from desk skill | Flexible prompt-based assignment (topic string + optional context) |
| Tightly coupled to desk's `query_type`, `cli_flags`, `web_queries` schema | Derives search strategy from the topic and any caller-provided hints |
| Newsroom voice tied to desk protocol | 1920s beat reporter personality -- cynical, streetwise, lean prose |
| `skills: [web-scraping]` for WebFetch fallback | Inline WebFetch failure guidance (self-contained) |
| 4-phase workflow (CLI, Web, Extract, File) | Same 4-phase workflow preserved |
| Desk-specific telemetry fields | Simplified telemetry (cli_status, web_pages, source_gaps, duration) |

### Agent frontmatter

```yaml
---
name: beat-reporter
description: Community intelligence agent that uses the @side-quest/word-on-the-street CLI to gather engagement-ranked Reddit, X, and YouTube results for a topic, then runs supplementary web research. Use when you need real community sentiment with upvotes, likes, and comments. Use proactively when dispatching research tasks, reviewing plans, or gathering community intel.
model: sonnet
tools: Bash, WebSearch, WebFetch
maxTurns: 20
---
```

Field rationale:
- **`tools`** -- explicit allowlist. Bash for CLI invocation, WebSearch + WebFetch for supplementary research. Sub-agents inherit parent tools by default, but declaring them explicitly guarantees access regardless of dispatch context.
- **`maxTurns: 20`** -- hard ceiling to prevent runaway execution. Complements the 90-second wall-clock self-check. A typical run is ~8-12 turns (CLI call, 3-5 WebFetch calls, report filing).
- **`model: sonnet`** -- fast enough for parallel dispatch, capable enough for research synthesis.
- **No `background: true`** -- callers decide foreground vs background at dispatch time. Arena dispatches in background; research skill may want foreground.

### Agent body structure

The agent `.md` body becomes its system prompt when spawned via the Agent tool. Adapted from the newsroom beat-reporter's 171-line body:

1. **Identity and personality** -- The 1920s beat reporter archetype. Cynical but addicted to the work. Streetwise, not academic. Fast-talking, sharp-witted, no wasted words. Runs on adrenaline and the next story. Sees through people quickly. Has a gut-level sense that getting the story into print matters, even if they'd never admit it at the bar.

   > "You are a Beat Reporter. You work the community beat -- Reddit, X, YouTube, forums -- and chase leads across the web. You're someone who runs on deadline pressure and the next story. You're emotionally guarded, quick with a joke, slow to trust, and deeply skeptical of authority. You write the way you talk: lean, punchy, no wasted words."

2. **Phase 1: Hit the CLI** -- `bunx --bun @side-quest/word-on-the-street "<topic>" --json --quiet --include-web --include-youtube --outdir=<path>`. Parse JSON envelope with `data.reddit`, `data.x`, `data.youtube`, `data.web_search_instructions`.
3. **Phase 2: Web Research** -- Use `data.web_search_instructions` from CLI envelope to guide WebSearch + WebFetch. Honor CLI constraints (date range, excluded domains). Budget: 3-5 WebFetch calls max.
4. **Phase 3: Extract Source Links** -- Structured passthrough from CLI JSON: titles, URLs, engagement metrics per platform.
5. **Phase 4: File Report** -- Voice opener, then clean data sections (CLI Data, Web Findings, Source Links, Telemetry), then voice sign-off.
6. **Rules** -- CLI invocation rules, web research rules, WebFetch failure handling, wall-clock budget (90-second self-check), no editorializing, no metric fabrication.
7. **CLI Quick Reference** -- Error recovery table (no API keys, rate limits, module resolution errors, etc.)

### Voice layer

The reporter has personality in its openers and sign-offs. The data sections between them stay rigorous and structured.

Voice opener examples:
- "Filed. The street's buzzing about this one."
- "Dry beat today. Nothing worth column inches."
- "Got a hot lead. The numbers don't lie."
- "Three sources, same story. This one's solid."

Voice sign-off examples:
- "That's the word on the street."
- "Take it or leave it, but the numbers are real."
- "The street never lies, it just exaggerates."

### Key differences from newsroom version

1. **No desk protocol** -- the agent receives a topic string (and optional context/hints) in its dispatch prompt, not a structured JSON assignment. It derives CLI flags and search strategy from the topic.
2. **Own personality** -- 1920s beat reporter voice with openers and sign-offs, not tied to the newsroom desk/editor dynamic.
3. **No `skills: [web-scraping]`** -- WebFetch failure handling is inlined in the agent body (try once, skip if 403/empty, note in telemetry, never fabricate).
4. **Flexible dispatch** -- any skill can dispatch it with a simple prompt like "Research community sentiment on [topic]" or the arena can add bias framing.

### How the arena skill uses it

The arena skill adds bias at dispatch time by wrapping the beat-reporter prompt:

```
You are a beat reporter assigned to Team [LETTER]. Team [LETTER] LOVES [POSITION].
They believe [POSITION] is the best approach and the alternatives are inferior.

Your job: Find the STRONGEST evidence supporting Team [LETTER]'s position.
When reporting, emphasize evidence that supports [POSITION] and de-emphasize
evidence that undermines it. Your report should make the strongest possible case.

Now research: [TOPIC]
```

The bias is in the dispatch prompt, not in the agent definition. The beat-reporter's core workflow (CLI -> Web -> Extract -> File) runs the same whether dispatched with bias or without.

### How other skills use it

Any cortex-engineering skill can dispatch a beat-reporter for unbiased community intel:

- **Research skill:** "Research community sentiment on [topic] -- what are developers saying?"
- **Plan review:** "Before we finalize this plan, check what the community thinks about [technology/approach]"
- **Code review:** "Check if there's a newer version or known issues with [library]"

## Technical Considerations

### CLI dependency

The `@side-quest/word-on-the-street` CLI must be available via `bunx`. If not installed, the agent should:
1. Report the CLI failure in telemetry (`cli_status: failed`)
2. Fall back to WebSearch-only mode (degraded but functional)
3. Note in the report that engagement metrics are unavailable without the CLI

Known bunx cache corruption issue (from MEMORY.md): if module resolution fails, the fix is `rm -rf /private/var/folders/_b/*/T/bunx-501-@side-quest/` then retry. The agent body includes this in the CLI Quick Reference.

### Sub-agent tool access

Per the Claude Code sub-agents spec, agents inherit tools from the parent conversation by default. However, declaring `tools: Bash, WebSearch, WebFetch` in the agent frontmatter creates an explicit allowlist that guarantees access regardless of how the parent dispatches it.

Key gotchas for background sub-agents:
- Background sub-agents cannot prompt for clarifying questions -- those tool calls fail silently
- Permission pre-approval happens before the sub-agent launches, so all needed tools must be identified upfront (hence the explicit `tools` allowlist)
- Sub-agents cannot spawn other sub-agents (no nesting) -- the beat-reporter is a leaf agent
- Each dispatch is a fresh context reset -- no state carries between invocations

### Arena skill updates

The arena skill needs three changes:
1. Remove the newsroom prerequisite check
2. Update dispatch to use `cortex-engineering:beat-reporter` (or just reference the agent type in the Agent tool call)
3. Add bias framing to the dispatch prompt template (already partially there -- just needs cleanup)

### Report format contract

The reporter files a structured report wrapped in personality. When bias-dispatched by arena, the report naturally emphasizes one side because the search was directed that way -- but the format stays the same.

```
{voice opener}

## CLI Data
[Top 5 items with title, source, engagement numbers, relevance.
 No editorializing -- report what you found, not what you think.]

## Web Findings
[Top 3-5 findings with source attribution, engagement signals, key themes.
 Contradictions or debates worth noting.]

## Source Links
- [title](url) (342 pts, 28 comments) -- r/subreddit
- [tweet text](url) (910 likes, 45 reposts) -- @handle
- [video title](url) (250K views, 12K likes) -- Channel Name (YT)
- [article title](url) -- domain.com (web)

## Telemetry
cli_status: ok|failed|cached|rate-limited
web_pages: N
source_gaps: none|[platforms with zero results]
duration: ~Xs

{voice sign-off}
```

### Wall-clock budget

90-second self-check (matching newsroom convention). If approaching timeout, skip remaining WebFetch calls and file with available data.

## System-Wide Impact

- **Interaction graph:** Any cortex skill dispatches beat-reporter via Agent tool -> reporter runs CLI + web research -> files structured report -> caller skill processes output (arena adds judge synthesis, research adds to Cortex doc, etc.)
- **Error propagation:** CLI failure degrades to WebSearch-only mode. WebFetch failure skips individual URLs. Reporter always files a report, even if sparse. Callers handle sparse reports per their own logic.
- **State lifecycle risks:** None -- reporters are stateless sub-agents. CLI writes to `/tmp/wots-<topic>-<rand>/` which is ephemeral.
- **API surface parity:** The research skill references beat-reporter agents in its capabilities table -- update to point to in-plugin agent. The arena skill's dispatch section -- update to remove newsroom dependency.

## Acceptance Criteria

### Files to create

- [x] `plugins/cortex-engineering/agents/beat-reporter.md` -- agent definition with frontmatter + system prompt body, adapted from newsroom beat-reporter (CLI-powered, 4-phase workflow, 1920s beat reporter personality, no desk protocol, inline WebFetch failure handling)

### Files to modify

- [x] `plugins/cortex-engineering/.claude-plugin/plugin.json` -- add `"agents": ["./agents/beat-reporter.md"]`, bump version to `0.6.0`
- [x] `plugins/cortex-engineering/skills/arena/SKILL.md` -- remove newsroom prerequisite, update dispatch to use in-plugin beat-reporter, move bias framing into dispatch prompt template
- [x] `plugins/cortex-engineering/skills/research/SKILL.md` -- update beat-reporter reference in capabilities table

### Functional requirements

- [x] Agent uses `@side-quest/word-on-the-street` CLI as primary data source via `bunx --bun`
- [x] Agent parses CLI JSON envelope (reddit, x, youtube, web_search_instructions)
- [x] Agent performs supplementary web research guided by CLI's web_search_instructions
- [x] Agent extracts structured source links with engagement metrics from CLI data
- [x] Agent files structured report (CLI Data, Web Findings, Source Links, Telemetry)
- [x] Agent degrades gracefully to WebSearch-only when CLI is unavailable
- [x] Agent handles WebFetch failures (skip and note in telemetry, never fabricate)
- [x] Agent self-checks at ~90 seconds and files with available data if approaching timeout
- [x] Agent has 1920s beat reporter personality -- voice openers, sign-offs, lean punchy prose
- [x] Agent is factual by default -- no editorializing in data sections, personality in framing only
- [x] Arena skill can add bias framing at dispatch time without changing agent internals
- [x] Arena skill no longer requires newsroom plugin

### Quality gates

- [x] `bun run validate` passes (marketplace structure validation)
- [x] Agent frontmatter uses single-line description (no YAML block scalars)
- [x] Agent name follows naming conventions (role-noun, kebab-case, 1-3 words)
- [x] No cross-plugin dependencies remain in arena skill
- [x] CLI Quick Reference includes known bunx cache corruption fix

## Dependencies & Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `@side-quest/word-on-the-street` CLI not installed | Medium | Medium | Graceful degradation to WebSearch-only with telemetry note |
| Bunx cache corruption breaks CLI | Known | Medium | CLI Quick Reference includes fix (`rm -rf /private/var/folders/...`) |
| Sub-agent tool sandboxing blocks Bash/WebSearch | Low | High | Explicit `tools` allowlist in frontmatter + end-to-end test |
| WebFetch unreliable on Reddit/X (JS rendering) | High | Low | CLI handles Reddit/X directly; WebFetch is supplementary |
| LLM alignment pull softens arena bias framing | Medium | Medium | Explicit no-hedging rule in arena dispatch prompt |
| Three-camp verdict format incomplete | Known | Low | Arena skill gap, not a beat-reporter blocker |

## Sources & References

### Internal References

- Newsroom beat-reporter (reference implementation): `/Users/nathanvale/code/side-quest-plugins/plugins/newsroom/agents/beat-reporter.md`
- Newsroom fact-checker (agent pattern reference): `/Users/nathanvale/code/side-quest-plugins/plugins/newsroom/agents/fact-checker.md`
- Newsroom plugin.json (manifest pattern): `/Users/nathanvale/code/side-quest-plugins/plugins/newsroom/.claude-plugin/plugin.json`
- Arena skill (caller): `plugins/cortex-engineering/skills/arena/SKILL.md`
- Research skill (references beat-reporter): `plugins/cortex-engineering/skills/research/SKILL.md`
- Naming conventions: `plugins/cortex-engineering/skills/naming-conventions/SKILL.md`
- Official skill spec: `plugins/cortex-engineering/skills/skill-authoring/references/official-spec.md`
- Plugin anatomy: `.claude/CLAUDE.md` (Plugin Manifest section)

### Claude Code Documentation

- Sub-agents spec (tool inheritance, frontmatter fields, background gotchas): [code.claude.com/docs/en/sub-agents.md](https://code.claude.com/docs/en/sub-agents.md)
- Skills spec (context: fork, agent field): [code.claude.com/docs/en/skills.md](https://code.claude.com/docs/en/skills.md)
- Plugins reference (agents array in plugin.json): [code.claude.com/docs/en/plugins-reference.md](https://code.claude.com/docs/en/plugins-reference.md)

### Institutional Learnings

- Agent naming: role-nouns, descriptions drive routing, names are API contracts (`docs/research/2026-03-01-naming-conventions-claude-code-plugins.md`)
- CLI vs MCP decision: default to CLI/skills for local workflows (`docs/solutions/logic-errors/cli-vs-mcp-open-questions-decision-framework-20260304.md`)
- YAML block scalar bug: never use `>` or `|` for description fields in frontmatter (MEMORY.md)
- Bunx cache corruption: known issue with MCP servers, fix documented in MEMORY.md
