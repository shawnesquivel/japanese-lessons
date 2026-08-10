import { z } from "zod";

const noKanjiInKana = (value: string) => !/\p{Script=Han}/u.test(value);

export const audioSchema = z.object({
  url: z.string().url().max(1_000),
  voiceId: z.string().max(120).optional(),
  provider: z.string().max(40).default("elevenlabs"),
});

export const exampleSchema = z.object({
  kana: z.string().trim().min(1).max(300).refine(noKanjiInKana, "Keep the kana reading free of kanji."),
  romaji: z.string().trim().min(1).max(400),
  english: z.string().trim().min(1).max(500),
});

export const cardInputSchema = z.object({
  id: z.string().trim().min(1).max(100).optional(),
  type: z.enum(["vocabulary", "phrase", "sentence"]).default("vocabulary"),
  kana: z.string().trim().min(1).max(160).refine(noKanjiInKana, "Put kanji in the kanji field and its reading in kana."),
  romaji: z.string().trim().min(1).max(200),
  english: z.string().trim().min(1).max(300),
  hint: z.string().trim().max(300).optional(),
  example: exampleSchema.optional(),
  kanji: z.string().trim().max(160).optional(),
  furigana: z.string().trim().max(240).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(12).default([]),
  audio: audioSchema.optional(),
});

export const sourceSchema = z.object({
  type: z.enum(["chat", "textbook-image", "lesson", "manual", "import"]).default("chat"),
  title: z.string().trim().max(160).default(""),
  note: z.string().trim().max(400).default(""),
});

export const packInputSchema = z.object({
  id: z.string().trim().min(1).max(100).optional(),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400).default(""),
  language: z.string().trim().min(2).max(12).default("ja"),
  visibility: z.enum(["private", "unlisted", "public"]).default("private"),
  author: z.string().trim().max(100).default("Kosuke"),
  source: sourceSchema.default({ type: "chat", title: "", note: "" }),
  cards: z.array(cardInputSchema).min(1).max(250),
});

export const packSchema = packInputSchema.extend({
  id: z.string().trim().min(1).max(100),
  schemaVersion: z.literal(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  cards: z.array(cardInputSchema.extend({ id: z.string().trim().min(1).max(100) })).min(1).max(250),
});

export type CardInput = z.input<typeof cardInputSchema>;
export type FlashcardPack = z.output<typeof packSchema>;
export type PackInput = z.input<typeof packInputSchema>;
