"""Import 214 radicals from the supplied handbook and Kanji alive's CC BY 4.0 data.

Usage: python scripts/import_radicals.py path/to/214_Bo_Thu_Kanji_So_Tay_Hoc_Tap.pdf
Requires pypdf. Network is needed only when regenerating this bundled dataset.
"""
import csv
import io
import json
from pathlib import Path
import re
import sys
import urllib.request

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
REFERENCE = 'https://raw.githubusercontent.com/kanjialive/kanji-data-media/master/language-data/japanese-radicals.csv'
# Traditional Sino-Vietnamese radical names, in Kangxi order.
HAN_VIET = '''nhất|cổn|chủ|phiệt|ất|quyết|nhị|đầu|nhân|nhi|nhập|bát|quynh|mịch|băng|kỷ|khảm|đao|lực|bao|chủy|phương|hệ|thập|bốc|tiết|hán|tư|hựu|khẩu|vi|thổ|sĩ|truy|tuy|tịch|đại|nữ|tử|miên|thốn|tiểu|uông|thi|triệt|sơn|xuyên|công|kỷ|cân|can|yêu|nghiễm|dẫn|củng|dặc|cung|kệ|sam|xích|tâm|qua|hộ|thủ|chi|phộc|văn|đẩu|cân|phương|vô|nhật|viết|nguyệt|mộc|khiếm|chỉ|đãi|thù|vô|tỷ|mao|thị|khí|thủy|hỏa|trảo|phụ|hào|tường|phiến|nha|ngưu|khuyển|huyền|ngọc|qua|ngõa|cam|sinh|dụng|điền|sơ|nạch|bát|bạch|bì|mãnh|mục|mâu|thỉ|thạch|thị|nhựu|hòa|huyệt|lập|trúc|mễ|mịch|phẫu|võng|dương|vũ|lão|nhi|lỗi|nhĩ|duật|nhục|thần|tự|chí|cữu|thiệt|suyễn|chu|cấn|sắc|thảo|hô|trùng|huyết|hành|y|á|kiến|giác|ngôn|cốc|đậu|thỉ|trãi|bối|xích|tẩu|túc|thân|xa|tân|thần|sước|ấp|dậu|biện|lý|kim|trường|môn|phụ|đãi|chuy|vũ|thanh|phi|diện|cách|vi|phỉ|âm|hiệt|phong|phi|thực|thủ|hương|mã|cốt|cao|bưu|đấu|sưởng|cách|quỷ|ngư|điểu|lỗ|lộc|mạch|ma|hoàng|thử|hắc|chỉ|mãnh|đỉnh|cổ|thử|tỵ|tề|xỉ|long|quy|dược'''.split('|')


def main():
    source = Path(sys.argv[1])
    text = '\n'.join(page.extract_text() for page in PdfReader(source).pages[1:])
    cards = list(re.finditer(r'(?m)^(\d{3})\s+•\s+(\d+) nét\s*\n', text))
    assert len(cards) == len(HAN_VIET) == 214
    with urllib.request.urlopen(REFERENCE, timeout=30) as response:
        reference_text = response.read().decode('utf-8-sig')
    references = {}
    alternate_encodings = {'⺐': 43, '⺓': 52, '\ue755': 92, '⻑': 168}
    for row in csv.DictReader(io.StringIO(reference_text)):
        radical = row['Radical']
        if radical in alternate_encodings:
            references[alternate_encodings[radical]] = row
        if len(radical) == 1 and 0x2F00 <= ord(radical) <= 0x2FD5:
            references[ord(radical) - 0x2F00 + 1] = row
    assert len(references) == 214
    entries = []
    for index, card in enumerate(cards):
        order, strokes = map(int, card.groups())
        assert order == index + 1
        end = cards[index + 1].start() if index + 1 < len(cards) else len(text)
        lines = text[card.end():end].strip().splitlines()
        headword, meaning = lines[:2]
        reference = references[order]
        pdf_reading = lines[2] if len(lines) > 2 and re.fullmatch(r'[ぁ-ゖー・]+', lines[2]) else ''
        variants = lines[lines.index('Biến thể:') + 1].split('・') if 'Biến thể:' in lines else []
        entries.append({
            'id': f'radicals:{order}', 'level': 'RADICALS', 'order': order,
            'headword': headword, 'reading': pdf_reading or reference['Reading'],
            'readings': list(dict.fromkeys(filter(None, [pdf_reading, reference['Reading']]))),
            'hanViet': HAN_VIET[index].upper(),
            'meanings': [part.strip() for part in reference['Meaning'].split(',') if part.strip()],
            'meaningsVi': [part.strip() for part in meaning.split(';') if part.strip()],
            'strokes': strokes, 'variants': variants,
        })
    (ROOT / 'src/data/radicals.json').write_text(json.dumps(entries, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Imported {len(entries)} radicals')


if __name__ == '__main__':
    main()
