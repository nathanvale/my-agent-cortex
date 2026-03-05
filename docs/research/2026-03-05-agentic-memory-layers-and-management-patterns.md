---
created: 2026-03-05
title: "Agentic Memory Layers and Management Patterns"
type: research
tags: [memory, agentic-coding, mcp, cortex, context-engineering, claude-code]
project: side-quest-marketplace
status: draft
---

## Summary

Maps four distinct layers where memory can live in agentic coding, from lightweight per-session scratchpads to enterprise-scale knowledge infrastructure. Documents Anthropic's official memory tool API (`memory_20250818`) and how Cortex fits as a Layer 3 MCP knowledge system.

## Key Findings

### Four Layers of Agentic Memory

| Layer | Example | Scope | Persistence |
|-------|---------|-------|-------------|
| 1. Native Auto-Memory | Claude Code's `MEMORY.md` | Per-project | Cross-session |
| 2. API Memory Tool | `memory_20250818` | Per-app | You control |
| 3. MCP Knowledge Layer | Cortex, custom MCP servers | Cross-project | Permanent |
| 4. External Memory Infra | Vector DBs, knowledge graphs | Org-wide | Permanent |

Each layer increases in scope, structure, and persistence. Layers 1-2 are "agent manages its own notes." Layer 3 is "curated knowledge with structure." Layer 4 is "enterprise search and retrieval."

### Anthropic's Official Memory Tool (API-level)

The `memory_20250818` tool is a client-side primitive in the Messages API:

- Claude gets a `/memories` directory with `view`, `create`, `str_replace`, `insert`, `delete`, and `rename` operations
- Storage backend is yours to implement (filesystem, database, cloud, encrypted)
- Claude auto-checks memory directory before starting tasks
- Designed around the assumption that context windows will be interrupted

**Commands:** `view` (directory listing or file contents with line ranges), `create`, `str_replace` (exact text replacement), `insert` (at line number), `delete`, `rename`.

**Supported models:** Claude Opus 4.6, Opus 4.5, Opus 4.1, Opus 4, Sonnet 4.6, Sonnet 4.5, Sonnet 4, Haiku 4.5.

### Context Editing + Compaction Pairing

The memory tool pairs with two complementary features for long-running workflows:

- **Context editing** (`clear_tool_uses_20250919`) -- client-side, clears old tool results when context grows beyond a threshold. Claude preserves critical info to memory before clearing.
- **Compaction** -- server-side summarization of conversation history when approaching context window limits.

Together: compaction keeps active context manageable, memory persists important information across compaction boundaries. Workflows can run indefinitely.

### Multi-Session Development Pattern

From Anthropic's engineering guidance:

1. **Initializer session** sets up memory artifacts before substantive work -- progress log, feature checklist, initialization scripts
2. **Subsequent sessions** read memory first to recover full project state in seconds
3. **End-of-session updates** keep the progress log accurate for next session
4. **Key principle:** Work on one feature at a time. Only mark complete after end-to-end verification.

### Layer 3: Where Cortex Lives

Layer 3 (MCP Knowledge Layer) is the sweet spot between "LLM scratchpad" and "enterprise vector DB." Characteristics:

- **Indexes structured markdown** across multiple project repos (glob patterns like `~/code/*/docs/`)
- **Exposes query tools** via MCP (`cortex_list`, `cortex_search`, `cortex_read`)
- **Works cross-project** -- agent in repo A finds research from repo B
- **Uses frontmatter as the query layer** -- no vector DB, no embeddings, just YAML metadata + full-text search

Other potential Layer 3 implementations:
- A decisions MCP indexing ADRs across all repos
- A gotchas MCP surfacing known pitfalls before you hit them
- The second-brain MCP pattern (persistent context + cross-tool integration)

The key distinction from Layer 2: Layer 2 is per-session scratchpad managed by the agent. Layer 3 is curated knowledge with explicit metadata that makes it queryable by future agents across any project.

### Security Considerations (Memory Tool)

- Path traversal protection required -- validate all paths stay within `/memories`
- Sensitive information -- Claude usually refuses to write sensitive data, but implement stricter validation
- File storage size -- track sizes, prevent unbounded growth
- Memory expiration -- consider clearing files not accessed for extended periods

## Sources

- [Anthropic Memory Tool Documentation](https://platform.claude.com/docs/en/agents-and-tools/tool-use/memory-tool)
- [Effective Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) -- referenced by memory tool docs
- [Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) -- multi-session pattern case study
- Cortex brainstorm (`docs/brainstorms/2026-02-27-cortex-brainstorm.md`) -- original Layer 3 vision
- Second brain MCP research (`docs/research/2026-02-27-second-brain-mcp.md`) -- three-layer architecture comparison

## Open Questions

- What are the community's most popular Layer 3 implementations beyond Cortex? (newsroom investigation pending)
- How does the API memory tool compare to Claude Code's native auto-memory in practice -- are people using both?
- Is there a sweet spot for memory file organization (flat vs hierarchical, few large files vs many small)?
- How do teams handle memory conflicts when multiple agents write to the same memory directory?
- What's the practical ceiling for in-memory frontmatter indexing before you need a vector DB (Layer 4)?
