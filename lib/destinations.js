/**
 * Where a sign-in link may drop somebody, by key.
 *
 * A key rather than a path, and certainly not a URL: the destination arrives on
 * a query string that anybody can write, and a sign-in link that redirects
 * wherever it is told is an open redirect with extra steps. Anything not on
 * this list falls through to the member area.
 */
export const DESTINATIONS = {
  account: '/members/account.html',
  // Back to the consent screen for the Claude connector. The request being
  // approved is in a signed cookie, not on this URL, so there is nothing here
  // for somebody to point at a site of their own.
  connect: '/api/oauth/authorize'
};

/** The path for a key, or null. Never returns anything the caller supplied. */
export function destinationFor(key) {
  return Object.prototype.hasOwnProperty.call(DESTINATIONS, String(key ?? ''))
    ? DESTINATIONS[String(key)]
    : null;
}
