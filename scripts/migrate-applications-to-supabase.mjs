#!/usr/bin/env node
// scripts/migrate-applications-to-supabase.mjs
//
// One-shot import: reads data/applications.md and inserts each row into
// Supabase tables (jobs + applications). Idempotent on jobs.source_url —
// re-running won't create duplicates.
//
//   node scripts/migrate-applications-to-supabase.mjs
//
// If data/applications.md doesn't exist or is empty, exits cleanly. If a row
// has a Report link, the script reads the report file and extracts the
// **URL:** header for source_url. Otherwise it falls back to a synthetic
// stable key derived from company+role+date.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
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

// ── input check ───────────────────────────────────────────────────────────
const trackerPath = path.join(root, 'data', 'applications.md');
if (!fs.existsSync(trackerPath)) {
  console.log('→ data/applications.md not found. Nothing to migrate. Exiting cleanly.');
  process.exit(0);
}
const tracker = fs.readFileSync(trackerPath, 'utf8').trim();
if (!tracker) {
  console.log('→ data/applications.md is empty. Nothing to migrate.');
  process.exit(0);
}

// ── lifecycle status mapping (states.yml aliases → canonical id) ─────────
const STATUS_MAP = {
  evaluada: 'evaluated', evaluated: 'evaluated',
  aplicado: 'applied', aplicada: 'applied', applied: 'applied', enviada: 'applied', sent: 'applied',
  respondido: 'responded', responded: 'responded',
  entrevista: 'interview', interview: 'interview',
  oferta: 'offer', offer: 'offer',
  rechazado: 'rejected', rechazada: 'rejected', rejected: 'rejected',
  descartado: 'discarded', descartada: 'discarded', cerrada: 'discarded', cancelada: 'discarded', discarded: 'discarded',
  'no aplicar': 'skip', no_aplicar: 'skip', skip: 'skip', monitor: 'skip',
};
const TRIAGE_MAP = {
  approve: 'approve', aprobado: 'approve', aprobar: 'approve',
  reject: 'reject', rechazar: 'reject',
  manual: 'manual',
};

// ── parse markdown table ──────────────────────────────────────────────────
function parseTable(md) {
  const lines = md.split('\n').filter((l) => l.trim().startsWith('|'));
  if (lines.length < 2) return [];
  const headers = lines[0].split('|').map((h) => h.trim().toLowerCase()).filter(Boolean);
  // Skip header + separator
  return lines.slice(2).map((line) => {
    const cells = line.split('|').map((c) => c.trim()).slice(1, -1);
    const row = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ''));
    return row;
  });
}

const rows = parseTable(tracker);
if (rows.length === 0) {
  console.log('→ No rows in applications.md after header. Nothing to migrate.');
  process.exit(0);
}
console.log(`Found ${rows.length} row(s) in data/applications.md\n`);

// ── helpers ───────────────────────────────────────────────────────────────
function extractReportUrl(reportCell) {
  // Cell format: `[001](reports/001-foo-2026-01-01.md)` — read file, find **URL:**
  const m = reportCell.match(/\(([^)]+\.md)\)/);
  if (!m) return null;
  const reportPath = path.join(root, m[1]);
  if (!fs.existsSync(reportPath)) return null;
  const content = fs.readFileSync(reportPath, 'utf8');
  const urlMatch = content.match(/^\*\*URL:\*\*\s*(.+)$/m);
  return urlMatch ? urlMatch[1].trim() : null;
}

function syntheticUrl(row) {
  const slug = `${row.empresa || row.company || 'unknown'}-${row.rol || row.role || 'role'}-${row.fecha || row.date || 'nodate'}`
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-');
  const hash = crypto.createHash('sha256').update(slug).digest('hex').slice(0, 8);
  return `bijan://imported/${slug}-${hash}`;
}

function normalizeStatus(raw) {
  const key = (raw || '').toLowerCase().replace(/^\*+|\*+$/g, '').trim();
  return STATUS_MAP[key] || 'evaluated';
}

function normalizeTriage(raw) {
  const key = (raw || '').toLowerCase().trim();
  return TRIAGE_MAP[key] || null;
}

async function upsertJob({ source_url, company, title }) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/jobs`, {
    method: 'POST',
    headers: {
      ...headers,
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify({ source_url, company, title, source_type: 'manual_url' }),
  });
  if (!r.ok) throw new Error(`upsert jobs ${source_url} → ${r.status} ${await r.text()}`);
  const [job] = await r.json();
  return job.id;
}

async function upsertApplication({ job_id, triage, status }) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/applications?on_conflict=job_id`, {
    method: 'POST',
    headers: {
      ...headers,
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify({ job_id, triage, status }),
  });
  if (!r.ok) throw new Error(`upsert applications ${job_id} → ${r.status} ${await r.text()}`);
}

// ── run ───────────────────────────────────────────────────────────────────
let imported = 0;
let skipped = 0;

for (const row of rows) {
  const company = row.empresa || row.company || null;
  const title = row.rol || row.role || null;
  if (!company && !title) {
    skipped++;
    continue;
  }

  const url = extractReportUrl(row.report || '') || syntheticUrl(row);
  const status = normalizeStatus(row.estado || row.status);
  const triage = normalizeTriage(row.triage);

  try {
    const job_id = await upsertJob({ source_url: url, company, title });
    await upsertApplication({ job_id, triage, status });
    console.log(`  ✓ ${(company || '').padEnd(20)} ${(title || '').padEnd(30)} → ${status}${triage ? ' / ' + triage : ''}`);
    imported++;
  } catch (e) {
    console.log(`  ✗ ${company} / ${title} — ${e.message}`);
    skipped++;
  }
}

console.log(`\nImported ${imported}, skipped ${skipped}.`);
