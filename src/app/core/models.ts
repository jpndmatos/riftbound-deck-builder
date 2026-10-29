export type CardType = 'legend' | 'unit' | 'spell' | 'gear' | 'rune' | 'battlefield';
export type Zone = 'main' | 'runes' | 'battlefields' | 'sideboard';
export interface Card {
  id: string;
  code: string;
  name: string;
  type: CardType;
  domains: string[];
  set: string;
  rarity: string;
  energy: number | null;
  might: number | null;
  champion: string | null;
  championUnit: boolean;
  signature: boolean;
  text: string;
  image: string;
  landscape: boolean;
  banned: boolean;
  aliases: string[];
}
export interface Catalog {
  source: string;
  updatedAt: string;
  rulesUpdatedAt: string;
  banlistUpdatedAt: string;
  printings: number;
  sets: { id: string; name: string }[];
  cards: Card[];
}
export interface Deck {
  id: string;
  name: string;
  legend: string | null;
  champion: string | null;
  notes: string;
  zones: Record<Zone, Record<string, number>>;
  updatedAt: string;
}
export interface DeckFile {
  format: 'riftbound-deck-builder';
  version: 1;
  deck: Deck;
}
export interface DeckRow {
  card: Card;
  quantity: number;
}
export interface Check {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
}
export const ZONES: Zone[] = ['main', 'runes', 'battlefields', 'sideboard'];
export const DOMAINS = ['fury', 'calm', 'mind', 'body', 'chaos', 'order'];
export const emptyDeck = (name = 'Untitled deck'): Deck => ({
  id: crypto.randomUUID(),
  name,
  legend: null,
  champion: null,
  notes: '',
  zones: { main: {}, runes: {}, battlefields: {}, sideboard: {} },
  updatedAt: new Date().toISOString(),
});
export const countZone = (deck: Deck, zone: Zone): number =>
  Object.values(deck.zones[zone]).reduce((sum, n) => sum + n, 0);
export const fitsLegend = (card: Card, legend: Card | undefined): boolean =>
  !legend || card.domains.every((d) => legend.domains.includes(d));
export const imageUrl = (card: Card, width = 320): string => {
  const url = new URL(card.image);
  url.searchParams.set('w', String(width));
  url.searchParams.set('auto', 'format');
  url.searchParams.set('q', '82');
  return url.toString();
};
