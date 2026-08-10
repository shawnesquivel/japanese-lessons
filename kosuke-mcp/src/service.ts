import { appendCards, createPack } from "./pack.js";
import type { CardInput, FlashcardPack, PackInput } from "./schema.js";
import type { PackStore } from "./store.js";

export class KosukeService {
  constructor(private readonly store: PackStore) {}

  async create(input: PackInput): Promise<FlashcardPack> {
    return this.store.save(createPack(input));
  }

  async addCards(packId: string, cards: CardInput[]): Promise<FlashcardPack> {
    const pack = await this.requirePack(packId);
    return this.store.save(appendCards(pack, cards));
  }

  async list(query = "", tag = ""): Promise<FlashcardPack[]> {
    const normalizedQuery = query.trim().toLowerCase();
    const normalizedTag = tag.trim().toLowerCase();
    return (await this.store.list()).filter((pack) => {
      const matchesQuery = !normalizedQuery || `${pack.title} ${pack.description} ${pack.author}`.toLowerCase().includes(normalizedQuery);
      const matchesTag = !normalizedTag || pack.cards.some((card) => card.tags.some((value) => value.toLowerCase() === normalizedTag));
      return matchesQuery && matchesTag;
    });
  }

  async requirePack(id: string): Promise<FlashcardPack> {
    const pack = await this.store.get(id);
    if (!pack) throw new Error(`Pack not found: ${id}`);
    return pack;
  }
}
