#!/usr/bin/env node
// Copies mode prompt files from the parent repo into portal/lib/_modes/
// so the portal is self-contained and can be deployed to Vercel without
// the rest of the monorepo.
//
// Runs as a `prebuild` step. Idempotent — overwrites _modes/*.md every time.
// If ../modes/ does not exist (e.g., Vercel build with portal/ as root), it
// no-ops silently and trusts whatever is already committed in lib/_modes/.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const portalRoot = path.resolve(here, '..');
const repoRoot = path.resolve(portalRoot, '..');
const src = path.join(repoRoot, 'modes');
const dst = path.join(portalRoot, 'lib', '_modes');

if (!fs.existsSync(src)) {
  console.log(`[sync-modes] no ${src} — skipping (using committed _modes/)`);
  process.exit(0);
}

fs.mkdirSync(dst, { recursive: true });

const FILES = ['_shared.md', 'oferta.md', '_profile.md'];
let copied = 0;
for (const f of FILES) {
  const s = path.join(src, f);
  if (!fs.existsSync(s)) continue;
  fs.copyFileSync(s, path.join(dst, f));
  copied++;
}
console.log(`[sync-modes] copied ${copied} mode file(s) into lib/_modes/`);
