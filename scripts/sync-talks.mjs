import { readFileSync, writeFileSync } from 'node:fs';

const FEED_URL = process.env.TALKS_FEED_URL || 'https://rushabhshah.dev/speaking/talks.json';
const README_PATH = new URL('../README.md', import.meta.url);
const START_MARKER = '<!-- TALKS-LIST:START -->';
const END_MARKER = '<!-- TALKS-LIST:END -->';

const TALK_KINDS = new Set(['talk', 'lightning', 'workshop']);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Event names the feed can't shorten on its own (the source's natural name
// isn't the one this table has always used).
const EVENT_ABBREVIATIONS = {
  'FluxCon North America': 'FluxCon NA',
};

function formatDate(start) {
  const match = start.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?/);
  if (!match) return start;
  const [, year, month, day] = match;
  const mon = MONTHS[Number(month) - 1];
  return day ? `${Number(day)} ${mon} ${year}` : `${mon} ${year}`;
}

function displayEvent(event) {
  const stripped = event.replace(/\s+\d{4}$/, '');
  return EVENT_ABBREVIATIONS[stripped] ?? stripped;
}

function endsAt(talk) {
  if (talk.endDate) return Date.parse(`${talk.endDate}T23:59:59`);
  return Date.parse(talk.start);
}

function buildRow(talk) {
  const when = formatDate(talk.start);
  const event = `${displayEvent(talk.event)}, ${talk.city}`;
  const watch = talk.video ? ` · [▶ Watch](${talk.video})` : '';
  return `| ${when} | ${event} | ${talk.title}${watch} |`;
}

async function main() {
  const res = await fetch(FEED_URL);
  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  }

  const talks = await res.json();
  if (!Array.isArray(talks)) {
    throw new Error('Feed did not return an array');
  }

  const now = Date.now();
  const kept = talks.filter((talk) => {
    if (!TALK_KINDS.has(talk.kind)) return false;
    const upcoming = endsAt(talk) >= now;
    return upcoming || Boolean(talk.video);
  });

  kept.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));

  const table = ['| When | Event | Talk |', '|---|---|---|', ...kept.map(buildRow)].join('\n');
  const block = `${START_MARKER}\n${table}\n${END_MARKER}`;

  const readme = readFileSync(README_PATH, 'utf8');
  const pattern = new RegExp(`${START_MARKER}[\\s\\S]*?${END_MARKER}`);
  if (!pattern.test(readme)) {
    throw new Error('Talks markers not found in README.md');
  }

  const updated = readme.replace(pattern, block);
  writeFileSync(README_PATH, updated);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
