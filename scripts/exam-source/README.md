# Exam source and practice-key audit

The Exam catalog uses the user-supplied `de_thi_cac_nam.pdf`. Its headers identify six N3 papers: July and December in 2022, 2023, and 2024. The surrounding local folder is named `n2`, but the source pages themselves say N3.

The original PDF has 189 pages and SHA-256 `ba7e045d89b4ea9ac15186b12c746b1f79b85d23b98a1eb5304b7a4a3db826f1`. The app preserves 118 written question and passage pages as 1600-pixel-wide WebP images. Source furigana, diagrams, printed question numbers, and visible source watermarks remain intact. Covers and blank/security-pattern pages are omitted. Listening sheets are omitted because no audio is embedded in the PDF or supplied alongside it.

The PDF contains no printed answer-key pages. At the user's request, practice keys were created by solving the written questions and independently reviewed by another agent against the original questions, including full reading passages and the exact star position in word-order questions. These are reviewed practice keys, not published official JLPT keys. Scoring counts correct answers with equal weight; it does not claim a JLPT scaled score or an official pass/fail result.

| Paper | Printed vocabulary | Grammar and reading | Scored questions |
| --- | ---: | ---: | ---: |
| July 2022 | 34 | 38 | 72 |
| December 2022 | 35 | 38 | 73 |
| July 2023 | 35 | 38 | 73 |
| December 2023 | 35 | 38 | 73 |
| July 2024 | 35 | 38 | 71 |
| December 2024 | 35 | 38 | 73 |
| Total | 209 | 228 | 435 |

There are 437 printed questions. Two July 2024 vocabulary questions are unscored because the supplied source is malformed. Question 20 omits `がいい` after the intended word `仲`, so no printed option grammatically completes the sentence; the intended vocabulary choice appears to be 4. Question 26 prints `全然売れました` for choice 2, so no printed option correctly means `売り切れました`; `全部売れました` may have been intended, but the app does not silently repair that option. Both appear with explanations in answer review and are excluded from the scoring denominator.

`inventory.json` records section pages and the source page where each numbered question starts or has its numbered answer choices. The full section includes passages and continuation pages, so reviewing one question may require neighboring pages. `keys.json` stores the reviewed keys, author/reviewer, reasoning notes, and unscored explanations. `audit.json` records source pages, counts, independent-review provenance, and SHA-256 checksums for each answer array. `src/data/exams.json` is generated from that inventory and those reviewed keys. A key is published only when its status is `reviewed` and different initial-author and reviewer identifiers are recorded.

To validate the checked-in manifest and images, install Python dependencies `pypdf` and `Pillow`, then run from the repository root:

```powershell
python scripts/exam-source/import_exams.py --check
```

To additionally verify the supplied PDF, provide its path:

```powershell
python scripts/exam-source/import_exams.py --check --source 'D:\Documents\2026.1\jlpt\n2\de_thi_cac_nam.pdf'
```

To regenerate the manifest and audit after a reviewed key change, omit `--check`. To regenerate the original page images, add `--render` and provide the matching source PDF. Rendering requires Poppler's `pdftoppm` on `PATH`. Rotated PDF pages are normalized before rendering so every output page remains upright and 1600 pixels wide. Temporary render files stay under ignored `tmp/exam-source/` and are removed by the importer.

```powershell
python scripts/exam-source/import_exams.py --source 'D:\Documents\2026.1\jlpt\n2\de_thi_cac_nam.pdf' --render
```

If a new PDF has a different hash or page count, the importer refuses it. Review its boundaries, question mapping, and keys before updating the pinned source identity. Never use OCR output alone to approve a key: December 2023 vocabulary question 2 required distinguishing `ぜんしゅ` from `せんしゅ` visually, and December 2023 grammar question 14 places its star in the first slot rather than the usual third slot.
