"""Apply English JMdict glosses to the existing vocabulary collections.

Run: python scripts/import_english_meanings.py path/to/JMdict_e.xml
Only meanings are changed. The Japanese source fields and Hán Việt stay intact.
Unmatched entries are reported for manual review.
"""
import json
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]

def variants(text):
    text = re.sub(r'[（(].*?[）)]', '', text)
    return list(dict.fromkeys(candidate for word in re.split(r'[・/]', text)
                              for candidate in (word, word.removesuffix('な').removesuffix('する'), word.removesuffix('と'))))

def concise(gloss):
    return re.sub(r'\s*\([^)]*\)', '', gloss).removeprefix('to ').strip()

def import_meanings(dictionary):
    index = {}
    for _, node in ET.iterparse(dictionary, events=('end',)):
        if node.tag != 'entry':
            continue
        spellings = [item.text for item in node.findall('k_ele/keb')]
        readings = [item.text for item in node.findall('r_ele/reb')]
        senses = []
        for sense in node.findall('sense'):
            if any('archaic' in (item.text or '') or 'obsolete' in (item.text or '') for item in sense.findall('misc')):
                continue
            glosses = [item.text for item in sense.findall('gloss') if item.text]
            if glosses:
                senses.append((sense.findall('stagk'), sense.findall('stagr'), glosses))
        record = (spellings, readings, senses)
        for word in set(spellings + readings):
            index.setdefault(word, []).append(record)
        node.clear()

    for level in ('n3', 'n2'):
        path = ROOT / 'src/data' / f'{level}.json'
        entries = json.loads(path.read_text(encoding='utf-8'))
        overrides = json.loads((ROOT / 'scripts/english_meanings_overrides.json').read_text(encoding='utf-8'))
        for entry in entries:
            if entry['id'] in overrides:
                entry['meanings'] = overrides[entry['id']]
                continue
            words = variants(entry['headword'])
            readings = variants(entry['reading'])
            matches = []
            for word in words:
                candidates = [record for record in index.get(word, []) if set(readings) & set(record[1])]
                if candidates:
                    # Prefer the exact written word over unrelated kanji homophones.
                    exact = [record for record in candidates if word in record[0]]
                    matches = exact or candidates
                    break
            if not matches and not re.search(r'[ぁ-ヿ]', entry['reading']):
                for word in words:
                    if index.get(word):
                        matches = index[word]
                        break
            if not matches:
                print(f"Unmatched {entry['id']} {entry['headword']} {entry['reading']}")
                continue
            meanings = []
            for spellings, _, senses in matches:
                selected = 0
                for restricted_words, restricted_readings, glosses in senses:
                    if restricted_words and not set(words) & {item.text for item in restricted_words}:
                        continue
                    if restricted_readings and not set(readings) & {item.text for item in restricted_readings}:
                        continue
                    meanings.extend(concise(gloss) for gloss in glosses[:2 if selected == 0 else 1])
                    selected += 1
                    if selected == 3:
                        break
            if meanings:
                entry['meanings'] = list(dict.fromkeys(meaning for meaning in meanings if meaning))[:6]
        path.write_text(json.dumps(entries, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

if __name__ == '__main__':
    import_meanings(sys.argv[1])
