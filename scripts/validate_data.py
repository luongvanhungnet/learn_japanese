"""Check generated vocabulary JSON before shipping the local website."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def has_kanji(value: str) -> bool:
    return any("\u4e00" <= char <= "\u9fff" for char in value)


def validate(level: str, expected: int) -> None:
    path = ROOT / "src" / "data" / f"{level.lower()}.json"
    entries = json.loads(path.read_text(encoding="utf-8"))
    assert len(entries) == expected, (level, "count", len(entries))
    assert [entry["order"] for entry in entries] == list(range(1, expected + 1)), (level, "order")
    assert len({entry["id"] for entry in entries}) == expected, (level, "duplicate ids")
    for entry in entries:
        prefix = f'{level} #{entry["order"]}'
        assert entry["id"] == f'{level.lower()}:{entry["order"]}', prefix
        assert entry["level"] == level, prefix
        assert entry["headword"].strip(), (prefix, "headword")
        assert entry["reading"].strip() and not has_kanji(entry["reading"]), (prefix, "reading")
        assert entry["meanings"] and all(part.strip() for part in entry["meanings"]), (prefix, "meaning")
        assert (entry["hanViet"] is not None) == has_kanji(entry["headword"]), (prefix, "hanViet")
        assert not any("�" in str(value) or "?" in str(value) for value in [entry["headword"], entry["reading"], entry["hanViet"]]), (prefix, "corrupt text")
    print(f"{level}: {expected} unique ordered entries OK")


if __name__ == "__main__":
    validate("N3", 880)
    validate("N2", 1160)
    sys.exit(0)
