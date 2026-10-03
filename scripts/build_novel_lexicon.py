"""Select a small offline story dictionary from JMdict and the study collections.

Run after tokenize_novel.mjs: python scripts/build_novel_lexicon.py path/to/JMdict_e.xml
The full XML and Unihan archive are not shipped. Runtime uses only selected entries.
"""
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from io import BytesIO
from pathlib import Path
from novel_vi import apply_vietnamese_glosses

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'src/data'
tokens = json.loads((ROOT / 'scripts/novel-tokens.json').read_text(encoding='utf-8'))
targets = json.loads((DATA / 'n3.json').read_text(encoding='utf-8'))
n2 = json.loads((DATA / 'n2.json').read_text(encoding='utf-8'))
translations = json.loads((DATA / 'vi.json').read_text(encoding='utf-8'))
target_words = {word for entry in targets for word in entry['headword'].split('・') for word in [word, word.removesuffix('な')]}
target_words.update(['適当', 'だます', '表面', 'パートナー'])
by_base = {}
for token in tokens:
    if token['base'] not in target_words:
        by_base.setdefault(token['base'], []).append(token)

def hira(text):
    return ''.join(chr(ord(c) - 0x60) if '\u30a1' <= c <= '\u30f6' else c for c in text)

reference = {}
scores = {}
for _, node in ET.iterparse(sys.argv[1], events=('end',)):
    if node.tag != 'entry':
        continue
    spellings = [value.text for value in node.findall('k_ele/keb')]
    readings = [value.text for value in node.findall('r_ele/reb')]
    for word in set(spellings + readings) & by_base.keys():
        def prefix_length(reading):
            best = 0
            for token in by_base[word]:
                observed = hira(token['reading'])
                length = 0
                for left,right in zip(reading,observed):
                    if left != right:
                        break
                    length += 1
                best = max(best,length)
            return best
        reading = max(readings,key=prefix_length)
        frequent = bool(node.findall('k_ele/ke_pri') or node.findall('r_ele/re_pri'))
        score = (prefix_length(reading), word in spellings, frequent)
        meanings = []
        for sense in node.findall('sense'):
            restricted = [value.text for value in sense.findall('stagk')]
            if restricted and word not in restricted:
                continue
            if any('archaic' in (value.text or '') or 'obsolete' in (value.text or '') for value in sense.findall('misc')):
                continue
            meanings.extend(value.text for value in sense.findall('gloss') if value.text)
            if len(meanings) >= 3:
                break
        if meanings and (word not in reference or score > scores[word]):
            reference[word] = {'reading': reading, 'meanings': list(dict.fromkeys(meanings))[:4]}
            scores[word] = score
    node.clear()

kanji = {}
with urllib.request.urlopen('https://www.unicode.org/Public/17.0.0/ucd/Unihan.zip', timeout=60) as response:
    archive = zipfile.ZipFile(BytesIO(response.read()))
for line in archive.read('Unihan_Readings.txt').decode('utf-8').splitlines():
    if '\tkVietnamese\t' in line:
        code, _, value = line.split('\t')
        kanji[chr(int(code[2:],16))] = value.split()[0].upper()
for entry in targets + n2:
    chars = re.findall(r'[\u4e00-\u9fff]', entry['headword'])
    syllables = (entry.get('hanViet') or '').split()
    if len(chars) == len(syllables):
        for char, syllable in zip(chars, syllables):
            kanji[char] = syllable

