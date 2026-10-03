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


def validate_grammar() -> None:
    entries = json.loads((ROOT / 'src/data/n3-grammar.json').read_text(encoding='utf-8'))
    assert len(entries) == 111
    assert [entry['order'] for entry in entries] == list(range(1, 112))
    for entry in entries:
        assert entry['id'] == f'n3-grammar:{entry["order"]}'
        assert 4 <= entry['sourcePage'] <= 31
        assert entry['pattern'].strip()
        assert all(value.strip() for value in entry['formations'])
        for language in ('en', 'vi'):
            assert entry['meanings'][language] and all(value.strip() for value in entry['meanings'][language])
        assert entry['examples']
        for example in entry['examples']:
            assert all(example[key].strip() for key in ('japanese', 'en', 'vi'))
            assert all(annotation['text'] and annotation['reading'] for annotation in example['furigana'])
            assert '�' not in example['japanese']
    assert sum(len(entry['examples']) for entry in entries) == 134
    assert 111 + sum(bool(entry['formations']) for entry in entries) == 200
    print('N3 grammar: 111 ordered entries, 134 bilingual examples, 200 practice cells OK')


if __name__ == "__main__":
    validate("N3", 880)
    validate("N2", 1160)
    validate("RADICALS", 214)
    validate_grammar()
    lexicon = json.loads((ROOT / 'src/data/novel-lexicon.json').read_text(encoding='utf8'))
    for entry in lexicon:
        assert entry['meaningsVi'] and all(value.strip() for value in entry['meaningsVi']), (entry['headword'], 'Vietnamese lookup meaning')
    print(f'Novel dictionary: {len(lexicon)} entries with Vietnamese meanings OK')
    sys.exit(0)
