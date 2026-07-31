import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { KosukeService } from "../src/service.js";
import { FilePackStore } from "../src/store.js";

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "kosuke-mcp-"));
  const file = join(directory, "packs.json");
  return { file, service: new KosukeService(new FilePackStore(file)) };
}

test("creates a portable pack with stable unique card IDs", async () => {
  const { file, service } = await fixture();
  const pack = await service.create({
    title: "Chat lesson",
    cards: [
      { kana: "いま", romaji: "ima", english: "now", tags: ["time"] },
      { kana: "いま", romaji: "ima", english: "right now", tags: ["time"] },
    ],
  });

  assert.equal(pack.schemaVersion, 1);
  assert.equal(pack.cards.length, 2);
  assert.notEqual(pack.cards[0].id, pack.cards[1].id);
  assert.equal(JSON.parse(await readFile(file, "utf8")).packs[0].title, "Chat lesson");
});

test("adds cards and filters packs by exact tag", async () => {
  const { service } = await fixture();
  const pack = await service.create({
    title: "School",
    cards: [{ kana: "がくせい", romaji: "gakusei", english: "student", tags: ["school"] }],
  });
  const updated = await service.addCards(pack.id, [
    { kana: "せんせい", romaji: "sensei", english: "teacher", tags: ["people"] },
  ]);

  assert.equal(updated.cards.length, 2);
  assert.equal((await service.list("", "people"))[0].id, pack.id);
  assert.equal((await service.list("", "travel")).length, 0);
});

test("rejects kanji placed in the kana reading", async () => {
  const { service } = await fixture();
  await assert.rejects(
    service.create({
      title: "Invalid",
      cards: [{ kana: "日本", romaji: "nihon", english: "Japan" }],
    }),
    /Put kanji in the kanji field/,
  );
});
