#!/usr/bin/env node
'use strict';

// Bundled copy used by the Mermaid Task Button extension (works in any
// folder, independent of a project's own .vscode/scripts copy of this file).
// Exports every ```mermaid fenced block inside a Markdown file to its own
// image (SVG or PNG), using mmdc's built-in Markdown support (via npx, no
// global install). The source .md file is never modified: mmdc is pointed
// at a throwaway output .md (deleted afterwards) and only the generated
// images are kept, renamed from "<base>.mmdexport-N.<ext>" to
// "<base>-diagram-N.<ext>".
//
// Usage: node export-mermaid-from-markdown.js <path-to-markdown-file> [svg|png]
//
// SVG exports pass ./mermaid-config.json, which sets top-level
// "htmlLabels": false. Mermaid otherwise renders node labels as HTML inside
// <foreignObject>, which Word's (and Inkscape's) SVG importer doesn't
// support, leaving blank/broken label boxes. The commonly documented
// "flowchart": { "htmlLabels": false } form no longer has any effect in
// current Mermaid — see https://github.com/mermaid-js/mermaid/issues/7565 —
// it must be set at the top level of the config. PNG is kept as an
// alternative output format (a plain raster snapshot, unaffected by any of
// this) via the third argument.

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function quoteArg(arg) {
  return `"${String(arg).replace(/"/g, '\\"')}"`;
}

const inputArg = process.argv[2];
const format = (process.argv[3] || 'svg').toLowerCase();
if (!inputArg) {
  console.error('Usage: node export-mermaid-from-markdown.js <path-to-markdown-file> [svg|png]');
  process.exit(1);
}
if (format !== 'svg' && format !== 'png') {
  console.error(`Unsupported format "${format}". Use "svg" or "png".`);
  process.exit(1);
}

const inputPath = path.resolve(inputArg);
if (!fs.existsSync(inputPath)) {
  console.error(`File not found: ${inputPath}`);
  process.exit(1);
}

const dir = path.dirname(inputPath);
const base = path.basename(inputPath, path.extname(inputPath));
const tempBase = `${base}.mmdexport`;
const tempMdPath = path.join(dir, `${tempBase}.md`);
const configPath = path.join(__dirname, 'mermaid-config.json');

const content = fs.readFileSync(inputPath, 'utf8');
const diagramCount = (content.match(/```mermaid/g) || []).length;

if (diagramCount === 0) {
  console.log(`No mermaid code blocks found in ${path.basename(inputPath)}.`);
  process.exit(0);
}

console.log(`Found ${diagramCount} mermaid diagram(s) in ${path.basename(inputPath)}. Exporting as ${format.toUpperCase()}...`);

const cmdParts = [
  'npx',
  '-y',
  '-p',
  '@mermaid-js/mermaid-cli',
  'mmdc',
  '-i',
  quoteArg(inputPath),
  '-o',
  quoteArg(tempMdPath),
  '-e',
  format,
  '-b',
  'transparent',
  '-c',
  quoteArg(configPath),
];
if (format === 'png') {
  cmdParts.push('-s', '3');
}
const cmd = cmdParts.join(' ');

try {
  execSync(cmd, { stdio: 'inherit', cwd: dir });
} catch (err) {
  if (fs.existsSync(tempMdPath)) fs.unlinkSync(tempMdPath);
  console.error(`mmdc failed: ${err.message}`);
  console.error(`Command was: ${cmd}`);
  process.exit(1);
}

if (fs.existsSync(tempMdPath)) fs.unlinkSync(tempMdPath);

const filePattern = new RegExp(`^${tempBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)\\.${format}$`);
const generated = fs
  .readdirSync(dir)
  .map((f) => ({ file: f, match: f.match(filePattern) }))
  .filter((entry) => entry.match)
  .sort((a, b) => Number(a.match[1]) - Number(b.match[1]));

if (generated.length === 0) {
  console.error(`mmdc did not produce any .${format} files.`);
  process.exit(1);
}

const outputs = [];
for (const { file, match } of generated) {
  const index = match[1];
  const newName = `${base}-diagram-${index}.${format}`;
  fs.renameSync(path.join(dir, file), path.join(dir, newName));
  outputs.push(newName);
}

console.log(`Exported ${outputs.length} ${format.toUpperCase()} file(s) to ${dir}:`);
for (const name of outputs) console.log(`  - ${name}`);
