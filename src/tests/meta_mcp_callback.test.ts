/**
 * @jest-environment node
 */
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { GET } from '@/app/callback/p3oJPar44nR2/route';

async function renderCallback(query: string, clipboardFails = false) {
  const response = GET();
  const html = await response.text();
  const script = html.match(/<script>([\s\S]*?)<\/script>/)![1];
  const elements: Record<string, {
    textContent: string; hidden: boolean; value: string;
    focus: jest.Mock; select: jest.Mock; addEventListener: jest.Mock;
  }> = {};
  for (const id of ['heading', 'message', 'copy', 'fallback', 'callback', 'status']) {
    elements[id] = {
      textContent: '', hidden: true, value: '',
      focus: jest.fn(), select: jest.fn(), addEventListener: jest.fn(),
    };
  }
  const replaceState = jest.fn();
  const writeText = clipboardFails
    ? jest.fn().mockRejectedValue(new Error('Clipboard unavailable'))
    : jest.fn().mockResolvedValue(undefined);
  runInNewContext(script, {
    URL,
    window: {
      location: { href: 'https://socialview.coyo.com.br/callback/p3oJPar44nR2' + query },
      history: { replaceState },
    },
    document: { getElementById: (id: string) => elements[id] },
    navigator: { clipboard: { writeText } },
  });
  return { response, html, script, elements, replaceState, writeText };
}

describe('Meta MCP public callback', () => {
  it('hands the response to Codex on user action and clears browser history', async () => {
    const view = await renderCallback('?code=temporary-code&state=login-state&iss=https%3A%2F%2Fwww.facebook.com&redirect_uri=https%3A%2F%2Fevil.example');
    expect(view.replaceState).toHaveBeenCalledWith(null, '', '/callback/p3oJPar44nR2');
    expect(view.writeText).not.toHaveBeenCalled();
    expect(view.elements.copy.hidden).toBe(false);
    await view.elements.copy.addEventListener.mock.calls[0][1]();
    const callback = new URL(view.writeText.mock.calls[0][0]);
    expect(callback.origin).toBe('https://socialview.coyo.com.br');
    expect(callback.searchParams.get('code')).toBe('temporary-code');
    expect(callback.searchParams.get('state')).toBe('login-state');
    expect(callback.searchParams.get('iss')).toBe('https://www.facebook.com');
    expect(callback.searchParams.has('redirect_uri')).toBe(false);
    expect(view.html).not.toContain('temporary-code');
  });

  it('provides a selectable URL when clipboard access fails', async () => {
    const view = await renderCallback('?code=test-code&state=test-state', true);
    await view.elements.copy.addEventListener.mock.calls[0][1]();
    expect(view.elements.fallback.hidden).toBe(false);
    expect(view.elements.callback.value).toContain('code=test-code');
    expect(view.elements.callback.select).toHaveBeenCalled();
  });

  it.each(['', '?code=incomplete', '?error=access_denied&error_description=%3Cscript%3Ebad%3C%2Fscript%3E'])(
    'does not offer a successful callback for missing or rejected authorization (%s)',
    async (query) => {
      const view = await renderCallback(query);
      expect(view.elements.copy.hidden).toBe(true);
      expect(view.elements.copy.addEventListener).not.toHaveBeenCalled();
      expect(view.replaceState).toHaveBeenCalled();
    },
  );

  it('prevents caching, framing, third-party requests, and unapproved scripts', async () => {
    const view = await renderCallback('');
    expect(view.response.headers.get('cache-control')).toContain('no-store');
    expect(view.response.headers.get('referrer-policy')).toBe('no-referrer');
    const csp = view.response.headers.get('content-security-policy');
    expect(csp).toContain("connect-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("script-src 'sha256-" + createHash('sha256').update(view.script).digest('base64') + "'");
  });
});
