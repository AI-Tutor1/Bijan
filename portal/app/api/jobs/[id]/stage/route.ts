import { NextResponse } from 'next/server';

// Force Node runtime — this route uses child_process which is unavailable
// on Edge.
export const runtime = 'nodejs';

// Spawns ../stage-form.mjs <jobId> as a detached process so it survives the
// API response. The script opens a visible Chromium window and never submits.
// The user clicks Submit themselves.
//
// IMPORTANT: this only works when the portal runs on the same machine the
// user is sitting at — i.e. localhost. On Vercel this route would have no
// display to open a browser into. For deployment, the workflow is:
//   1. Click Approve → just sets triage='approve'.
//   2. Run `node stage-form.mjs <id>` on your local box.

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'jobId required' }, { status: 400 });

  // On Vercel (or any host without a display + Playwright + the parent repo),
  // we can't spawn the visible-Chromium runner. Tell the user to run it on
  // their own machine.
  if (process.env.VERCEL) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Stage runner requires a local display. Run on your machine: `node stage-form.mjs ' + id + '`',
        local_command: `node stage-form.mjs ${id}`,
      },
      { status: 501 },
    );
  }

  // Use dynamic imports + runtime path construction so Turbopack doesn't
  // try to resolve the spawn target as a module at build time.
  const { spawn } = await import('node:child_process');
  const path = await import('node:path');
  const repoRoot = path.resolve(process.cwd(), '..');
  const scriptName = ['stage-form', 'mjs'].join('.');
  const scriptPath = [repoRoot, scriptName].join(path.sep);

  try {
    const child = spawn(process.execPath, [scriptPath, id], {
      cwd: repoRoot,
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
    return NextResponse.json({ ok: true, pid: child.pid });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
