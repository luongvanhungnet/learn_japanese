"""Apply the reviewed Vietnamese glossary to the bundled novel dictionary.

Keys are Japanese headwords rather than generated IDs, so rebuilding the
token-based dictionary cannot silently attach a translation to the wrong word.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def apply_vietnamese_glosses(entries):
    glossary = {}
    for number, line in enumerate((ROOT / 'scripts/novel-lexicon-vi.tsv').read_text(encoding='utf8').splitlines(), 1):
        if not line.strip():
            continue
        word, gloss = line.split('\t', 1)
        meanings = [meaning.strip() for meaning in gloss.split('|')]
        if word in glossary or not all(meanings):
            raise ValueError(f'Invalid or duplicate Vietnamese translation at line {number}: {word}')
        glossary[word] = meanings
    for entry in entries:
        if not entry.get('meaningsVi'):
            entry['meaningsVi'] = glossary.get(entry['headword'], [])
    missing = [entry['headword'] for entry in entries if not entry.get('meaningsVi')]
    if missing:
        raise ValueError(f'Vietnamese meanings required before publishing: {missing}')
    return entries

if __name__ == '__main__':
    path = ROOT / 'src/data/novel-lexicon.json'
    entries = json.loads(path.read_text(encoding='utf8'))
    apply_vietnamese_glosses(entries)
    path.write_text(json.dumps(entries, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    print(f'{len(entries)} supporting entries have Vietnamese meanings.')
