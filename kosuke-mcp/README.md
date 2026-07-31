# Kosuke MCP

Kosuke is a TypeScript MCP server that lets an AI tutor turn words from a chat, lesson, or textbook image into a portable flashcard pack.

## Run locally

```bash
npm install
npm run dev
```

The MCP endpoint is `http://localhost:3000/mcp` and the mcp-use inspector is available at `http://localhost:3000/mcp/inspector`.

Use another port with `PORT=3100 npm run dev`. Pack data defaults to `data/packs.json`; set `KOSUKE_DATA_FILE` to override it.

## Tools

- `create_flashcard_pack` creates a validated pack from kana, romaji, English, hints, examples, optional kanji/furigana, and optional audio metadata.
- `add_flashcards` extends a pack without changing existing card IDs.
- `list_flashcard_packs` searches the local library.
- `get_flashcard_pack` returns a complete pack.
- `export_flashcard_pack` returns importable `.kosuke.json`.

## Example tutor instruction

> Turn the Japanese words in this screenshot into a private flashcard pack with `create_flashcard_pack`. Use kana, standard romaji, one conversational English meaning, a non-spoiling hint when useful, and source type `textbook-image`.

## Storage boundary

`KosukeService` depends on the small `PackStore` interface. The MVP uses an atomic JSON-file adapter. A hosted version should replace it with a per-user database adapter and object storage for ElevenLabs audio without changing the MCP tool contract.
