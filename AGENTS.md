# Agent guide

Read this file before changing the codebase.

- Keep the site static: plain HTML, CSS, and vanilla JavaScript with no runtime backend or build step.
- Follow the lesson progression: single-word vocabulary → explanation → guided examples → scenarios → mixed practice → listening.
- Never reveal an answer in the prompt, card label, or accessibility text. Learners answer first, then reveal or submit.
- Keep learner-facing Japanese in hiragana. Use katakana for normal loanwords. Kanji is allowed only inside the dedicated Kanji Fable page and its data.
- Pair Japanese with romaji and plain English when an answer is revealed.
- Teach polite です／ます forms first, then show casual and past forms explicitly.
- For verb and conjugation answers, reveal formal, casual, and common spoken contractions when they differ. Label each form and include romaji plus one English meaning (for example: すんでいました / すんでいた / すんでた).
- Use conversational, everyday examples. Prefer facts from `about-me.js` when personalization helps.
- Include varied drills: both translation directions, fill-the-blank, sentence building, corrections, free replies, and audio-only comprehension.
- Keep interactive targets at least 40×40px, use `transform: scale(.96)` for press feedback, and avoid `transition: all`.
- Shuffle practice items. Use stable item IDs and `learning.js` for local progress instead of inventing page-specific storage.
- Adaptive review should prioritize due, unseen, and frequently missed items while spacing out mastered items.
- Extend `scripts/generate-audio.mjs` for ElevenLabs audio. Keep `.json` plus `.js` manifest companions and never commit `.env`.
- Run the full relevant browser flow before shipping. Preserve the no-kanji rule outside the dedicated kanji page.
- Use `npx` whenever running Supabase commands.
- For all updates, commit, push, and deploy to GitHub and Vercel. No need to ask for permission.
