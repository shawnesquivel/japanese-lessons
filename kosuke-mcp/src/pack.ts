import type { CardInput, FlashcardPack, PackInput } from "./schema.js";
import { cardInputSchema, packInputSchema, packSchema } from "./schema.js";

export function slug(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "pack";
}

function uniqueId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`;
}

function normalizeCards(cards: CardInput[]): FlashcardPack["cards"] {
  const seen = new Set<string>();
  return cards.map((rawCard, index) => {
    const card = cardInputSchema.parse(rawCard);
    const base = card.id || `${slug(card.romaji)}-${index + 1}`;
    let id = base;
    let suffix = 2;
    while (seen.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    seen.add(id);
    return { ...card, id };
  });
}

export function createPack(input: PackInput): FlashcardPack {
  const parsed = packInputSchema.parse(input);
  const now = new Date().toISOString();
  return packSchema.parse({
    ...parsed,
    id: parsed.id || uniqueId(slug(parsed.title)),
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    cards: normalizeCards(parsed.cards),
  });
}

export function appendCards(pack: FlashcardPack, inputs: CardInput[]): FlashcardPack {
  const existingIds = new Set(pack.cards.map((card) => card.id));
  const additions = normalizeCards(inputs).map((card) => {
    const base = card.id;
    let id = base;
    let suffix = 2;
    while (existingIds.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    existingIds.add(id);
    return { ...card, id };
  });
  return packSchema.parse({
    ...pack,
    cards: pack.cards.concat(additions),
    updatedAt: new Date().toISOString(),
  });
}
