import { Card, Check, Deck, DeckFile, ZONES, countZone, fitsLegend } from './models';

export function validateDeck(deck: Deck, cards: Map<string, Card>): Check[] {
  const legend = cards.get(deck.legend ?? '');
  const champion = cards.get(deck.champion ?? '');
  const entries = ZONES.flatMap((zone) =>
    Object.entries(deck.zones[zone]).map(([id, quantity]) => ({
      card: cards.get(id),
      quantity,
      zone,
    })),
  );
  const named = new Map<string, number>();
  for (const { card, quantity, zone } of entries) {
    if (card && (zone === 'main' || zone === 'sideboard'))
      named.set(card.name, (named.get(card.name) ?? 0) + quantity);
  }
  const overCopies = [...named].filter(([, n]) => n > 3).map(([name]) => name);
  const illegal = entries
    .filter(({ card }) => card && !fitsLegend(card, legend))
    .map(({ card }) => card!.name);
  const banned = entries.filter(({ card }) => card?.banned).map(({ card }) => card!.name);
  const signatures = entries.filter(({ card }) => card?.signature);
  const wrongSignature = signatures.some(({ card }) => card?.champion !== legend?.champion);
  const signatureCount = signatures.reduce((n, row) => n + row.quantity, 0);
  const validZones = entries.every(
    ({ card, zone, quantity }) =>
      card &&
      Number.isInteger(quantity) &&
      quantity > 0 &&
      (zone === 'runes'
        ? card.type === 'rune'
        : zone === 'battlefields'
          ? card.type === 'battlefield' && quantity === 1
          : ['unit', 'spell', 'gear'].includes(card.type)),
  );
  const mainCount = countZone(deck, 'main');
  const runeCount = countZone(deck, 'runes');
  const fieldCount = countZone(deck, 'battlefields');
  const sideCount = countZone(deck, 'sideboard');
  return [
    {
      id: 'legend',
      label: 'Champion legend',
      pass: legend?.type === 'legend',
      detail: legend?.name ?? 'Choose one legend.',
    },
    {
      id: 'champion',
      label: 'Chosen champion',
      pass: !!(
        champion?.championUnit &&
        legend &&
        champion.champion === legend.champion &&
        deck.zones.main[champion.id]
      ),
      detail: champion?.name ?? 'Choose a champion unit matching your legend.',
    },
    {
      id: 'main',
      label: 'Main deck',
      pass: mainCount === 40,
      detail: `${mainCount} of 40 cards, including the chosen champion.`,
    },
    {
      id: 'runes',
      label: 'Rune deck',
      pass: runeCount === 12,
      detail: `${runeCount} of 12 runes.`,
    },
    {
      id: 'fields',
      label: 'Battlefields',
      pass: fieldCount === 3 && Object.values(deck.zones.battlefields).every((n) => n === 1),
      detail: `${fieldCount} of 3 different battlefields.`,
    },
    {
      id: 'copies',
      label: 'Copy limit',
      pass: !overCopies.length,
      detail: overCopies.length
        ? overCopies.join(', ')
        : 'Up to 3 of each name across main and sideboard.',
    },
    {
      id: 'domains',
      label: 'Domain identity',
      pass: !!legend && !illegal.length,
      detail: illegal.length
        ? [...new Set(illegal)].join(', ')
        : 'Every card fits your legend’s domains.',
    },
    {
      id: 'signature',
      label: 'Signature cards',
      pass: signatureCount <= 3 && !wrongSignature,
      detail: wrongSignature
        ? 'Signature cards must match your legend’s champion.'
        : `${signatureCount} of 3 signature cards across main and sideboard.`,
    },
    {
      id: 'banned',
      label: 'Constructed ban list',
      pass: !banned.length && !legend?.banned,
      detail: banned.length
        ? [...new Set(banned)].join(', ')
        : 'No cards on the recorded ban list.',
    },
    {
      id: 'sideboard',
      label: 'Sideboard',
      pass: sideCount <= 10,
      detail: `${sideCount} of up to 10 cards.`,
    },
    {
      id: 'zones',
      label: 'Card placement',
      pass: validZones,
      detail: validZones
        ? 'Cards are in the correct deck sections.'
        : 'A card is missing or in the wrong section.',
    },
    {
      id: 'special',
      label: 'Special construction rules',
      pass: !legend || !['Neeko'].includes(legend.champion ?? ''),
      detail:
        legend?.champion === 'Neeko'
          ? 'Neeko requires additional legend choices. Review the printed rules before playing.'
          : 'No additional legend choices required.',
    },
  ];
}

export function parseDeckFile(input: string, cards: Map<string, Card>): Deck {
  if (input.length > 200_000) throw new Error('This deck file is too large.');
  const value: unknown = JSON.parse(input);
  if (!value || typeof value !== 'object') throw new Error('Choose a deck exported from this app.');
  const file = value as Partial<DeckFile>;
  if (file.format !== 'riftbound-deck-builder' || file.version !== 1 || !file.deck)
    throw new Error('Unsupported deck format. Use a JSON export from this app.');
  const deck = file.deck;
  if (
    typeof deck.name !== 'string' ||
    !deck.name.trim() ||
    deck.name.length > 80 ||
    typeof deck.notes !== 'string' ||
    deck.notes.length > 4000 ||
    !deck.zones
  )
    throw new Error('The deck name or notes are invalid.');
  for (const id of [deck.legend, deck.champion])
    if (id !== null && (typeof id !== 'string' || !cards.has(id)))
      throw new Error('The deck contains a card not in this catalog.');
  for (const zone of ZONES) {
    const rows = deck.zones[zone];
    if (!rows || typeof rows !== 'object' || Array.isArray(rows) || Object.keys(rows).length > 150)
      throw new Error('A deck section is invalid.');
    for (const [id, n] of Object.entries(rows))
      if (!cards.has(id) || !Number.isInteger(n) || n < 1 || n > 40)
        throw new Error(`Invalid card or quantity in ${zone}.`);
  }
  return {
    ...deck,
    id: crypto.randomUUID(),
    name: deck.name.trim(),
    updatedAt: new Date().toISOString(),
  };
}

export function deckText(deck: Deck, cards: Map<string, Card>): string {
  const lines = [
    deck.name,
    '',
    `Legend: ${cards.get(deck.legend ?? '')?.name ?? 'Not selected'}`,
    `Champion: ${cards.get(deck.champion ?? '')?.name ?? 'Not selected'}`,
  ];
  const names = {
    main: 'Main deck',
    runes: 'Rune deck',
    battlefields: 'Battlefields',
    sideboard: 'Sideboard',
  };
  for (const zone of ZONES) {
    lines.push('', `${names[zone]} (${countZone(deck, zone)})`);
    for (const [id, quantity] of Object.entries(deck.zones[zone])) {
      const card = cards.get(id);
      if (card) lines.push(`${quantity} ${card.name} (${card.code})`);
    }
  }
  if (deck.notes.trim()) lines.push('', 'Notes', deck.notes.trim());
  return lines.join('\n');
}
