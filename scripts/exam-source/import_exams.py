"""Import the user's PDF as preserved page images and independently reviewed practice keys."""
from __future__ import annotations

import argparse
from hashlib import sha256
import json
from pathlib import Path
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
DATA = Path(__file__).resolve().parent
SOURCE_SHA256 = 'ba7e045d89b4ea9ac15186b12c746b1f79b85d23b98a1eb5304b7a4a3db826f1'
SOURCE_PAGES = 189
LISTENING = list(range(14, 19)) + list(range(38, 44)) + list(range(64, 70)) + list(range(104, 117)) + list(range(137, 143)) + list(range(175, 180)) + list(range(181, 190))


def read_json(path: Path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def build_manifest():
    inventory = read_json(DATA / 'inventory.json')
    keys = read_json(DATA / 'keys.json')
    papers = []
    audit = []
    all_written = {page for item in inventory for section in item['sections'] for page in section['pages']}
    assert len(all_written) == 118, 'The supplied PDF has 118 written question/passage pages.'
    assert all_written.isdisjoint(LISTENING), 'Listening pages must not appear in a written paper.'
    for item in inventory:
        key = keys.get(item['id'])
        if key is None or key.get('status') != 'reviewed':
            continue
        assert key.get('author') and key.get('reviewer'), 'A reviewed key needs two recorded reviews.'
        assert key['author'] != key['reviewer'], 'The reviewer must differ from the initial author.'
        paper = {field: item[field] for field in ('id', 'level', 'year', 'month', 'durationMinutes')}
        paper['sections'] = []
        checksums = {}
        question_count = 0
        for section in item['sections']:
            answers = key[section['id']]
            pages = section['questionPages']
            expected = (34 if item['id'] == 'n3-2022-07' else 35) if section['id'] == 'vocabulary' else 38
            assert len(answers) == len(pages) == expected, f"{item['id']} {section['id']}: wrong question/key/page count"
            assert all(answer is None or (type(answer) is int and 1 <= answer <= 4) for answer in answers), 'Answer keys must be choices 1-4, or an explicitly excluded null.'
            assert all(page in section['pages'] for page in pages), 'Question start page is outside its section.'
            uncertainties = {entry['number']: entry for entry in key.get('uncertainties', []) if entry['section'] == section['id']}
            questions = []
            for number, (answer, page) in enumerate(zip(answers, pages), 1):
                question = {'id': f"{section['id']}-{number}", 'number': number, 'answer': answer, 'page': page, 'choices': 4}
                if section['id'] == 'grammar-reading':
                    question['group'] = 'grammar' if number <= 22 else 'reading'
                if number in uncertainties:
                    question['note'] = uncertainties[number]['reason']
                if answer is None:
                    assert number in uncertainties, 'An unscored question needs a recorded explanation.'
                questions.append(question)
            paper['sections'].append({'id': section['id'], 'durationMinutes': section['durationMinutes'], 'pages': section['pages'], 'questions': questions})
            checksums[section['id']] = sha256(json.dumps(answers, separators=(',', ':')).encode()).hexdigest()
            question_count += len(questions)
        paper['answerKeyPages'] = []
        paper['notes'] = 'Practice answer key created from the supplied questions and independently reviewed. The PDF contains no printed answer keys. Listening is excluded because no audio was supplied.'
        papers.append(paper)
        audit.append({'id': item['id'], 'questionCount': question_count, 'scoredCount': sum(q['answer'] is not None for s in paper['sections'] for q in s['questions']), 'sectionCounts': {s['id']: len(s['questions']) for s in paper['sections']}, 'sourcePages': [p for s in paper['sections'] for p in s['pages']], 'answerKeyChecksums': checksums, 'author': key['author'], 'reviewer': key['reviewer'], 'reviewNotes': key.get('reviewNotes', []), 'uncertainties': key.get('uncertainties', [])})
    omitted = sorted(set(range(1, SOURCE_PAGES + 1)) - all_written - set(LISTENING))
    manifest = {'source': {'filename': 'de_thi_cac_nam.pdf', 'sha256': SOURCE_SHA256, 'pageCount': SOURCE_PAGES, 'answerKeyKind': 'reviewed-practice'}, 'papers': papers, 'excluded': [{'pages': LISTENING, 'reason': 'Listening sheets require audio. No audio is embedded in or supplied with this PDF.'}, {'pages': omitted, 'reason': 'Cover sheets and blank/security-pattern pages do not contain written exam questions.'}]}
    report = {'source': manifest['source'], 'writtenPageCount': len(all_written), 'paperCount': len(papers), 'questionCount': sum(p['questionCount'] for p in audit), 'scoredQuestionCount': sum(p['scoredCount'] for p in audit), 'papers': audit, 'excluded': manifest['excluded']}
    return manifest, report, sorted(all_written)


def render_pages(source: Path, pages: list[int]):
    from pypdf import PdfReader, PdfWriter
    from PIL import Image
    renderer = shutil.which('pdftoppm')
    if not renderer:
        raise RuntimeError('pdftoppm is required to regenerate source page images.')
    out = ROOT / 'public/exams/pages'
    out.mkdir(parents=True, exist_ok=True)
    work = ROOT / 'tmp/exam-source'
    work.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='render-', dir=work) as temporary:
        temp = Path(temporary)
        reader = PdfReader(source)
        writer = PdfWriter()
        for number in pages:
            page = reader.pages[number - 1]
            if page.rotation:
                page.transfer_rotation_to_content()
            writer.add_page(page)
        with (temp / 'written.pdf').open('wb') as stream:
            writer.write(stream)
        subprocess.run([renderer, '-scale-to-x', '1600', '-scale-to-y', '-1', '-png', str(temp / 'written.pdf'), str(temp / 'page')], check=True)
        # Poppler pads the generated sequence to the number of digits in the total.
        rendered = sorted(temp.glob('page-*.png'))
        assert len(rendered) == len(pages)
        for image_path, original_page in zip(rendered, pages):
            with Image.open(image_path) as image:
                image.convert('RGB').save(out / f'{original_page:03}.webp', format='WEBP', quality=92, method=4)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, help='Original de_thi_cac_nam.pdf. Required only for PDF verification or rendering.')
    parser.add_argument('--render', action='store_true', help='Regenerate all 118 original written-page WebP images.')
    parser.add_argument('--check', action='store_true', help='Validate the checked-in manifest, audit, and page assets without rewriting them.')
    args = parser.parse_args()
    if args.render and not args.source:
        parser.error('--render requires --source')
    if args.source:
        from pypdf import PdfReader
        assert sha256(args.source.read_bytes()).hexdigest() == SOURCE_SHA256, 'Source PDF hash differs; re-review boundaries and keys first.'
        assert len(PdfReader(args.source).pages) == SOURCE_PAGES, 'Source PDF page count differs.'
    manifest, audit, pages = build_manifest()
    manifest_path = ROOT / 'src/data/exams.json'
    audit_path = DATA / 'audit.json'
    if args.render:
        render_pages(args.source, pages)
    if args.check:
        assert read_json(manifest_path) == manifest, 'Manifest differs from reviewed keys/inventory. Run the importer.'
        assert read_json(audit_path) == audit, 'Audit differs from reviewed keys/inventory. Run the importer.'
    else:
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        audit_path.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    from PIL import Image
    for page in pages:
        path = ROOT / f'public/exams/pages/{page:03}.webp'
        assert path.exists(), f'Missing source image {path}'
        with Image.open(path) as image:
            assert image.width == 1600 and image.height > 1600, f'Unexpected source page size: {path}'
            image.verify()
    print(f"Validated {audit['paperCount']} reviewed papers, {audit['questionCount']} questions ({audit['scoredQuestionCount']} scored), and {len(pages)} source-page images.")


if __name__ == '__main__':
    main()
