# japanese-lessons

Static worksheets for studying Japanese.

## Agent instructions

Agents must read [`AGENTS.md`](AGENTS.md) before making changes.

## Worksheets

- **まなぶ (study arcade)** — adaptive mixed practice across vocabulary, sentence building, and listening with XP, streaks, and local progress ([`study.html`](study.html)).
- **こそあど (kosoado)** — demonstratives (kore/sore/are/dore) practice with fruit & veg vocabulary. Served at `/` ([`index.html`](index.html), also at [`kosoado_worksheet.html`](kosoado_worksheet.html)).
- **じょし (particles)** — single-word vocabulary, core particle patterns, scenario-based verb practice, mixed tutor drills, and ElevenLabs question/word listening comprehension ([`particles.html`](particles.html)).
- **ばしょ (locations)** — **に** vs **で**, formal/casual verb forms, conversational questions, four dialogues, and broad mixed practice ([`locations.html`](locations.html)).
- **かいわ (real conversation)** — coached everyday exchanges with natural replies, alternate answers, follow-up questions, audio playback, and adaptive review ([`conversation.html`](conversation.html)).
- **はじめまして (introduction)** — a personal self-introduction shown line by line in kana, romaji, and English ([`introduction.html`](introduction.html)).
- **じこしょうかい (about me)** — reusable personal sentence bank for grounding examples in real life ([`about.html`](about.html), source: [`about-me.js`](about-me.js)).
- **Flashcards** — Anki-style adaptive vocabulary review with audio, ratings, due dates, and a mastery map ([`flashcards.html`](flashcards.html)).
- **Kanji Game** — a separate kanji-only track with drawing, adaptive quizzes, RTK-aligned primitive cues, shared local mnemonic notes, and one-round missed-card recovery ([`kanji.html`](kanji.html)).

## Learning progress

[`learning.js`](learning.js) stores scheduling, XP, streaks, and mastery locally in the browser. Missed items return sooner; stable items are spaced farther apart. Progress can be exported from the adaptive study pages.

## Deploy

Static site deployed on Vercel — no build step.
