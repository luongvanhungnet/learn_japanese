"""Build offline grammar data from the visually reviewed PDF OCR transcription.

Run python scripts/import_n3_grammar.py. See README for the OCR review workflow.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Keep source wording alongside transparent corrections to obvious source typos.
CORRECTIONS = {
    4: {'金賞の瞬間です。': '緊張の瞬間です。'},
    31: {'工場が始まる': '工事が始まる'},
    36: {'１時半': '１時間半'},
    67: {'来週は私が': '来週は私は'},
    84: {'勉強しなかっただもん': '勉強しなかったんだもん'},
    85: {'反対される決まっている': '反対されるに決まっている'},
    86: {'持っていたに違いない': '持っていったに違いない'},
    88: {'一人暮らすことをできない': '一人で暮らすことができない'},
    93: {'上司の命令ので': '上司の命令なので'},
    106: {'書き上がりました': '書き上げました'},
}

NOTES = {
    1: ('Mang tính tranh thủ: làm khi còn cơ hội.', 'Do something while the opportunity remains.'),
    3: ('Nếu không làm V1, thì V2 khó mà thực hiện được.', 'V2 cannot be done unless V1 is done first.'),
    13: ('Vế sau thường là ほうがいい / ほうがましだ. Tiêu đề nguồn in nhầm ぐらいなな.', 'The following clause commonly uses ほうがいい / ほうがましだ. The source heading misprints ぐらいなな.'),
    15: ('Nguồn không có dòng nghĩa riêng; nghĩa được bổ sung từ hai ví dụ.', 'The source has no separate meaning heading; the meanings are supplied from its two examples.'),
    16: ('Nguồn không có dòng nghĩa riêng; nghĩa được bổ sung từ ví dụ.', 'The source has no separate meaning heading; the meanings are supplied from its example.'),
    20: ('Chỉ nguyên nhân.', 'Indicates a cause.'),
    21: ('Đằng sau là hậu quả; cũng diễn tả phương tiện như ví dụ học ngoại ngữ.', 'The following clause is a consequence; also indicates a means, as in the language-learning example.'),
    22: ('Từ việc V dẫn đến kết quả, phán đoán B.', 'An observation leads to a result or judgment.'),
    23: ('Đằng sau là kết quả tốt đẹp.', 'The following clause is a favorable result.'),
    24: ('Đằng sau là kết quả tiêu cực.', 'The following clause is a negative result.'),
    25: ('Vì thực sự là… nên đương nhiên…', 'Since something is true, the consequence is natural.'),
    26: ('Điều kiện giả định.', 'A hypothetical condition.'),
    27: ('Với điều kiện như thế này thì sẽ khó xử, hoặc không làm được việc như vậy.', 'Under such conditions, there will be difficulty or the action cannot be done.'),
    30: ('Cho dù… đi nữa thì…', 'Even if the stated condition occurs.'),
    35: ('Nghe nói, văn cứng.', 'Reported information in formal writing.'),
    44: ('Muốn ai đó làm gì cho mình.', 'Want someone to do something for you.'),
    46: ('Ước cho điều trong tương lai; cũng dùng để khuyên nên / không nên.', 'Wishes for the future; also advice about what should or should not be done.'),
    48: ('Mệnh lệnh trong văn cứng.', 'Instructions in formal writing.'),
    49: ('Lời khuyên.', 'Advice.'),
    59: ('Chẳng hạn: đề xuất. Những thứ như là: coi nhẹ.', 'Examples or suggestions; can also convey a dismissive attitude.'),
    68: ('Sự kì vọng. Giữ nguyên ký hiệu N+no / Vru của nguồn.', 'An intended or hoped-for result. The source notation N+no / Vru is retained.'),
    69: ('Bản dịch Việt của ví dụ thứ hai dùng thì quá khứ, trong khi câu Nhật diễn tả ý định từ giờ trở đi.', 'The Vietnamese translation of the second example uses the past tense, while the Japanese describes an intention from now on.'),
    74: ('Xu hướng: cứ V. Hoàn tất: chỉ còn chờ V là xong.', 'A continuing trend, or all preparations are complete and only the action remains.'),
    78: ('Xác nhận lại thông tin.', 'Checking information you are trying to recall.'),
    79: ('Chỉ dùng cho chủ ngữ ngôi 3.', 'Used for a third-person subject.'),
    91: ('Giả định khó xảy ra.', 'A hypothetical assumption unlikely to occur.'),
    97: ('Kể từ khi V thì không có sự thay đổi nữa.', 'A situation remains unchanged after the action.'),
    107: ('Những thứ gây khó chịu.', 'Usually undesirable things.'),
    109: ('Một cách đột ngột.', 'A sudden start.'),
}


def alternatives(value):
    return [part.strip() for part in value.split(';') if part.strip()]


def example(parts):
    japanese, vi, en, *readings = parts
    furigana = []
    for annotation in alternatives(readings[0] if readings else ''):
        text, reading = annotation.split('=', 1)
        furigana.append({'text': text, 'reading': reading})
    return {'japanese': japanese, 'vi': vi, 'en': en, 'furigana': furigana}


def main():
    entries = []
    for line in (ROOT / 'scripts/n3_grammar_reviewed.txt').read_text(encoding='utf-8').splitlines():
        if not line.strip() or line.startswith('#'):
            continue
        parts = line.split('|')
        if parts[0] == '+':
            entries[-1]['examples'].append(example(parts[1:]))
            continue
        page, pattern, formation, vi, en, *ex = parts
        order = len(entries) + 1
        entries.append({
            'id': f'n3-grammar:{order}', 'order': order, 'sourcePage': int(page),
            'pattern': pattern, 'formations': alternatives(formation),
            'meanings': {'vi': alternatives(vi), 'en': alternatives(en)},
            'examples': [example(ex)],
        })
    assert len(entries) == 111, f'Expected 111 entries, got {len(entries)}'
    for entry in entries:
        if entry['order'] in NOTES:
            vi, en = NOTES[entry['order']]
            entry['notes'] = {'vi': vi, 'en': en}
        for ex in entry['examples']:
            original = ex['japanese']
            for before, after in CORRECTIONS.get(entry['order'], {}).items():
                ex['japanese'] = ex['japanese'].replace(before, after)
            if ex['japanese'] != original:
                ex['sourceJapanese'] = original
        if entry['order'] == 4:
            entry['examples'][0]['vi'] = 'Tên lửa sắp sửa cất cánh. Đây là khoảnh khắc căng thẳng.'
            entry['examples'][0]['en'] = 'The rocket is about to take off. It is a moment of suspense.'
        if entry['order'] == 69:
            entry['examples'][1]['en'] = 'I have warned him not to be late from now on.'
        assert entry['meanings']['vi'] and entry['meanings']['en'], entry['id']
        for ex in entry['examples']:
            assert ex['japanese'] and ex['vi'] and ex['en'], entry['id']
    dest = ROOT / 'src/data/n3-grammar.json'
    dest.write_text(json.dumps(entries, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Built {len(entries)} entries, {sum(len(e["examples"]) for e in entries)} examples: {dest}')


if __name__ == '__main__':
    main()
