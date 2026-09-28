# Export Mermaid to SVG

A tiny VS Code extension that adds a button to export Mermaid diagrams to SVG — from a standalone `.mmd` file, or from every ```` ```mermaid ```` code block embedded in a Markdown file — without installing anything globally.

## What it does

An icon (📄) appears in the editor title bar — top-right, next to things like *Split Editor* — whenever the active file is:

- a `.mmd` file, or
- a `.md` file (in the source editor, or in the Markdown Preview panel/custom editor)

Clicking it:

1. Saves the file first, if it has unsaved changes.
2. For a `.mmd` file, runs `mmdc` once to produce `<file>.svg` next to it.
3. For a `.md` file, extracts *every* Mermaid code block and produces `<file>-diagram-1.svg`, `-diagram-2.svg`, etc. next to it — the source Markdown is never modified.
4. Shows the export progress/output in the integrated terminal, via a VS Code task the extension builds on the fly (no `tasks.json` required in your project).

It works in **any** folder you open in VS Code — nothing needs to be configured per-project.

## Why not just use `mermaid.live` or Mermaid CLI directly?

You can — this just wires that up as a one-click button, and fixes two real Mermaid rendering problems along the way that otherwise produce broken SVGs outside a browser (e.g. pasted into Word, or converted with Inkscape for LaTeX/Overleaf):

- **Missing/blank label text** — Mermaid renders node labels as HTML inside `<foreignObject>` by default. Word's and Inkscape's SVG importers don't support `foreignObject`, so labels come out blank. The commonly documented fix, `{"flowchart": {"htmlLabels": false}}`, no longer has any effect in current Mermaid ([mermaid-js/mermaid#7565](https://github.com/mermaid-js/mermaid/issues/7565)) — the key has to be set at the **top level** of the config: `{"htmlLabels": false}`.
- **Missing shapes** — Mermaid v11+'s default "neo" visual style draws shapes with a drop-shadow via a CSS `filter: url(#...)` reference and `[data-look="neo"]` attribute selectors. Word's SVG renderer doesn't handle that and drops the shape entirely. Setting `"look": "classic"` switches to Mermaid's older flat style, which avoids both the filter and the attribute selectors.

Both fixes are baked into [`mermaid-config.json`](./mermaid-config.json) and passed to `mmdc` via `-c` on every export. PNG output (if you use the underlying script directly, see below) isn't affected by either issue — it's a plain raster snapshot of what Mermaid renders, filters and all.

## How it's built

- `mmdc` (`@mermaid-js/mermaid-cli`) runs via `npx -y -p @mermaid-js/mermaid-cli mmdc ...`, so nothing is installed globally — only npx's local package cache is used, and it always resolves to the latest published version.
- `extension.js` registers one command and builds a `vscode.Task` with a `vscode.ShellExecution` in code (command + args array, not a pre-joined string — letting VS Code apply correct per-shell quoting itself, which matters for paths containing spaces).
- `export-mermaid-from-markdown.js` uses `mmdc`'s built-in Markdown mode (`-i file.md -o <throwaway>.md`) to extract and render every diagram in one pass, then renames the generated images and deletes the throwaway file.
- `mermaid-config.json` is the shared Mermaid config described above.

## Installing

No marketplace listing — install the packaged `.vsix` locally:

```sh
npx -y @vscode/vsce package --allow-missing-repository
code --install-extension mermaid-task-button.vsix
```

Then reload the VS Code window (**Ctrl+Shift+P → "Developer: Reload Window"**) so it activates.

## Requirements

- [Node.js](https://nodejs.org/) (for `npx`)
- An internet connection the first time you export (to fetch `@mermaid-js/mermaid-cli`, which npx then caches locally)
