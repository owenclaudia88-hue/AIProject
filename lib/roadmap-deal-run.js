import { roadmapsPublishedBetween, addRoadmapNote, notifyRoadmapReply, outreachLog, recordOutreach,
         optOuts, bouncedEmails, listEntitled, getSettings, setSetting } from './db.js';
import { sendRoadmapDeal } from './email.js';
import { sanitizeHtml } from './sanitize-html.js';
import { FUNNEL_ENGINE } from './products.js';
import { DEAL_HOURS, DEAL_KIND, DEAL_24H_KIND, DEAL_1H_KIND, dealCheckoutUrl, dealNoteHtml } from './roadmap-deal.js';

/**
 * The roadmap members' price, run from the 30-minute cron (api/cron/fe-launch).
 *
 *   - An hour after a roadmap is published, a message from the team goes up
 *     under it: what the roadmap gives them, what it cannot, and the Funnel
 *     Engine at 20% off for 48 hours. The bell rings and an email says it is
 *     there. An hour, so it does not land in the same minute as "your roadmap
 *     is ready".
 *   - With a day left, and again with an hour left, a short reminder.
 *
 * Once per member, ever: keyed on the address in the outreach log, so a
 * republished roadmap does not restart the clock. Owning the Funnel Engine
 * ends it. Only roadmaps published after the first run: the ones already
 * published were never told about a price, and a message turning up on an old
 * plan would read oddly.
 */

const H = 3600e3;
const SEND_AFTER = 1 * H;
const SUPPORT = 'support@aifounderuniversity.com';
const site = () => (process.env.SITE_URL || 'https://aifounderuniversity.com').replace(/\/+$/, '');
// Whole minutes, so the time in the message, the link and the reminders agree.
const endsFrom = (t0) => Math.floor((t0 + DEAL_HOURS * H) / 60000) * 60000;

/** Addresses inside their 48 hours right now. The other sequences step aside for them. */
export async function activeDealEmails(now = Date.now()) {
  const log = await outreachLog(DEAL_KIND);
  const out = new Set();
  for (const [email, at] of log) if (now < endsFrom(new Date(at).getTime())) out.add(email);
  return out;
}

/** The member's deal, if one is running: { url, endsAt }. */
export async function dealFor(email, now = Date.now()) {
  const at = (await outreachLog(DEAL_KIND)).get(String(email).toLowerCase());
  if (!at) return null;
  const endsAt = endsFrom(new Date(at).getTime());
  return now < endsAt ? { url: dealCheckoutUrl(site(), email, endsAt), endsAt } : null;
}

export async function runRoadmapDeals({ now = Date.now(), dry = false, since } = {}) {
  // `since` is for a dry run that asks "who would it have picked" over a past window.
  const settings = since ? { rm_deal_since: since } : await getSettings();
  if (!settings.rm_deal_since) {
    if (!dry) await setSetting('rm_deal_since', new Date(now).toISOString());
    return { started: true, opened: 0, reminded: 0 };
  }

  const [roadmaps, owners, opted, bounced, opened, sent24, sent1] = await Promise.all([
    roadmapsPublishedBetween(settings.rm_deal_since, new Date(now - SEND_AFTER).toISOString()),
    listEntitled(FUNNEL_ENGINE), optOuts(), bouncedEmails(),
    outreachLog(DEAL_KIND), outreachLog(DEAL_24H_KIND), outreachLog(DEAL_1H_KIND)
  ]);
  const owns = new Set(owners.map((o) => o.email));
  const noMail = new Set([...(opted || []), ...(bounced || [])].map((e) => String(e).toLowerCase()));
  const report = { opened: [], reminded24: [], reminded1: [], failed: [] };

  // The message, once per member.
  for (const r of roadmaps) {
    if (owns.has(r.email) || opened.has(r.email)) continue;
    const endsAt = endsFrom(now);
    const url = dealCheckoutUrl(site(), r.email, endsAt);
    if (dry) { report.opened.push(r.email); continue; }
    const body = sanitizeHtml(dealNoteHtml({
      name: r.name, offer: r.published?.offer || null,
      hours: (r.answers || {})['resources.hours'], url, endsAt
    }), { maxLength: 4000 });
    try {
      await addRoadmapNote({ roadmapId: r.id, email: SUPPORT, isAdmin: true, body });
      // Recorded straight after the note, before anything that can fail: a
      // second note on the next run would be worse than a missed email.
      await recordOutreach(r.email, DEAL_KIND);
      opened.set(r.email, new Date(now));
      await notifyRoadmapReply(r.email, r.published?.goal || null);
      if (!noMail.has(r.email)) await sendRoadmapDeal(r.email, 'open', { name: r.name, url, endsAt });
      report.opened.push(r.email);
    } catch (err) {
      console.error('[roadmap-deal] open failed', r.email, err?.message || err);
      report.failed.push(r.email);
    }
  }

  // The two reminders, timed from when the message went up.
  for (const [email, at] of opened) {
    if (owns.has(email) || noMail.has(email)) continue;
    const t0 = new Date(at).getTime();
    const endsAt = endsFrom(t0);
    const which = now >= endsAt - 1 * H && now < endsAt && !sent1.has(email) ? '1h'
      : now >= t0 + 24 * H && now < endsAt - 1 * H && !sent24.has(email) ? '24h' : null;
    if (!which) continue;
    if (dry) { report[which === '1h' ? 'reminded1' : 'reminded24'].push(email); continue; }
    try {
      const name = roadmaps.find((r) => r.email === email)?.name || null;
      await sendRoadmapDeal(email, which === '1h' ? 'h1' : 'h24', {
        name, url: dealCheckoutUrl(site(), email, endsAt), endsAt
      });
      await recordOutreach(email, which === '1h' ? DEAL_1H_KIND : DEAL_24H_KIND);
      report[which === '1h' ? 'reminded1' : 'reminded24'].push(email);
    } catch (err) {
      console.error('[roadmap-deal] reminder failed', which, email, err?.message || err);
      report.failed.push(email);
    }
  }
  return {
    opened: report.opened.length, reminded24: report.reminded24.length,
    reminded1: report.reminded1.length, failed: report.failed
  };
}
