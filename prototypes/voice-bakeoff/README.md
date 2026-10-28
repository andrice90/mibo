# Voice bake-off listening page

The 14 OpenRouter TTS voices from the 2026-10-28 bake-off (`docs/06` §5), saying Mibo's teaching sounds and lines. Open `index.html` in a browser and press play on any clip. Mibo's mouth (the earlier sprite art in `assets/character/`) is animated from each clip's audio.

- `audio/<voice>/<clip>.mp3`: every clip, converted from the original WAVs to 64 kbps mono MP3 to keep the repo small.
- `report.json`: the measurements behind the page (time to first byte, cost, acoustic hiss check, LLM judge IPA, mouth track).
- Fish is missing 9 clips and MAI 1: the run hit the account's credit limit.

The founder picked **Gemini 3.8 Flash TTS, voice Leda** (`gemini-3.8-flash-leda`, PROJECT #37). To regenerate or extend it, run `tools/tts_eval.py`, which writes fresh WAVs and a page to the git-ignored `eval/tts/out/`.
