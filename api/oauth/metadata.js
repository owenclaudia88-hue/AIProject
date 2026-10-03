/**
 * The two discovery documents a client reads before it can ask for a token.
 *
 * Both are served from here and routed to by rewrites in vercel.json, because
 * they have to live under /.well-known at the site root and functions live
 * under /api. `doc` says which one is wanted.
 *
 *   /.well-known/oauth-protected-resource            -> doc=resource
 *   /.well-known/oauth-protected-resource/api/mcp    -> doc=resource
 *   /.well-known/oauth-authorization-server          -> doc=as
 *
 * A client reads the first to learn where the authorization server is, then the
 * second to learn its endpoints. Both are public: they describe how to start
 * asking for access, not how to get it.
 */
import { siteUrl, resourceUrl, SCOPE } from '../../lib/oauth.js';

export default function handler(req, res) {
  const site = siteUrl();
  const doc = new URL(req.url, 'http://localhost').searchParams.get('doc');

  res.setHeader('Content-Type', 'application/json');
  // Public and stable. Cached briefly so a reconnect does not re-fetch, but not
  // so long that changing an endpoint takes a day to take effect.
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (doc === 'as') {
    // RFC 8414. `issuer` must match the URL this was fetched from, or a client
    // is required to reject the document.
    return res.status(200).json({
      issuer: site,
      authorization_endpoint: `${site}/api/oauth/authorize`,
      token_endpoint: `${site}/api/oauth/token`,
      registration_endpoint: `${site}/api/oauth/register`,
      scopes_supported: [SCOPE],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      // S256 only. `plain` is still in the wild and is not worth accepting.
      code_challenge_methods_supported: ['S256'],
      // Public clients with PKCE. There is no client secret to present.
      token_endpoint_auth_methods_supported: ['none'],
      authorization_response_iss_parameter_supported: true,
      service_documentation: `${site}/members/connect.html`
    });
  }

  // RFC 9728. Says which authorization server to go and talk to.
  return res.status(200).json({
    resource: resourceUrl(),
    authorization_servers: [site],
    scopes_supported: [SCOPE],
    bearer_methods_supported: ['header'],
    resource_documentation: `${site}/members/connect.html`
  });
}
