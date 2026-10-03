"""Bundle the original annotated manuscript. No generated padding or word lists."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
source = (ROOT / 'scripts/novel-manuscript.txt').read_text(encoding='utf-8')
chapters = []
for number, title, body in re.findall(r'^# (\d+) ([^\n]+)\n(.*?)(?=^# |\Z)', source, re.M | re.S):
    index = int(number)
    paragraphs = [part.strip() for part in body.strip().split('\n') if part.strip()]
    text = re.sub(r'\{\{\d+\|([^}]+)\}\}', r'\1', ''.join(paragraphs))
    chapters.append({'id': index, 'title': title.strip(), 'paragraphs': paragraphs,
                     'targetIds': [f'n3:{n}' for n in range((index - 1) * 44 + 1, index * 44 + 1)],
                     'characterCount': len(re.findall(r'[\u3000-\u30ff\u3400-\u9fff\uff00-\uffef]', text))})
data = {'title': '異世界で日本語しか使えません！', 'subtitle': 'I Can Only Use Japanese in Another World',
        'chapters': chapters, 'characterCount': sum(chapter['characterCount'] for chapter in chapters)}
(ROOT / 'src/data/novel.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
plain = re.sub(r'\{\{\d+\|([^}]+)\}\}', r'\1', source)
(ROOT / 'public/novel.txt').write_text(data['title'] + '\n\n' + plain, encoding='utf-8')
print(f"{len(chapters)} chapters; {data['characterCount']:,} Japanese characters")
