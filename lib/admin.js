/**
 * Who counts as staff.
 *
 * ADMIN_EMAILS is a comma-separated list, e.g.
 *   ADMIN_EMAILS=you@aifounderuniversity.com,support@aifounderuniversity.com
 *
 * Admins get the "Admin" badge on their comments and can delete anyone's
 * comment. Everything else about their account is a normal member account.
 */
export function adminEmails() {
  return String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdmin(email) {
  if (!email) return false;
  return adminEmails().includes(String(email).trim().toLowerCase());
}
