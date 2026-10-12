import { reportAudience, optOuts, bouncedEmails, notifyReport } from './db.js';
import { audienceFor } from './report-access.js';
import { sendReportPublished } from './email.js';

/**
 * Tell the members a report exists: the bell first, then the email.
 *
 * It lives here because there are two ways a report gets published — the
 * Monday run, and an admin pressing publish on one that was held — and only
 * the first of them used to say anything. A report published by hand went
 * live on the site and reached nobody at all, which is the worst of both: the
 * work was done, the members never knew, and nothing in the admin said so.
 *
 * Everybody the report is open to gets the bell, including the people who
 * have unsubscribed from email or whose address has bounced: those are
 * decisions about their inbox, not about their member area, and somebody who
 * asked us to stop writing to them has not asked to stop being told inside
 * the product they pay for. The email is the narrower list.
 */
export async function announceReport({ number, slug, title, dek, sixty = [], coverUrl = null }) {
  const [audience, opted, bounced] = await Promise.all([
    reportAudience(), optOuts(), bouncedEmails()
  ]);
  const everyone = audienceFor(audience);

  const notified = await notifyReport(everyone.map((m) => m.email), number, title)
    .catch((e) => { console.error('[report-announce] bell:', e?.message); return 0; });

  const blocked = new Set([...(opted || []), ...(bounced || [])].map((e) => String(e).toLowerCase()));
  const to = everyone.filter((m) => !blocked.has(String(m.email).toLowerCase()));

  let emailed = 0;
  const failed = [];
  for (const m of to) {
    try {
      await sendReportPublished(m.email, {
        name: m.name, number, slug, title, dek, sixty, coverUrl
      });
      emailed++;
    } catch (err) {
      console.error('[report-announce] email', m.email, err?.message || err);
      failed.push({ email: m.email, why: String(err?.message || err).slice(0, 120) });
    }
  }

  console.log(`[report-announce] report ${number}: rang ${notified}, emailed ${emailed} of ${to.length}`);
  return { audience: everyone.length, notified, emailed, skipped: blocked.size, failed };
}
