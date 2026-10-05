/**
 * The weekly report, start to finish, on a Monday morning.
 *
 *   collect → select → write → verify → check the links → gate → cover →
 *   publish, or hold and tell somebody.
 *
 * Nobody reads it before members do, which is the whole design constraint: the
 * gate refuses on anything it cannot confirm, and a held report is a quiet
 * Monday rather than a wrong one. The admin gets the email either way when
 * something was held, because a pipeline that fails silently is one that has
 * been broken for a month before anybody notices.
 *
 * `?dry=1` with the secret runs the whole thing and stores nothing, which is
 * how to look at it before trusting it with a Monday.
 */
import { collectWeek } from '../../lib/report-sources.js';
import { makeReport } from '../../lib/report-generate.js';
import { reportSlug } from '../../lib/reports.js';
import { makeCover } from '../../lib/report-cover.js';
import {
  nextReportNumber, recentReportTitles, coveredUrls, saveReport,
  lastReportWrittenAt, lastPublishedReportAt,
  digestAudience, optOuts, bouncedEmails
} from '../../lib/db.js';
import { MEMBERSHIP_UNLOCKS } from '../../lib/products.js';
import { audienceFor } from '../../lib/report-access.js';
import { sendReportPublished, sendReportHeld } from '../../lib/email.js';

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[cron/report] CRON_SECRET is not set — refusing to run.');
    return res.status(503).json({ error: 'not configured' });
  }
  if (req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'no_key', message: 'ANTHROPIC_API_KEY is not set.' });
  }

  const url = new URL(req.url, 'http://localhost');
  const dry = url.searchParams.get('dry') === '1';
  // Pressed by an admin rather than fired by the schedule. A person asking for
  // a second report this week has a reason; the clock does not.
  const force = url.searchParams.get('force') === '1';
  const started = Date.now();

  try {
    const [number, recentTitles, covered, recent, published] = await Promise.all([
      nextReportNumber(), recentReportTitles(8), coveredUrls(120),
      lastReportWrittenAt(), lastPublishedReportAt()
    ]);

    /* Two runs at once both take max+1, because that is what max+1 does. The
       first published and emailed; the second was held and wrote itself over
       the top, and the report named in the email stopped existing.

       The database now refuses that overwrite, which is the part that matters.
       This is the other half: a second run started within a couple of minutes
       of the last one is almost always a double press, and a Monday report is
       not something anybody needs twice in two minutes. */
    /* One report a week, and the week is counted from the last one published
       rather than from the calendar.

       This Monday's schedule fired at seven and built a second report hours
       after one had already gone out by hand. It was correctly held - the
       first report had claimed the week's news, so only two items were left
       for the second - but it should never have run, and somebody got an email
       about a report being held on a morning when a report had been sent.

       Not applied to a dry run, which stores nothing, nor to a run somebody
       pressed: a person asking for a second report this week has a reason, and
       the clock does not. */
    const WEEK = 6 * 864e5;
    if (!dry && !force && published && Date.now() - new Date(published).getTime() < WEEK) {
      const days = Math.floor((Date.now() - new Date(published).getTime()) / 864e5);
      return res.status(200).json({
        ok: true,
        skipped: `a report was published ${days === 0 ? 'today' : `${days} day(s) ago`}; `
          + 'one a week, so this run stands down',
        ms: Date.now() - started
      });
    }

    const SINCE_LAST = 120000;
    if (!dry && !force && recent && Date.now() - new Date(recent).getTime() < SINCE_LAST) {
      const ago = Math.round((Date.now() - new Date(recent).getTime()) / 1000);
      return res.status(200).json({
        ok: true,
        skipped: `a report was written ${ago} seconds ago; waiting a couple of minutes avoids two `
          + 'runs taking the same number',
        ms: Date.now() - started
      });
    }

    /* Two windows, one collection.
       The report is about the last eight days, but a quiet week should produce
       a shorter report rather than a padded one or no report at all - so a
       fortnight is collected and everything older than the week is marked.
       Those older items are available to fill a thin week and must be labelled
       on the page as a spotlight or a follow-up when they are used, which the
       gate checks rather than trusts. */
    const weekStart = Date.now() - 8 * 864e5;
    const { items, health } = await collectWeek({ since: Date.now() - 15 * 864e5, covered });
    for (const it of items) {
      it.thisWeek = !it.publishedAt || new Date(it.publishedAt).getTime() >= weekStart;
    }
    const fresh = items.filter((it) => it.thisWeek).length;
    const sourcesUp = health.filter((h) => h.ok).length;

    // Nothing to write about is a real answer. It is also the shape a broken
    // collector takes, so the two are told apart before deciding.
    if (items.length < 6) {
      const why = sourcesUp < 4
        ? `only ${sourcesUp} of ${health.length} sources answered`
        : `only ${items.length} new item(s) in a fortnight`;
      if (!dry) {
        await sendReportHeld({ number, reason: why, health })
          .catch((e) => console.error('[cron/report] held email', e?.message));
      }
      return res.status(200).json({ ok: true, skipped: why, health, ms: Date.now() - started });
    }

    // What a member can actually open, so "your move" points at their own
    // library rather than at the internet. Written for the membership rather
    // than for one person: a report is the same for everybody who reads it.
    const entitled = new Set(MEMBERSHIP_UNLOCKS);

    const out = await makeReport({
      number, collected: items, entitled, recentTitles,
      weekStart: new Date(weekStart).toISOString(), fresh
    });

    if (!out.gate.ok) {
      if (!dry) {
        if (out.report) {
          await saveReport({
            number, slug: reportSlug(number, out.report.title || 'held'),
            title: out.report.title || `Report ${number}`, topic: out.report.topic || 'what-changed',
            status: 'held', data: out.report, model: out.stats.model,
            stats: out.stats, fail: out.gate.fail
          });
        }
        await sendReportHeld({ number, reason: out.gate.fail.join('; '), health })
          .catch((e) => console.error('[cron/report] held email', e?.message));
      }
      return res.status(200).json({
        ok: false, held: true, number, fail: out.gate.fail,
        // The held report comes back too. It is the one somebody most wants to
        // read - a gate failure is a sentence about a report, not the report -
        // and on a dry run it is not written down anywhere else.
        report: out.report || null,
        dropped: out.dropped, cut: out.cut, stats: out.stats, ms: Date.now() - started
      });
    }

    const report = out.report;
    const cover = dry ? { url: null, kind: 'skipped' } : await makeCover({
      number, title: report.title, topic: report.topic
    });

    if (dry) {
      return res.status(200).json({
        ok: true, dry: true, number, report,
        cut: out.cut, dropped: out.dropped, stats: out.stats, health, ms: Date.now() - started
      });
    }

    const slug = reportSlug(number, report.title);
    await saveReport({
      number, slug, title: report.title, topic: report.topic, status: 'published',
      data: report, coverUrl: cover.url, coverKind: cover.kind,
      model: out.stats.model, stats: { ...out.stats, cover: cover.kind }
    });

    // Minus opt-outs and bounces, and minus anybody the reports are not open
    // to yet: telling a member their report is ready when they cannot open it
    // is worse than not telling them at all.
    const [audience, opted, bounced] = await Promise.all([digestAudience(), optOuts(), bouncedEmails()]);
    const blocked = new Set([...(opted || []), ...(bounced || [])].map((e) => String(e).toLowerCase()));
    const to = audienceFor(audience.filter((m) => !blocked.has(String(m.email).toLowerCase())));

    let sent = 0;
    for (const m of to) {
      try {
        await sendReportPublished(m.email, {
          name: m.name, number, slug, title: report.title, dek: report.dek,
          sixty: report.sixty, coverUrl: cover.url
        });
        sent++;
      } catch (err) {
        console.error('[cron/report] email', m.email, err?.message || err);
      }
    }

    return res.status(200).json({
      ok: true, number, slug, title: report.title, items: report.items.length,
      cover: cover.kind, emailed: sent, cut: out.cut, dropped: out.dropped,
      stats: out.stats, ms: Date.now() - started
    });
  } catch (err) {
    console.error('[cron/report]', err);
    // A pipeline that throws is a pipeline nobody hears about. Tell somebody.
    await sendReportHeld({ number: 0, reason: String(err.message || err).slice(0, 300), health: [] })
      .catch(() => {});
    return res.status(500).json({ error: 'server', message: String(err.message || err).slice(0, 300) });
  }
}
