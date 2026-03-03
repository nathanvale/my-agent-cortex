---
name: visualize
description: Generate a visual diagram from any document, topic, or concept
allowed-tools: Bash(bunx *), Bash(open *), Bash(mkdir *), Read, Glob, Grep, Write, Task
argument-hint: "<path, topic, or concept>"
---

Use the **visualize** skill to generate a Mermaid diagram and export to print-ready SVG/PDF. $ARGUMENTS

## Output Convention

All diagram output goes to `docs/diagrams/<date>-<slug>/`:

```
docs/diagrams/2026-03-03-kb-mpe-plan/
  flowchart.mmd          # Mermaid source
  flowchart.svg          # SVG (primary)
  flowchart.pdf          # PDF (print-ready)
  index.md               # Legend, context, diagram descriptions
```

- Create the directory with `mkdir -p` before writing files
- Use descriptive filenames when multiple diagrams exist (e.g., `architecture.mmd`, `token-budget.mmd`)
- Always create an `index.md` with a brief description of each diagram
- Date prefix uses ISO format: `YYYY-MM-DD`
