"""List close but non-identical OCR meanings for editorial review."""
from __future__ import annotations

import json
import re
from difflib import SequenceMatcher

from build_n2 import ROOT, text_list

entries = json.loads((ROOT / "src/data/n2.json").read_text(encoding="utf-8"))
site = text_list()
overrides = json.loads((ROOT / "scripts/n2_overrides.json").read_text(encoding="utf-8"))
for entry in entries:
    number = entry["order"]
    if "meanings" in overrides.get(str(number), {}):
        continue
    site_parts = [part.strip(" .") for part in re.split(r"[,;；]", site[number][3]) if part.strip()]
    for meaning in entry["meanings"]:
        candidates = [(SequenceMatcher(None, meaning.lower(), part.lower()).ratio(), part) for part in site_parts]
        if not candidates:
            continue
        score, best = max(candidates)
        if 0.74 <= score < 1 and abs(len(meaning) - len(best)) <= 8:
            print(f"{number:04} {score:.2f} {entry['headword']} | {meaning} => {best}")
