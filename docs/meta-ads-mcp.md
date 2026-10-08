# Meta Ads MCP callback

Publish SocialView, then register this exact URI in Meta app **1527710362301830** under Facebook Login for Business → Settings → Valid OAuth Redirect URIs:

```text
https://socialview.coyo.com.br/callback/p3oJPar44nR2
```

Enable Client OAuth Login and Web OAuth Login. If publishing to a different hostname, use that same HTTPS hostname both in Meta and in Codex.

In ~/.codex/config.toml, use:

```toml
[mcp_servers.meta-ads]
url = "https://mcp.facebook.com/ads"
scopes = ["ads_mcp_management", "ads_management"]

[mcp_servers.meta-ads.oauth]
client_id = "1527710362301830"
callback_url = "https://socialview.coyo.com.br/callback/p3oJPar44nR2"
```

Start sign-in with:

```sh
/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex mcp login meta-ads --scopes ads_mcp_management,ads_management --no-browser
```

Open the authorization URL printed by Codex. After approving Meta access, the callback page offers **Copy callback URL**. Paste the copied URL into the waiting terminal's hidden **Callback URL** prompt. Codex validates state and PKCE, exchanges the code, and stores credentials locally. Restart the MCP connection in Codex after successful authentication.

The public page does not exchange tokens, accept an arbitrary redirect target, write credentials to the database, or load analytics or third-party resources. It removes the query string from browser history after reading it, keeps the response in memory, and supplies a manual copy fallback. A refresh requires a new sign-in attempt.

Hosting infrastructure may log incoming request URLs before page JavaScript removes the query string. Configure the host to redact callback query parameters or exclude this path from request logs.

This endpoint is separate from SocialView's existing /api/auth/meta/callback integration. No additional environment variables or Meta app secrets are required for this handoff page.
