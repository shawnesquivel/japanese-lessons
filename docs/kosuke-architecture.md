# Kosuke architecture

Kosuke begins as two deliberately separate surfaces joined by one portable pack format.

```text
ChatGPT / Claude
      │
      │ MCP tools
      ▼
kosuke-mcp (TypeScript + mcp-use)
      │
      │ .kosuke.json
      ▼
Static flashcard app
      │
      └── learning.js scheduling in localStorage
```

## Why this boundary

- The study experience remains a fast, private static app that works without an account or runtime backend.
- An AI tutor can create high-quality structured cards without owning the review interface.
- A portable JSON pack can move through MCP, file download, direct import, or a future marketplace.
- The MCP storage adapter can change without breaking clients. The MVP uses an atomic JSON file; hosted accounts can use Supabase or another per-user store.
- Anki desktop is open source under AGPL-3.0, while hosted AnkiWeb is a separate service. Kosuke uses an independent format so we can later add `.apkg` import/export as an adapter without coupling the core product or copying Anki code.

## Pack v1

Every card requires:

- stable `id`
- `kana`
- `romaji`
- one plain `english` meaning

Cards can also carry:

- a non-spoiling `hint`
- a conversational example with kana, romaji, and English
- tags
- an ElevenLabs or other audio URL with provider and voice metadata
- separate `kanji` and `furigana` fields for routing into the dedicated kanji track

The learner-facing vocabulary reviewer stays kana-first. Kanji content belongs in the dedicated kanji experience, matching the rest of this repository.

## MCP tools

| Tool | Purpose |
| --- | --- |
| `create_flashcard_pack` | Turn chat or image-derived vocabulary into a validated pack |
| `add_flashcards` | Extend a pack without changing existing IDs |
| `list_flashcard_packs` | Search a learner or shared library |
| `get_flashcard_pack` | Inspect or edit the complete pack |
| `export_flashcard_pack` | Return portable `.kosuke.json` |

The AI client does the multimodal extraction because ChatGPT and Claude already understand screenshots. Kosuke validates and persists the structured result instead of duplicating OCR and language-model infrastructure.

## Product roadmap

### Phase 1 — local-first foundation

- pack builder and JSON import/export
- adaptive one-card review with missed-card recovery
- MCP creation and library tools
- optional external audio URLs
- textbook starter pack

### Phase 2 — accounts and enrichment

- OAuth for MCP users
- per-user database storage and object storage
- ElevenLabs generation worker with deduplication by normalized Japanese text, voice, and model
- direct “Open in Kosuke” links from MCP tool results
- richer editing for hints, examples, and audio

### Phase 3 — community packs

- public, private, and unlisted publishing
- immutable pack versions plus user-owned remixes
- source attribution, licensing, reports, and moderation
- semantic search, ratings, and verified native-speaker editions
- subscriptions that preserve a learner’s progress when a pack updates

### Phase 4 — interoperability

- `.apkg` import/export adapter
- CSV and common dictionary formats
- language modules beyond Japanese
- dedicated kanji/radical cards with furigana-aware display

## Hosted data model

A hosted store should separate:

- `users`
- `packs`
- `pack_versions`
- `cards`
- `media_assets`
- `subscriptions`
- `review_events`

Review events should be append-only and private. Public pack content should be versioned independently so creators can publish improvements without silently changing a learner’s scheduled card identity.
