---
created: 2026-03-05
title: Uncorrelated context windows in Claude Code
type: research
tags: [claude-code, context-windows, subagents, context-rot, multi-agent, agent-teams, context-engineering]
project: side-quest-marketplace
status: final
sources: [reddit, x-twitter, web, official-docs]
method: newsroom beat reporter (Reddit, X, web) + desk synthesis
---

# Uncorrelated Context Windows in Claude Code

Research into how Claude Code's subagent architecture provides independent context windows, why it matters, and how the community is using it to fight "context rot."

## Summary

The community doesn't use "uncorrelated context windows" as a term -- the street says **"context rot"** and **"independent context isolation."** But the architecture is real and documented: every Claude Code subagent runs in its own fully isolated context window by design. This is the primary weapon against quality degradation in long sessions. Agent Teams (Feb 2026, Opus 4.6) extends this to peer-to-peer coordination between persistent independent instances.

## Key Findings

1. **Context rot is the community's #1 pain point** -- quality degrades as context fills. Two viral X posts (1,825 and 1,201 likes) describe the phenomenon and link to workarounds with 18,300+ GitHub stars.

2. **Subagent isolation is bidirectional by design** -- per official docs, subagents get their own context window, custom system prompt, specific tool access, and independent permissions. Parent compaction doesn't affect subagent transcripts, and vice versa.

3. **The mental model is "LLM function call"** -- arguments in (prompt), execution in its own context, return value (concise summary) injected back into the parent. Self-attention physics explains why: irrelevant context injects competing associations that dilute focus.

4. **Known bottleneck: 8K output limit + shared token budget** -- GitHub issue #10212 documents that subagents share the parent's 200K token budget and are capped at 8,192 output tokens per response. Workaround: separate terminal sessions provide truly independent 200K budgets.

5. **Agent Teams is the production-grade answer** -- shipped Feb 2026, provides peer-to-peer coordination between fully independent Claude instances (not hub-and-spoke like subagents).

## Details

### Architecture (Official Docs)

