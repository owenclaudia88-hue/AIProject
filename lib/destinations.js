/**
 * Where a sign-in link may drop somebody, by key.
 *
 * A key rather than a path, and certainly not a URL: the destination arrives on
 * a query string that anybody can write, and a sign-in link that redirects
 * wherever it is told is an open redirect with extra steps. Anything not on
 * this list falls through to the member area.
 */
export const DESTINATIONS = {
  account: '/members/account.html'
};

/** The path for a key, or null. Never returns anything the caller supplied. */
export function destinationFor(key) {
  return Object.prototype.hasOwnProperty.call(DESTINATIONS, String(key ?? ''))
    ? DESTINATIONS[String(key)]
    : null;
}
