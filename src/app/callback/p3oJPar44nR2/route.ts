import { createHash } from 'node:crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// This page only hands the authorization response back to Codex.
// Codex owns PKCE, state validation, token exchange, and credential storage.
const script = "\n(() => {\n  const callback = new URL(window.location.href);\n  const params = callback.searchParams;\n  const heading = document.getElementById('heading');\n  const message = document.getElementById('message');\n  const button = document.getElementById('copy');\n  const fallback = document.getElementById('fallback');\n  const field = document.getElementById('callback');\n  const status = document.getElementById('status');\n  window.history.replaceState(null, '', callback.pathname);\n\n  if (params.has('error')) {\n    heading.textContent = 'Meta authorization was not completed';\n    message.textContent = params.get('error_description') || 'Authorization was declined or failed. Return to Codex and start a new sign-in attempt.';\n    return;\n  }\n  if (!params.get('code') || !params.get('state')) {\n    message.textContent = 'Start Meta Ads sign-in from Codex to use this callback page. If you refreshed after authorizing, start a new sign-in attempt.';\n    return;\n  }\n\n  const result = new URL(callback.origin + callback.pathname);\n  for (const name of ['code', 'state', 'iss']) {\n    const value = params.get(name);\n    if (value) result.searchParams.set(name, value);\n  }\n  heading.textContent = 'Finish connecting Meta Ads';\n  message.textContent = 'Copy the callback URL, return to the Codex terminal waiting for “Callback URL”, and paste it there. Codex will verify the response and finish sign-in.';\n  button.hidden = false;\n  button.addEventListener('click', async () => {\n    try {\n      await navigator.clipboard.writeText(result.href);\n      status.textContent = 'Copied. Paste it into the waiting Codex terminal.';\n    } catch {\n      fallback.hidden = false;\n      field.value = result.href;\n      field.focus();\n      field.select();\n      status.textContent = 'Select and copy the URL below, then paste it into the waiting Codex terminal.';\n    }\n  });\n})();\n";
const styles = "\n:root { color-scheme: light dark; font-family: system-ui, sans-serif; }\nbody { margin: 0; background: #111827; color: #f3f4f6; min-height: 100vh; display: grid; place-items: center; }\nmain { width: min(36rem, calc(100% - 3rem)); padding: 3rem 0; }\n.brand { color: #93c5fd; font-weight: 650; letter-spacing: .04em; }\nh1 { font-size: clamp(1.8rem, 5vw, 2.4rem); line-height: 1.2; }\np { line-height: 1.65; color: #d1d5db; }\nbutton { border: 0; border-radius: .6rem; background: #60a5fa; color: #111827; padding: .85rem 1.2rem; font: inherit; font-weight: 650; cursor: pointer; }\nbutton:focus-visible, textarea:focus-visible { outline: 3px solid #f9fafb; outline-offset: 4px; }\nlabel { display: block; margin: 1rem 0 .5rem; }\ntextarea { box-sizing: border-box; width: 100%; min-height: 8rem; padding: .75rem; font: inherit; }\n.note { font-size: .9rem; color: #9ca3af; }\n";
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>Connect Meta Ads · SocialView</title>
<style>${styles}</style>
</head>
<body>
<main>
<p class="brand">SocialView · Meta Ads</p>
<h1 id="heading">Meta Ads callback</h1>
<p id="message">Checking the authorization response…</p>
<button id="copy" type="button" hidden>Copy callback URL</button>
<p id="status" role="status" aria-live="polite"></p>
<div id="fallback" hidden>
<label for="callback">Callback URL</label>
<textarea id="callback" readonly spellcheck="false"></textarea>
</div>
<p class="note">This URL contains a temporary authorization code. Paste it only into the Codex sign-in prompt. Keep this page open until you have copied it; refreshing clears the response.</p>
<noscript><p>JavaScript is required. Enable it and start a new Meta sign-in attempt.</p></noscript>
</main>
<script>${script}</script>
</body>
</html>`;

export function GET() {
  const scriptHash = createHash('sha256').update(script).digest('base64');
  const styleHash = createHash('sha256').update(styles).digest('base64');

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': `default-src 'none'; script-src 'sha256-${scriptHash}'; style-src 'sha256-${styleHash}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; connect-src 'none'`,
    },
  });
}
