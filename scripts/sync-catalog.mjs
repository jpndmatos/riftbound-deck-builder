import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const source = 'https://playriftbound.com/en-us/card-gallery/';
let raw;
if (process.argv[2]) raw = JSON.parse(await readFile(process.argv[2], 'utf8'));
else {
  const response = await fetch(source);
  if (!response.ok) throw new Error(`Gallery returned ${response.status}`);
  const html = await response.text();
  const payload = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!payload) throw new Error('Gallery payload not found. Existing catalog was preserved.');
  raw = JSON.parse(payload[1]).props.pageProps.page.blades.find(
    (blade) => blade.type === 'riftboundCardGallery',
  )?.cards?.items;
}
if (!Array.isArray(raw) || raw.length < 100) throw new Error('Incomplete gallery response');
const banned = new Set(
  [
    'Called Shot',
    'Ekko, Recurrent',
    'Draven, Vanquisher',
    'Fight or Flight',
    'Scrapheap',
    'Stealthy Pursuer',
    'Stacked Deck',
    'The Arena’s Greatest',
    'Aspirant’s Climb',
    'Dreaming Tree',
    'Obelisk of Power',
    'Reaver’s Row',
  ].map(normalize),
);
function normalize(value) {
  return value
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]/g, '');
}
const plain = (text) =>
  (text || '')
    .replace(/<br\s*\/?>|<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/:rb_energy_(\d+):/g, '[$1 energy]')
    .replace(/:rb_rune_(\w+):/g, '[$1]')
    .replace(/:rb_might:/g, 'might')
    .replace(/:rb_exhaust:/g, '[Exhaust]')
    .trim();
const sets = new Map();
const grouped = new Map();
const championNames = new Set(
  raw
    .filter((card) => card.cardType?.superType?.some((type) => type.id === 'champion'))
    .map((card) => card.name),
);
const championOf = (card) => card.tags?.tags?.find((tag) => championNames.has(tag)) ?? null;
let previousIds = new Map();
try {
  const previous = JSON.parse(await readFile('public/data/cards.json', 'utf8'));
  previousIds = new Map(previous.cards.map((card) => [`${card.type}:${card.name}`, card.id]));
} catch {
  /* A first sync has no catalog to preserve. */
}
const fullName = (card) => {
  const type = card.cardType?.type?.[0]?.id;
  const champion = card.cardType?.superType?.some((item) => item.id === 'champion');
  const namedLegend = type === 'legend' && card.name === championOf(card);
  // Signature-card subtitles identify their owner, not an extra part of the name.
  return card.subtitle && (champion || namedLegend) ? `${card.name}, ${card.subtitle}` : card.name;
};
const tokenNames = new Set(raw.filter((c) => /-T\d/i.test(c.publicCode || '')).map((c) => c.name));
for (const c of raw) {
  const type = c.cardType?.type?.[0]?.id;
  const supers = (c.cardType?.superType || []).map((s) => s.id);
  if (
    !['legend', 'unit', 'spell', 'gear', 'rune', 'battlefield'].includes(type) ||
    supers.includes('token') ||
    tokenNames.has(c.name) ||
    !c.cardImage?.url
  )
    continue;
  const set = c.set?.value;
  sets.set(set.id, set.label);
  const key = `${type}:${fullName(c)}`;
  const group = grouped.get(key) || [];
  group.push(c);
  grouped.set(key, group);
}
const cards = [...grouped.values()]
  .map((group) => {
    const previousId = previousIds.get(`${group[0].cardType.type[0].id}:${fullName(group[0])}`);
    group.sort((a, b) => {
      const rank = (c) =>
        (c.id === previousId ? -100 : 0) +
        (/\*|\d[a-z]\//i.test(c.publicCode || '') ? 5 : 0) +
        (['showcase', 'alternateart', 'overnumbered'].includes(c.rarity?.value?.id) ? 3 : 0);
      return rank(a) - rank(b) || a.collectorNumber - b.collectorNumber;
    });
    const c = group[0];
    const supers = (c.cardType?.superType || []).map((s) => s.id);
    return {
      id: c.id,
      code: c.publicCode,
      name: fullName(c),
      type: c.cardType.type[0].id,
      domains: (c.domain?.values || []).map((d) => d.id).filter((d) => d !== 'colorless'),
      set: c.set.value.id,
      rarity: c.rarity?.value?.label || '',
      energy: c.energy?.value?.id ?? null,
      might: c.might?.value?.id ?? null,
      champion: championOf(c),
      championUnit: supers.includes('champion'),
      signature: supers.includes('signature'),
      text: plain(c.text?.richText?.body || c.cardImage.accessibilityText),
      image: c.cardImage.url,
      landscape: c.orientation === 'landscape',
      banned: banned.has(normalize(fullName(c))),
      aliases: [...new Set(group.flatMap((v) => [v.id, v.publicCode]))],
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));
const catalog = {
  source,
  updatedAt: new Date().toISOString().slice(0, 10),
  rulesUpdatedAt: '2026-10-09',
  banlistUpdatedAt: '2026-09-18',
  printings: raw.length,
  sets: [...sets].map(([id, name]) => ({ id, name })),
  cards,
};
await mkdir('public/data', { recursive: true });
const serialized = JSON.stringify(catalog);
await writeFile('public/data/cards.json', serialized);
const version = createHash('sha256').update(serialized).digest('hex').slice(0, 10);
await mkdir('src/app/core', { recursive: true });
await writeFile(
  'src/app/core/catalog-version.ts',
  `// Generated by catalog:sync.\nexport const CATALOG_URL = 'data/cards.json?v=${version}';\n`,
);
console.log(`${cards.length} unique cards from ${raw.length} printings. Catalog written.`);
