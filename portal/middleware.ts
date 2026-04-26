import { NextRequest, NextResponse } from 'next/server';

// Single-user portal, no real auth. We gate the whole site with HTTP basic
// auth using BIJAN_AUTH_USER / BIJAN_AUTH_PASSWORD env vars. If either is
// unset (e.g., local dev), the middleware no-ops and the portal is open.
//
// To enable in production, set both vars in Vercel.

export function middleware(req: NextRequest) {
  const user = process.env.BIJAN_AUTH_USER;
  const password = process.env.BIJAN_AUTH_PASSWORD;

  // Local dev or unconfigured: skip.
  if (!user || !password) return NextResponse.next();

  const header = req.headers.get('authorization');
  if (header) {
    const [scheme, encoded] = header.split(' ');
    if (scheme === 'Basic' && encoded) {
      try {
        const decoded = atob(encoded);
        const idx = decoded.indexOf(':');
        if (idx !== -1) {
          const u = decoded.slice(0, idx);
          const p = decoded.slice(idx + 1);
          if (u === user && p === password) {
            return NextResponse.next();
          }
        }
      } catch {
        // fall through to 401
      }
    }
  }

  return new NextResponse('Authentication required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Bijan"' },
  });
}

export const config = {
  // Run on every route except Next internals, static assets, favicon.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
