// Minimal HTML→text extractor for job description URLs.
// Doesn't need Playwright — just fetch + strip. Good enough for static
// careers pages (Greenhouse, Ashby, Lever, Workday, simple HTML). For
// dynamic SPAs, the user can paste the JD text directly into intake.

export async function fetchJobDescription(url: string): Promise<string> {
  const r = await fetch(url, {
    redirect: 'follow',
    headers: {
      // Some ATSs block default fetch UA
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
    },
  });
  if (!r.ok) throw new Error(`fetch ${url} → ${r.status} ${r.statusText}`);
  const html = await r.text();
  return htmlToText(html);
}

function htmlToText(html: string): string {
  return html
    // strip script/style blocks
    .replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    // turn <br> and block-end tags into newlines
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|article|section)>/gi, '\n')
    // strip remaining tags
    .replace(/<[^>]+>/g, ' ')
    // decode common entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // collapse whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
