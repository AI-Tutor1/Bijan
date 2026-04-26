#!/usr/bin/env node
// stage-form.mjs — Playwright pre-fill (NEVER auto-submits)
//
//   node stage-form.mjs <job_id>
//
// Reads the job, form_answers, and latest cv_versions row from Supabase, then
// opens a visible Chromium window at the job's source_url and pre-fills every
// form field it can match. Highlights unmatched fields in red. Stops. Waits for
// the user to click Submit themselves.
//
// Requirements:
//   - .env.local with SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
//   - npx playwright install chromium  (one time)

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = __dirname;

// ── load .env.local ───────────────────────────────────────────────────────
const envPath = path.join(root, '.env.local');
if (!fs.existsSync(envPath)) {
  console.error(`✗ .env.local not found at ${envPath}`);
  process.exit(1);
}
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('✗ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
};

// ── args ──────────────────────────────────────────────────────────────────
const jobId = process.argv[2];
if (!jobId) {
  console.error('Usage: node stage-form.mjs <job_id>');
  process.exit(1);
}

// ── fetch job data ────────────────────────────────────────────────────────
async function rest(p) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1${p}`, { headers });
  if (!r.ok) throw new Error(`GET ${p} → ${r.status} ${await r.text()}`);
  return r.json();
}

console.log(`\n  Loading job ${jobId} from Supabase...`);
const [job] = await rest(`/jobs?id=eq.${jobId}&select=*`);
if (!job) {
  console.error(`✗ No job found with id=${jobId}`);
  process.exit(1);
}
if (!job.source_url || job.source_url.startsWith('bijan://')) {
  console.error(`✗ Job has no real source_url (got: ${job.source_url})`);
  process.exit(1);
}

const answers = await rest(`/form_answers?job_id=eq.${jobId}&select=question,answer,source`);
const cvVersions = await rest(`/cv_versions?job_id=eq.${jobId}&select=pdf_path&order=generated_at.desc&limit=1`);

console.log(`  ${job.company || '(no company)'} — ${job.title || '(no title)'}`);
console.log(`  ${answers.length} prepared answer(s), ${cvVersions.length} CV version(s)`);

if (answers.length === 0) {
  console.log('  ⚠ No form_answers for this job. Run `apply` mode first to generate them.');
}

// ── download latest CV pdf if any ─────────────────────────────────────────
let cvPath = null;
if (cvVersions.length && cvVersions[0].pdf_path) {
  const tmpFile = path.join(os.tmpdir(), `bijan-cv-${jobId}.pdf`);
  const dl = await fetch(`${SUPABASE_URL}/storage/v1/object/cvs/${cvVersions[0].pdf_path}`, { headers });
  if (dl.ok) {
    fs.writeFileSync(tmpFile, Buffer.from(await dl.arrayBuffer()));
    cvPath = tmpFile;
    console.log(`  CV downloaded → ${tmpFile}`);
  } else {
    console.log(`  ⚠ Failed to download CV (${dl.status}); skipping upload step.`);
  }
}

// ── tokenize for fuzzy matching ───────────────────────────────────────────
const stop = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'to', 'for', 'in', 'on', 'with', 'is', 'are', 'do', 'you', 'your', 'we', 'our']);
function tokens(s) {
  return new Set(
    String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, ' ')
      .split(/\s+/)
      .filter((t) => t && !stop.has(t)),
  );
}
function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

const answerSets = answers.map((a) => ({ ...a, tokens: tokens(a.question) }));

function bestMatch(label) {
  const lt = tokens(label);
  if (!lt.size) return null;
  let best = { score: 0, ans: null };
  for (const a of answerSets) {
    const s = jaccard(lt, a.tokens);
    if (s > best.score) best = { score: s, ans: a };
  }
  return best.score >= 0.4 ? best.ans : null;
}

// ── launch browser ────────────────────────────────────────────────────────
console.log(`\n  Launching Chromium (visible)...`);
const browser = await chromium.launch({ headless: false, args: ['--no-default-browser-check'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

console.log(`  Navigating to ${job.source_url}`);
await page.goto(job.source_url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
await page.waitForTimeout(2000); // let dynamic content render

// ── enumerate fields ──────────────────────────────────────────────────────
const fieldHandles = await page.$$('input:not([type=hidden]):not([type=submit]):not([type=button]), textarea, select');
console.log(`\n  Found ${fieldHandles.length} field(s) on the page\n`);

let filled = 0;
let highlighted = 0;
let cvUploaded = false;
const unmatched = [];

for (const h of fieldHandles) {
  // Get label text via JS evaluation
  const meta = await h.evaluate((el) => {
    const labels = [];
    if (el.getAttribute('aria-label')) labels.push(el.getAttribute('aria-label'));
    if (el.id) {
      const lab = document.querySelector(`label[for="${el.id}"]`);
      if (lab) labels.push(lab.innerText);
    }
    const wrap = el.closest('label');
    if (wrap) labels.push(wrap.innerText);
    if (el.getAttribute('placeholder')) labels.push(el.getAttribute('placeholder'));
    if (el.getAttribute('name')) labels.push(el.getAttribute('name'));
    return {
      tag: el.tagName.toLowerCase(),
      type: el.type || null,
      label: labels.join(' | '),
    };
  });

  const labelText = meta.label;

  // CV file upload
  if (meta.tag === 'input' && meta.type === 'file' && cvPath && /resume|cv|curriculum/i.test(labelText)) {
    try {
      await h.setInputFiles(cvPath);
      cvUploaded = true;
      filled++;
      console.log(`  ✓ [file] ${labelText.slice(0, 60)} → CV uploaded`);
    } catch (e) {
      console.log(`  ✗ [file] ${labelText} — ${e.message}`);
    }
    continue;
  }

  // Skip submit-y buttons (defensive — query already excludes most)
  if (/submit|apply|send|continue/i.test(labelText) && meta.type !== 'text') continue;

  const ans = bestMatch(labelText);
  if (!ans) {
    if (labelText.trim()) {
      await h.evaluate((el) => { el.style.outline = '2px solid #e74c3c'; el.style.outlineOffset = '2px'; });
      unmatched.push(labelText.slice(0, 80));
      highlighted++;
    }
    continue;
  }

  try {
    if (meta.tag === 'select') {
      await h.selectOption({ label: ans.answer }).catch(() => h.selectOption(ans.answer));
    } else if (meta.type === 'checkbox' || meta.type === 'radio') {
      // Skip — needs explicit value matching, leave for user
      continue;
    } else {
      await h.fill(String(ans.answer));
    }
    filled++;
    console.log(`  ✓ ${labelText.slice(0, 50).padEnd(50)} → ${String(ans.answer).slice(0, 60).replace(/\n/g, ' ')}`);
  } catch (e) {
    console.log(`  ✗ ${labelText.slice(0, 50)} — ${e.message}`);
  }
}

// ── summary ───────────────────────────────────────────────────────────────
console.log(`\n  Summary: filled ${filled}, highlighted ${highlighted}${cvUploaded ? ', CV attached' : ''}`);
if (unmatched.length) {
  console.log(`\n  Unmatched fields (highlighted in red):`);
  for (const u of unmatched.slice(0, 15)) console.log(`    - ${u}`);
  if (unmatched.length > 15) console.log(`    ... and ${unmatched.length - 15} more`);
}

console.log(`\n  Form pre-filled. Review and click Submit yourself.`);
console.log(`  (Browser stays open — close it when you're done.)\n`);

// Keep process alive until user closes the browser
await new Promise((resolve) => browser.on('disconnected', resolve));
console.log('  Browser closed. Exiting.\n');