overrides = {
    '悠斗': ('ゆうと', ['Yuto, the university student'], ['Yuto, sinh viên đại học']),
    '悠': ('ゆう', ['part of the name Yuto'], ['một phần tên Yuto']),
    '斗': ('と', ['part of the name Yuto'], ['một phần tên Yuto']),
    'ミナ': ('みな', ['Mina, the innkeeper'], ['Mina, chủ quán']),
    'リオ': ('りお', ['Rio, the young craftswoman'], ['Rio, cô thợ trẻ']),
    'セナ': ('せな', ['Sena, the guild clerk'], ['Sena, nhân viên hội']),
    'トマ': ('とま', ['Toma, the waterworks specialist'], ['Toma, chuyên gia thủy đạo']),
    'ガン': ('がん', ['Gan, the cook'], ['Gan, đầu bếp']),
    'ルミナ': ('るみな', ['Lumina, the fantasy town'], ['Lumina, thị trấn trong truyện']),
    'ユキ': ('ゆき', ['Yuki, an earlier traveler'], ['Yuki, người lữ hành trước đây']),
    'は': ('は', ['topic marker; pronounced wa as a particle'], ['trợ từ chỉ chủ đề; đọc là wa']),
    'へ': ('へ', ['direction marker; pronounced e as a particle'], ['trợ từ chỉ hướng; đọc là e']),
    'を': ('を', ['direct object marker; pronounced o as a particle'], ['trợ từ chỉ đối tượng; đọc là o']),
    'が': ('が', ['subject marker; but (conjunction)'], ['trợ từ chỉ chủ ngữ; nhưng']),
    'の': ('の', ['possession/linking particle; nominalizer'], ['trợ từ sở hữu/liên kết; danh từ hóa']),
    'に': ('に', ['marks time, location, destination or indirect object'], ['chỉ thời gian, vị trí, đích đến hoặc đối tượng gián tiếp']),
    'で': ('で', ['marks location, means or cause'], ['chỉ nơi xảy ra hành động, phương tiện hoặc nguyên nhân']),
    'と': ('と', ['and; with; quotation marker'], ['và; cùng với; trợ từ trích dẫn']),
    'も': ('も', ['also; even'], ['cũng; ngay cả']),
    'か': ('か', ['question or alternative marker'], ['trợ từ nghi vấn hoặc lựa chọn']),
    'ね': ('ね', ['seeks agreement; softens a statement'], ['xin sự đồng tình; làm nhẹ lời nói']),
    'よ': ('よ', ['emphasizes information for the listener'], ['nhấn mạnh thông tin với người nghe']),
    'な': ('な', ['na-adjective connector; prohibition after a verb'], ['nối tính từ na; cấm đoán sau động từ']),
    'た': ('た', ['past/completed-action auxiliary'], ['trợ động từ chỉ quá khứ hoặc hoàn thành']),
    'て': ('て', ['links clauses in the te form'], ['nối mệnh đề bằng thể te']),
    'ます': ('ます', ['polite verb ending'], ['đuôi động từ lịch sự']),
    'です': ('です', ['polite copula (is/am/are)'], ['từ kết lịch sự (là)']),
    'だ': ('だ', ['plain copula (is/am/are)'], ['từ kết thể thường (là)']),
    'ない': ('ない', ['not; negative ending'], ['không; đuôi phủ định']),
    'ん': ('ん', ['contracted の in explanatory expressions'], ['dạng rút gọn của の trong cách nói giải thích']),
    'ば': ('ば', ['conditional ending: if'], ['đuôi điều kiện: nếu']),
    'れる': ('れる', ['passive/potential auxiliary'], ['trợ động từ bị động/khả năng']),
    'られる': ('られる', ['passive, potential or honorific auxiliary'], ['trợ động từ bị động, khả năng hoặc kính ngữ']),
    'う': ('う', ['volitional auxiliary: will/let us'], ['trợ động từ ý chí: sẽ/hãy']),
    'たい': ('たい', ['want to do'], ['muốn làm']),
    'お客': ('おきゃく', ['guest', 'customer (polite)'], ['khách']),
    '送れる': ('おくれる', ['can send (potential of 送る)'], ['có thể gửi']),
    '残せる': ('のこせる', ['can leave behind (potential of 残す)'], ['có thể để lại']),
    '出せる': ('だせる', ['can put out (potential of 出す)'], ['có thể đưa ra']),
    '買える': ('かえる', ['can buy (potential of 買う)'], ['có thể mua']),
    '渡せる': ('わたせる', ['can hand over (potential of 渡す)'], ['có thể trao']),
    '手伝える': ('てつだえる', ['can help (potential of 手伝う)'], ['có thể giúp']),
    '書き': ('がき', ['writing (compound suffix)'], ['chữ viết (hậu tố trong từ ghép)']),
    '守れる': ('まもれる', ['can protect/keep (potential of 守る)'], ['có thể bảo vệ/giữ']),
    '直せる': ('なおせる', ['can fix (potential of 直す)'], ['có thể sửa']),
    'に関する': ('にかんする', ['concerning', 'related to'], ['liên quan đến']),
    '運べる': ('はこべる', ['can carry (potential of 運ぶ)'], ['có thể vận chuyển']),
    '書ける': ('かける', ['can write (potential of 書く)'], ['có thể viết']),
    '動かせる': ('うごかせる', ['can move something (potential of 動かす)'], ['có thể di chuyển vật']),
    '日間': ('にちかん', ['duration in days'], ['khoảng thời gian tính bằng ngày']),
    '待てる': ('まてる', ['can wait (potential of 待つ)'], ['có thể chờ']),
    '帰れる': ('かえれる', ['can return home (potential of 帰る)'], ['có thể trở về']),
    '消せる': ('けせる', ['can erase (potential of 消す)'], ['có thể xóa']),
    '木の根': ('きのね', ['tree root'], ['rễ cây']),
    'っと': ('っと', ['colloquial contracted quotation/ending'], ['dạng rút gọn trong khẩu ngữ']),
    '返せる': ('かえせる', ['can return something (potential of 返す)'], ['có thể trả lại']),
    '歩ける': ('あるける', ['can walk (potential of 歩く)'], ['có thể đi bộ']),
    '会える': ('あえる', ['can meet (potential of 会う)'], ['có thể gặp']),
    '戻せる': ('もどせる', ['can restore (potential of 戻す)'], ['có thể đưa trở lại']),
    '増やせる': ('ふやせる', ['can increase something (potential of 増やす)'], ['có thể tăng thêm']),
    '試せる': ('ためせる', ['can try (potential of 試す)'], ['có thể thử']),
    '通れる': ('とおれる', ['can pass through (potential of 通る)'], ['có thể đi qua']),
    '戻れる': ('もどれる', ['can return (potential of 戻る)'], ['có thể quay lại']),
    '探せる': ('さがせる', ['can look for (potential of 探す)'], ['có thể tìm']),
    'スマートフォン': ('すまーとふぉん', ['smartphone'], ['điện thoại thông minh']),
    'メモ': ('めも', ['memo', 'note'], ['ghi chú']),
    'いる': ('いる', ['to exist/be (animate); auxiliary for an ongoing state'], ['có, ở (người/động vật); chỉ trạng thái tiếp diễn']),
    'ある': ('ある', ['to exist/be (inanimate); to have'], ['có, tồn tại (vật)']),
    '空': ('そら', ['sky; から: empty; くう: emptiness'], ['bầu trời; から: trống; くう: sự trống không']),
    'くらい': ('くらい', ['approximately; extent/degree'], ['khoảng; mức độ']),
    'いう': ('いう', ['to say (kana form of 言う)'], ['nói']),
    'こと': ('こと', ['thing, matter; nominalizer for an action'], ['việc, điều; danh từ hóa hành động']),
    'よい': ('よい', ['good'], ['tốt']),
    'この': ('この', ['this (before a noun)'], ['này (trước danh từ)']),
    'お': ('お', ['polite/honorific prefix'], ['tiền tố lịch sự/kính ngữ']),
    'おく': ('おく', ['to put; do in advance (ておく)'], ['đặt; làm trước (ておく)']),
    'ついで': ('ついで', ['opportunity to do something along with another activity'], ['tiện dịp làm việc khác']),
    'わけ': ('わけ', ['reason; explanation'], ['lý do; sự giải thích']),
    'いつか': ('いつか', ['someday; at some point'], ['một ngày nào đó']),
    'みる': ('みる', ['to see; try doing (てみる)'], ['nhìn; thử làm (てみる)']),
    'よう': ('よう', ['manner; resemblance; so that (in ように)'], ['cách; sự tương tự; để (trong ように)']),
    'いける': ('いける', ['can go; can manage'], ['có thể đi; có thể làm được']),
    'ため': ('ため', ['purpose; benefit; cause'], ['mục đích; lợi ích; nguyên nhân']),
    'かも': ('かも', ['might; perhaps (in かもしれない)'], ['có lẽ (trong かもしれない)']),
    'よく': ('よく', ['well; often'], ['tốt; thường xuyên']),
    'いく': ('いく', ['to go; movement/progression away from now'], ['đi; sự tiến triển từ hiện tại']),
    'くる': ('くる', ['to come; movement/progression toward now'], ['đến; sự tiến triển tới hiện tại']),
    'ほう': ('ほう', ['side; direction; alternative in a comparison'], ['phía; hướng; phương án được so sánh']),
    'せい': ('せい', ['cause of an undesirable result'], ['nguyên nhân gây kết quả không mong muốn']),
    'せる': ('せる', ['causative verb ending'], ['đuôi động từ sai khiến']),
    'たび': ('たび', ['each time; occasion'], ['mỗi lần; dịp']),
    'たち': ('たち', ['plural/group suffix'], ['hậu tố chỉ số nhiều/nhóm']),
    'や': ('や', ['and (non-exhaustive listing)'], ['và (liệt kê không đầy đủ)']),
    'もの': ('もの', ['thing; explanatory/emotional ending'], ['vật, thứ; đuôi giải thích hoặc thể hiện cảm xúc']),
    'にくい': ('にくい', ['difficult to do (after a verb stem)'], ['khó làm (sau thân động từ)']),
    'やすい': ('やすい', ['easy to do (after a verb stem)'], ['dễ làm (sau thân động từ)']),
    'びく': ('びく', ['part of びくっと: with a startled jump'], ['một phần của びくっと: giật mình']),
    'たとえ': ('たとえ', ['even if'], ['dù, cho dù']),
    'そば': ('そば', ['near; beside'], ['gần; bên cạnh']),
    'さ': ('さ', ['adjective nominalizing suffix; sentence-ending particle'], ['hậu tố danh từ hóa tính từ; trợ từ cuối câu']),
}
# Context-selected readings for common written words in this manuscript.
for word,reading,en,vi in [
    ('大学','だいがく','university','đại học'),('図書館','としょかん','library','thư viện'),
    ('日本語','にほんご','Japanese language','tiếng Nhật'),('水門','すいもん','water/sluice gate','cửa điều tiết nước'),
    ('町','まち','town','thị trấn'),('門','もん','gate','cổng'),('月','つき','moon; month','mặt trăng; tháng'),
    ('目','め','eye','mắt'),('食堂','しょくどう','dining hall; restaurant','quán ăn; nhà ăn'),
    ('首','くび','neck; head','cổ; đầu'),('声','こえ','voice','giọng nói'),('家','いえ','house; home','nhà'),
    ('人','ひと','person','người'),('父','ちち','father','cha'),('母','はは','mother','mẹ'),
    ('子','こ','child','đứa trẻ'),('子ども','こども','child','trẻ em'),('子供','こども','child','trẻ em'),
    ('水','みず','water','nước'),('火','ひ','fire','lửa'),('光','ひかり','light','ánh sáng'),
    ('風','かぜ','wind','gió'),('雨','あめ','rain','mưa'),('朝','あさ','morning','buổi sáng'),
    ('夜','よる','night','ban đêm'),('昼','ひる','noon; daytime','trưa; ban ngày'),
    ('今日','きょう','today','hôm nay'),('明日','あした','tomorrow','ngày mai'),('昨日','きのう','yesterday','hôm qua'),
    ('今','いま','now','bây giờ'),('日','ひ','day','ngày'),('時','とき','time; when','lúc; thời gian'),
    ('本','ほん','book','sách'),('紙','かみ','paper','giấy'),('線','せん','line','đường nét'),
    ('字','じ','character; handwriting','chữ'),('名前','なまえ','name','tên'),('言葉','ことば','word; language','từ; lời; ngôn ngữ'),
    ('世界','せかい','world','thế giới'),('異世界','いせかい','another world','thế giới khác'),
    ('帰る','かえる','to return home','trở về'),('戻る','もどる','to return','quay lại'),
    ('待つ','まつ','to wait','chờ'),('行く','いく','to go','đi'),('来る','くる','to come','đến'),
    ('見る','みる','to see','nhìn; xem'),('聞く','きく','to hear; ask','nghe; hỏi'),
    ('話す','はなす','to speak','nói'),('言う','いう','to say','nói'),('書く','かく','to write','viết'),
    ('読む','よむ','to read','đọc'),('歩く','あるく','to walk','đi bộ'),('走る','はしる','to run','chạy'),
    ('持つ','もつ','to hold; have','cầm; có'),('使う','つかう','to use','dùng'),
    ('作る','つくる','to make','làm; tạo ra'),('出る','でる','to go out','ra ngoài'),
    ('入る','はいる','to enter','vào'),('出す','だす','to put out','đưa ra'),
    ('受け取る','うけとる','to receive','nhận'),('渡す','わたす','to hand over','trao'),
    ('食べる','たべる','to eat','ăn'),('飲む','のむ','to drink','uống'),
    ('探す','さがす','to search for','tìm kiếm'),('選ぶ','えらぶ','to choose','chọn'),
    ('思う','おもう','to think; feel','nghĩ; cảm thấy'),('考える','かんがえる','to consider','suy nghĩ'),
    ('分かる','わかる','to understand','hiểu'),('知る','しる','to know; find out','biết'),
    ('教える','おしえる','to teach; tell','dạy; cho biết'),('覚える','おぼえる','to remember; learn','nhớ; học'),
    ('笑う','わらう','to laugh; smile','cười'),('泣く','なく','to cry','khóc'),
    ('椅子','いす','chair','ghế'),('机','つくえ','desk; table','bàn'),('窓','まど','window','cửa sổ'),
    ('扉','とびら','door','cánh cửa'),('部屋','へや','room','phòng'),('階段','かいだん','stairs','cầu thang'),
    ('学校','がっこう','school','trường học'),('先生','せんせい','teacher','giáo viên; thầy cô'),
    ('授業','じゅぎょう','lesson; class','buổi học'),('仕事','しごと','work; job','công việc'),
    ('料理','りょうり','cooking; dish','nấu ăn; món ăn'),('皿','さら','plate','đĩa'),
    ('鍋','なべ','pot','nồi'),('米','こめ','rice (uncooked)','gạo'),('パン','ぱん','bread','bánh mì'),
    ('食事','しょくじ','meal','bữa ăn'),('店','みせ','shop','cửa hàng'),('客','きゃく','guest; customer','khách'),
    ('道','みち','road; path','đường'),('橋','はし','bridge','cầu'),('川','かわ','river','sông'),
    ('村','むら','village','làng'),('家族','かぞく','family','gia đình'),('手紙','てがみ','letter','thư'),
    ('猫','ねこ','cat','mèo'),('竜','りゅう','dragon','rồng'),('馬','うま','horse','ngựa'),
    ('馬車','ばしゃ','horse-drawn carriage','xe ngựa'),('荷車','にぐるま','cart','xe chở hàng'),
    ('手','て','hand','tay'),('足','あし','foot; leg','chân'),('顔','かお','face','mặt'),
    ('体','からだ','body','cơ thể'),('心','こころ','heart; mind','trái tim; tâm trí'),
    ('魔法','まほう','magic','phép thuật'),('道具','どうぐ','tool','dụng cụ'),('箱','はこ','box','hộp'),
    ('実験','じっけん','experiment','thí nghiệm'),('模型','もけい','model','mô hình'),
    ('水路','すいろ','waterway','đường dẫn nước'),('厨房','ちゅうぼう','kitchen','nhà bếp'),
    ('診療所','しんりょうじょ','clinic','phòng khám'),('御者','ぎょしゃ','coach driver','người đánh xe ngựa'),
    ('ギルド','ぎるど','guild','hội nghề nghiệp'),('薬','くすり','medicine','thuốc'),
    ('病気','びょうき','illness','bệnh'),('傷','きず','wound','vết thương'),
    ('印','しるし','mark; sign','dấu; ký hiệu'),('方','ほう','direction; side; かた: person (polite)','phía; hướng; かた: người (lịch sự)'),
]:
    overrides[word] = (reading,[en],[vi])
