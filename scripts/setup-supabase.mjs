#!/usr/bin/env node
// scripts/setup-supabase.mjs
//
// One-shot bootstrap for Bijan's Supabase project. Run AFTER you've applied
// supabase/migrations/0001_initial_schema.sql in the SQL Editor.
//
//   node scripts/setup-supabase.mjs
//
// Idempotent: safe to re-run.
//
// Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

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
  'Content-Type': 'application/json',
};

// ── helpers ───────────────────────────────────────────────────────────────
const log = {
  ok: (msg) => console.log(`  ✓ ${msg}`),
  skip: (msg) => console.log(`  → ${msg}`),
  fail: (msg) => console.log(`  ✗ ${msg}`),
  step: (msg) => console.log(`\n${msg}`),
};

async function ping() {
  log.step('1/4  Checking schema is applied');
  const tables = ['profile', 'jobs', 'evaluations', 'applications', 'cv_versions', 'form_answers', 'interview_questions'];
  for (const t of tables) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${t}?limit=0`, { headers });
    if (r.ok) {
      log.ok(`table ${t}`);
    } else {
      log.fail(`table ${t} — ${r.status} ${r.statusText}`);
      console.error(`\nApply supabase/migrations/0001_initial_schema.sql in the SQL Editor first.`);
      process.exit(1);
    }
  }
}

async function ensureBucket(name) {
  // Check existence
  const list = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, { headers });
  if (!list.ok) {
    log.fail(`storage list — ${list.status} ${list.statusText}`);
    return;
  }
  const buckets = await list.json();
  if (buckets.find((b) => b.name === name)) {
    log.skip(`bucket ${name} already exists`);
    return;
  }
  // Create
  const create = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ id: name, name, public: false }),
  });
  if (create.ok) {
    log.ok(`bucket ${name} created (private)`);
  } else {
    const text = await create.text();
    log.fail(`bucket ${name} — ${create.status} ${text}`);
  }
}

async function buckets() {
  log.step('2/4  Storage buckets');
  for (const name of ['cvs', 'screenshots', 'reports']) {
    await ensureBucket(name);
  }
}

async function seedProfile() {
  log.step('3/4  Seeding profile row');

  const existing = await fetch(`${SUPABASE_URL}/rest/v1/profile?select=id&limit=1`, { headers });
  const rows = existing.ok ? await existing.json() : [];
  if (rows.length > 0) {
    log.skip('profile row already exists — leaving it alone');
    return;
  }

  // Pick CV source: real cv.md if it exists, otherwise the example
  const cvPath = fs.existsSync(path.join(root, 'cv.md'))
    ? path.join(root, 'cv.md')
    : path.join(root, 'examples', 'cv-example.md');
  const cv_md = fs.readFileSync(cvPath, 'utf8');
  log.skip(`using ${path.relative(root, cvPath)} (${cv_md.length} chars)`);

  const goalsPath = path.join(root, 'config', 'profile.yml');
  const goals_md = fs.existsSync(goalsPath) ? fs.readFileSync(goalsPath, 'utf8') : null;

  const insert = await fetch(`${SUPABASE_URL}/rest/v1/profile`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({ cv_md, goals_md, archetypes: null }),
  });
  if (insert.ok) {
    log.ok('profile row inserted');
  } else {
    const text = await insert.text();
    log.fail(`profile insert — ${insert.status} ${text}`);
  }
}

async function summary() {
  log.step('4/4  Summary');
  for (const t of ['profile', 'jobs', 'evaluations', 'applications', 'cv_versions', 'form_answers', 'interview_questions']) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${t}?select=id`, {
      headers: { ...headers, Prefer: 'count=exact', Range: '0-0' },
    });
    const count = r.headers.get('content-range')?.split('/')[1] ?? '?';
    log.ok(`${t}: ${count} row(s)`);
  }
  console.log('\nReady. Next: continue with Phase 2 in plan.md.');
}

// ── run ───────────────────────────────────────────────────────────────────
await ping();
await buckets();
await seedProfile();
await summary();
