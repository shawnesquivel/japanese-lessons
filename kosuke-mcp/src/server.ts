import { resolve } from "node:path";
import { MCPServer, object, text } from "mcp-use";
import { z } from "zod";
import { cardInputSchema, packInputSchema } from "./schema.js";
import { KosukeService } from "./service.js";
import { FilePackStore } from "./store.js";

const dataFile = process.env.KOSUKE_DATA_FILE
  ? resolve(process.env.KOSUKE_DATA_FILE)
  : resolve(process.cwd(), "data/packs.json");
const service = new KosukeService(new FilePackStore(dataFile));

const server = new MCPServer({
  name: "kosuke-mcp",
  title: "Kosuke Flashcards",
  version: "0.1.0",
  description: "Create portable Japanese flashcard packs from words learned in a conversation, lesson, or textbook image.",
});

server.tool({
  name: "create_flashcard_pack",
  description: "Create and save a portable Kosuke flashcard pack from Japanese words or phrases the learner encountered. Keep kana, romaji, and one plain English meaning on every card.",
  schema: packInputSchema,
}, async (input) => {
  const pack = await service.create(input);
  return object({
    message: `Created “${pack.title}” with ${pack.cards.length} cards.`,
    pack,
    nextStep: "The learner can download this JSON and import it into the Kosuke flashcard page.",
  });
});

server.tool({
  name: "add_flashcards",
  description: "Add new cards to an existing Kosuke pack while preserving stable card IDs.",
  schema: z.object({
    packId: z.string().trim().min(1).describe("ID returned by create_flashcard_pack or list_flashcard_packs"),
    cards: z.array(cardInputSchema).min(1).max(100),
  }),
}, async ({ packId, cards }) => {
  const pack = await service.addCards(packId, cards);
  return object({ message: `Added ${cards.length} cards to “${pack.title}”.`, pack });
});

server.tool({
  name: "list_flashcard_packs",
  description: "List saved Kosuke packs, optionally filtered by title text or an exact card tag.",
  schema: z.object({
    query: z.string().max(120).default(""),
    tag: z.string().max(50).default(""),
  }),
}, async ({ query, tag }) => {
  const packs = await service.list(query, tag);
  return object({
    count: packs.length,
    packs: packs.map((pack) => ({
      id: pack.id,
      title: pack.title,
      description: pack.description,
      author: pack.author,
      visibility: pack.visibility,
      cardCount: pack.cards.length,
      updatedAt: pack.updatedAt,
    })),
  });
});

server.tool({
  name: "get_flashcard_pack",
  description: "Get one complete Kosuke pack so a tutor can inspect, extend, or export it.",
  schema: z.object({ packId: z.string().trim().min(1) }),
}, async ({ packId }) => object(await service.requirePack(packId)));

server.tool({
  name: "export_flashcard_pack",
  description: "Return a complete portable .kosuke.json payload for import into the static flashcard app.",
  schema: z.object({ packId: z.string().trim().min(1) }),
}, async ({ packId }) => {
  const pack = await service.requirePack(packId);
  return text(JSON.stringify(pack, null, 2));
});

export default server;