entries = []
unmatched = []
for base, items in by_base.items():
    study = next((entry for entry in n2 if base in entry['headword'].split('・') or base == entry['headword'].removesuffix('な')), None)
    selected = reference.get(base)
    if base in overrides:
        reading, en, vi = overrides[base]
        source = 'editorial'
    elif study:
        reading, en, vi = study['reading'], study['meanings'], translations['N2'][study['id']]
        source = 'N2'
    elif selected:
        reading, en, vi = selected['reading'], selected['meanings'], []
        source = 'JMdict'
    else:
        reading, en, vi = hira(items[0]['reading']), [], []
        source = 'review-required'
        unmatched.append({'word':base,'reading':reading,'pos':items[0]['pos']})
    chars = re.findall(r'[\u4e00-\u9fff]', base)
    han_viet = ' '.join(kanji[c] for c in chars) if chars and all(c in kanji for c in chars) else None
    entries.append({'id':f'story:{len(entries)+1}', 'headword':base, 'reading':reading,
                    'hanViet':han_viet, 'meanings':en, 'meaningsVi':vi, 'source':source,
                    'forms':list(dict.fromkeys([base] + [item['surface'] for item in items]))})
# Proper names are combined even when the morphological tokenizer splits them.
for name in ['悠斗','ミナ','リオ','セナ','トマ','ガン','ルミナ','ユキ','スマートフォン']:
    if not any(entry['headword'] == name for entry in entries):
        reading,en,vi = overrides[name]
        entries.append({'id':f'story:{len(entries)+1}', 'headword':name,'reading':reading,'hanViet':None,
                        'meanings':en,'meaningsVi':vi,'source':'editorial','forms':[name]})
apply_vietnamese_glosses(entries)
(DATA / 'novel-lexicon.json').write_text(json.dumps(entries,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(ROOT / 'scripts/novel-lexicon-review.json').write_text(json.dumps(unmatched,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'{len(entries)} supporting entries; {len(unmatched)} require editorial review')