From [code.claude.com/docs/en/sub-agents](https://code.claude.com/docs/en/sub-agents):

- Each subagent runs in its own context window with custom system prompt, specific tool access, and independent permissions
- Subagents do NOT inherit the parent conversation context -- only their prompt + basic environment info
- Transcripts stored in separate `.jsonl` files at `~/.claude/projects/{project}/{sessionId}/subagents/agent-{agentId}.jsonl`
- Subagents support their own auto-compaction (triggers at 95% capacity), independently of parent
- `isolation: worktree` provides filesystem isolation on top of context isolation
- Skills are NOT inherited -- must be explicitly listed in subagent frontmatter
- Hard constraint: subagents cannot spawn other subagents (no nesting)

### The Context Rot Problem

"Context rot" describes quality degradation as a Claude Code session's context fills:

- Self-attention becomes less focused as irrelevant context accumulates
- Tool output (especially MCP server init payloads) is an underappreciated context drain
- The Claude Code team ditched RAG entirely in favor of agentic search (grep, bash, find) -- per Latent Space interview -- because context is the wrong bottleneck to throw tokens at

### Practical Gotchas

| Gotcha | Details |
|--------|---------|
| MCP tool overhead | Each MCP server loads tool names, descriptions, and instructions into context on init |
| Compaction loops | Edge case: after compaction, session hits 0% free context immediately, triggering another compaction. Fix: ensure at least 50% room before heavy operations |
| Skills don't inherit | Subagents must explicitly list needed skills in frontmatter |
| Not true parallelism | Subagents queue commands. Real parallelism needs worktrees + terminal multiplexer, or Agent SDK |
| 8K output cap | Subagent responses truncate at 8,192 tokens. Workaround: write results to disk |

### Evolution: Subagents to Agent Teams

| Capability | Subagents | Agent Teams (Feb 2026) |
|-----------|-----------|----------------------|
| Context isolation | Yes (own window) | Yes (own instance) |
| Coordination model | Hub-and-spoke (parent spawns, synthesizes) | Peer-to-peer |
| Persistence | Ephemeral (task-scoped) | Persistent workers |
| Token budget | Shared with parent | Independent per worker |
| Parallelism | Queued commands | True concurrent execution |

## Sources

### High-Engagement (X/Twitter)

- [@hasantoxr -- GSD method solves context rot](https://x.com/hasantoxr/status/2026268317334524007) | 1,825 likes, 171 reposts
- [@carlosvillu -- Context rot explainer](https://x.com/carlosvillu/status/2025967908443050337) | 1,201 likes, 81 reposts
- [@RaulJuncoV -- Stop dumping everything into CLAUDE.md](https://x.com/RaulJuncoV/status/2019396521209553327) | 548 likes, 24 reposts
- [@techNmak -- Claude-Mem: persistent memory across sessions](https://x.com/techNmak/status/2020415690784567746) | 208 likes, 24 reposts
- [@melvynxdev -- Don't use plugins that flood context](https://x.com/melvynxdev/status/2018179488165859494) | 200 likes, 48 replies
- [@yagudaev -- Claude Code stuck in context-compact loop](https://x.com/yagudaev/status/2026829574210736321)
- [@RikNieu -- 98% context reduction plugin](https://x.com/RikNieu/status/2028475786076758265)

### Reddit

- [Context windows aren't the real bottleneck (memory is)](https://www.reddit.com/r/AI_Agents/comments/1r7cc6p/context_windows_arent_the_real_bottleneck_for/) | r/AI_Agents, 93 pts, 33 comments
- [Context Mode - The other half of the context problem](https://www.reddit.com/r/ClaudeAI/comments/1rdtfnl/context_mode_the_other_half_of_the_context_problem/) | r/ClaudeAI
- [Are we overusing context windows instead of improving retrieval?](https://www.reddit.com/r/LocalLLaMA/comments/1r2p398/are_we_overusing_context_windows_instead_of/) | r/LocalLLaMA

### Official Documentation

- [Create custom subagents - Claude Code Docs](https://code.claude.com/docs/en/sub-agents)
- [Subagents in the SDK - Claude API Docs](https://platform.claude.com/docs/en/agent-sdk/subagents)
- [Common workflows - Claude Code Docs](https://code.claude.com/docs/en/common-workflows)

### Web / Technical Analysis

- [GitHub Issue #10212: Independent Context Windows for Sub-Agents](https://github.com/anthropics/claude-code/issues/10212)
- [Rich Snapp -- Context Management with Subagents](https://www.richsnapp.com/article/2025/10-05-context-management-with-subagents-in-claude-code)
- [Claude Code Agent Teams Guide](https://claudefa.st/blog/guide/agents/agent-teams)
- [Claude Code Worktrees Guide](https://claudefa.st/blog/guide/development/worktree-guide)
- [Claude Code Multiple Agent Systems Guide](https://www.eesel.ai/blog/claude-code-multiple-agent-systems-complete-2026-guide)
- [How to Use Claude Code Subagents to Parallelize Development](https://zachwills.net/how-to-use-claude-code-subagents-to-parallelize-development/)

## Open Questions

1. **Will subagents get independent token budgets?** -- GitHub issues #10212, #9284, #7706, #9634 all track this. Currently sharing the parent's 200K is the main limitation.
2. **Agent Teams vs subagents -- when to use which?** -- Community is still figuring out the boundary. Subagents for quick, focused tasks; Agent Teams for sustained parallel work. But the UX for choosing isn't clear yet.
3. **Context rot quantification** -- nobody has published rigorous benchmarks measuring quality degradation as a function of context fill percentage. The 18K-star repo addresses symptoms but doesn't measure the underlying curve.
4. **MCP tool context overhead** -- how much context does each MCP server actually consume? No systematic measurement exists. The "98% reduction" claim from @RikNieu needs validation.
