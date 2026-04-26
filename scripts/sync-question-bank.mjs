#!/usr/bin/env node
// scripts/sync-question-bank.mjs
//
// Reads a fenced ```bijan-questions JSON block from an interview-prep markdown
// file and upserts each row into the Supabase `interview_questions` table.
//
//   node scripts/sync-question-bank.mjs interview-prep/foo-bar.md [source_job_id]
//
// Idempotent: dedup is by normalized (lowercased, single-spaced) question text.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// ── env ───────────────────────────────────────────────────────────────────
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
  console.error('✗ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

// ── args ──────────────────────────────────────────────────────────────────
const file = process.argv[2];
const jobId = process.argv[3] || null;
if (!file) {
  console.error('Usage: node scripts/sync-question-bank.mjs <markdown-file> [job_id]');
  process.exit(1);
}
const fullPath = path.isAbsolute(file) ? file : path.join(root, file);
if (!fs.existsSync(fullPath)) {
  console.error(`✗ Not found: ${fullPath}`);
  process.exit(1);
}

const md = fs.readFileSync(fullPath, 'utf8');

// ── parse fenced block ────────────────────────────────────────────────────
const match = md.match(/```bijan-questions\s*\n([\s\S]*?)\n```/);
if (!match) {
  console.error('✗ No ```bijan-questions block found in the file.');
  process.exit(1);
}

let entries;
try {
  entries = JSON.parse(match[1]);
} catch (e) {
  console.error(`✗ Invalid JSON in bijan-questions block: ${e.message}`);
  process.exit(1);
}
if (!Array.isArray(entries)) {
  console.error('✗ JSON must be an array.');
  process.exit(1);
}

// ── normalize + fetch existing for dedup ──────────────────────────────────
const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

const existingRes = await fetch(`${SUPABASE_URL}/rest/v1/interview_questions?select=id,question`, { headers });
if (!existingRes.ok) {
  console.error(`✗ Fetching existing rows: ${existingRes.status} ${await existingRes.text()}`);
  process.exit(1);
}
const existing = await existingRes.json();
const seen = new Map(existing.map((r) => [norm(r.question), r.id]));

// ── upsert each ───────────────────────────────────────────────────────────
let inserted = 0;
let skipped = 0;

for (const e of entries) {
  if (!e.question || !e.answer) {
    skipped++;
    continue;
  }
  if (seen.has(norm(e.question))) {
    skipped++;
    continue;
  }
  const body = {
    question: e.question,
    answer: e.answer,
    tags: Array.isArray(e.tags) ? e.tags : [],
    source_job_id: jobId,
  };
  const r = await fetch(`${SUPABASE_URL}/rest/v1/interview_questions`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (r.ok) {
    inserted++;
    console.log(`  ✓ ${e.question.slice(0, 70)}`);
  } else {
    console.log(`  ✗ ${e.question.slice(0, 70)} — ${r.status} ${await r.text()}`);
  }
}

console.log(`\nInserted ${inserted}, skipped ${skipped} (already in bank or invalid).`);
