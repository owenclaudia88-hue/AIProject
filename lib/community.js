/**
 * The community's rooms.
 *
 * Four, deliberately. The failure mode for a community this size is twenty
 * empty rooms: the same number of posts spread thinly reads as abandoned,
 * where a few busy rooms read as alive. More can be added once there is
 * traffic that justifies them - taking one away later is much harder, because
 * the posts in it have to go somewhere.
 *
 * Each space earns its place by doing a job none of the others does.
 */
export const SPACES = {
  announcements: {
    label: 'Announcements',
    glyph: '📣',
    blurb: 'What is new at AI Founder University — new courses, new tools, what is coming.',
    // Everyone reads, only staff post. Replies stay open: an announcement
    // nobody can respond to is a notice board, not a community.
    postBy: 'admin',
    empty: 'Nothing announced yet.'
  },
  intros: {
    label: 'Introductions',
    glyph: '👋',
    blurb: 'New here? Say hello — what you are building, and what you want AI to take off your plate.',
    postBy: 'member',
    empty: 'Be the first to say hello.'
  },
  help: {
    label: 'Ask for help',
    glyph: '🙋',
    blurb: 'Stuck on a prompt, a tool or a lesson? Ask here — members and staff both answer.',
    postBy: 'member',
    // The only space where a thread has a job to finish, so it is the only one
    // that can be marked answered.
    resolvable: true,
    empty: 'No open questions right now.'
  },
  wins: {
    label: 'Wins',
    glyph: '🏆',
    blurb: 'Built something, landed a client, saved yourself a day? Post it here.',
    postBy: 'member',
    empty: 'No wins posted yet.'
  }
};

export const SPACE_KEYS = Object.keys(SPACES);

/** The default space for a question asked against a lesson. */
export const LESSON_SPACE = 'help';

export const spaceFor = (key) => SPACES[String(key ?? '')] || null;

/** Whether this member may start a thread in a space (replies are separate). */
export function canPostIn(key, { isAdmin } = {}) {
  const s = spaceFor(key);
  if (!s) return false;
  return s.postBy === 'admin' ? !!isAdmin : true;
}

/** What the member area needs to draw the nav and the space headers. */
export function spaceList() {
  return SPACE_KEYS.map((key) => ({
    key,
    label: SPACES[key].label,
    glyph: SPACES[key].glyph,
    blurb: SPACES[key].blurb,
    postBy: SPACES[key].postBy,
    resolvable: !!SPACES[key].resolvable,
    empty: SPACES[key].empty
  }));
}
