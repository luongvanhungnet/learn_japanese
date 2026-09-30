"""Combine the supplied PDF's OCR with a numbered text cross-check list.

Run after prepare_n2.py and ocr_n2.mjs. The text list is used to correct
Japanese OCR, while PDF OCR supplies Hán Việt and Vietnamese meanings.
"""
from __future__ import annotations

import json
import re
import tempfile
import unicodedata
import urllib.request
from difflib import SequenceMatcher
from pathlib import Path

import lxml.html
from PIL import Image

from import_n3 import CHAR_OVERRIDES, KANJI_URL, ROOT, is_han, unihan_readings

TEXT_URL = "https://tiengnhatvui.com/tu-vung-mimikara-n2.html"
OCR_DIR = Path(tempfile.gettempdir()) / "mimikara_n2_cells"
OVERRIDES_PATH = ROOT / "scripts" / "n2_overrides.json"


def text_list() -> dict[int, list[str]]:
    with urllib.request.urlopen(TEXT_URL, timeout=60) as response:
        page = lxml.html.fromstring(response.read())
    result = {}
    for row in page.xpath("//table//tr"):
        cells = [cell.text_content().strip() for cell in row.xpath("./td")]
        if len(cells) >= 4 and cells[0].isdigit():
            result[int(cells[0])] = cells
    if sorted(result) != list(range(1, 1161)):
        raise ValueError("Text cross-check list is incomplete")
    return result


def clean_japanese(value: str) -> str:
    return re.sub(r"\s+", "", value).replace("･", "・")


def clean_vietnamese(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip(" .,;:~")


def ink_pixels(path: Path) -> int:
    image = Image.open(path).convert("L")
    return sum(pixel < 150 for pixel in image.get_flattened_data())


def meaning_parts(value: str) -> list[str]:
    parts = []
    buffer = []
    depth = 0
    for char in value:
        if char in "(（":
            depth += 1
        elif char in ")）" and depth:
            depth -= 1
        if char in ",;；" and not depth:
            parts.append("".join(buffer))
            buffer = []
        else:
            buffer.append(char)
    parts.append("".join(buffer))
    cleaned = []
    for part in parts:
        part = re.sub(r"\([^)]*\)|（[^）]*）", "", part)
        part = re.split(r"[（(]", part, 1)[0].strip(" .,:;\t\n")
        if part:
            cleaned.append(part)
    return list(dict.fromkeys(cleaned))


def edit_distance(left: str, right: str) -> int:
    previous = list(range(len(right) + 1))
    for i, char in enumerate(left, 1):
        current = [i]
        for j, other in enumerate(right, 1):
            current.append(min(current[-1] + 1, previous[j] + 1, previous[j - 1] + (char != other)))
        previous = current
    return previous[-1]


def repair_ocr_meanings(parts: list[str], site_meaning: str, number: int) -> list[str]:
    """Use the parallel text list only for near-identical spelling repairs."""
    site_parts = meaning_parts(unicodedata.normalize("NFKC", site_meaning))
    deny = {94, 278, 399, 543, 670, 697, 727, 741, 970, 1030}
    repaired = []
    for part in parts:
        if number in deny or not re.fullmatch(r"[A-Za-zÀ-ỹĐđ\s]+", part):
            repaired.append(part)
            continue
        candidates = []
        for reference in site_parts:
            if not re.fullmatch(r"[A-Za-zÀ-ỹĐđ\s]+", reference):
                continue
            if number == 825 and part.lower() == "phản đối":
                continue
            left, right = part.casefold(), reference.casefold()
            distance = edit_distance(left, right)
            similarity = SequenceMatcher(None, left, right).ratio()
            if 0 < distance <= 2 and similarity >= 0.82:
                candidates.append((distance, -similarity, reference))
        repaired.append(min(candidates)[2] if candidates else part)
    return list(dict.fromkeys(repaired))


def plain_letters(value: str) -> str:
    folded = unicodedata.normalize("NFD", value.lower()).replace("đ", "d")
    return "".join(char for char in folded if unicodedata.category(char).startswith("L"))


def main() -> None:
    indexed = text_list()
    ocr = json.loads((OCR_DIR / "ocr-progress.json").read_text(encoding="utf-8"))
    if len(ocr) != 1160:
        raise ValueError("PDF OCR must contain 1160 rows")
    readings = unihan_readings()
    with urllib.request.urlopen(KANJI_URL, timeout=60) as response:
        kanji = json.load(response)
    overrides = json.loads(OVERRIDES_PATH.read_text(encoding="utf-8")) if OVERRIDES_PATH.exists() else {}
    result = []
    flags = []
    for item in ocr:
        number = item["order"]
        site = indexed[number]
        reading = clean_japanese(site[2])
        has_headword = ink_pixels(OCR_DIR / f"{number:04}-headword.png") > 180
        headword = clean_japanese(site[1]) if has_headword else reading
        # OCR occasionally drops a visible kanji; the numbered text list supplies it.
        first_form = re.split(r"[・（(]", headword)[0]
        han_chars = [char for char in first_form if is_han(char)]
        derived = " ".join(
            CHAR_OVERRIDES[char] if char in CHAR_OVERRIDES else (kanji.get(char, {}).get("han_viet") or readings.get(char) or ["?"])[0]
            for char in han_chars
        ).upper() if han_chars else None
        hv_ocr = clean_vietnamese(item["hanViet"]["text"]).upper()
        if han_chars:
            ocr_valid = item["hanViet"]["confidence"] >= 83 and re.fullmatch(r"[A-ZÀ-Ỵ Đ./\-]+", hv_ocr)
            # Column OCR can slip into an adjacent row even at high confidence.
            # The character reading is the stable default; manually reviewed
            # source readings are applied through n2_overrides.json below.
            han_viet = derived if derived and "?" not in derived else hv_ocr if ocr_valid else derived
            if ocr_valid and derived and plain_letters(hv_ocr) != plain_letters(derived):
                flags.append([number, "hanVietMismatch", hv_ocr, derived])
            if not han_viet or "?" in han_viet:
                flags.append([number, "hanVietMissing", headword, han_viet])
        else:
            han_viet = None
        pdf_meaning = clean_vietnamese(item["meaning"]["text"])
        meaning = pdf_meaning if item["meaning"]["confidence"] >= 85 else clean_vietnamese(site[3])
        if item["meaning"]["confidence"] < 85:
            flags.append([number, "meaningLowConfidence", item["meaning"]["text"], site[3]])
        pdf_reading = clean_japanese(item["reading"]["text"])
        if item["reading"]["confidence"] >= 75 and pdf_reading != reading:
            flags.append([number, "readingMismatch", pdf_reading, reading])
        if has_headword and item["headword"]["confidence"] >= 75:
            pdf_headword = clean_japanese(item["headword"]["text"])
            if pdf_headword != headword:
                flags.append([number, "headwordMismatch", pdf_headword, headword])
        entry = {
            "id": f"n2:{number}",
            "level": "N2",
            "order": number,
            "headword": headword,
            "reading": reading,
            "hanViet": han_viet,
            "meanings": repair_ocr_meanings(meaning_parts(meaning), site[3], number),
        }
        entry.update(overrides.get(str(number), {}))
        result.append(entry)
    if [entry["order"] for entry in result] != list(range(1, 1161)):
        raise ValueError("N2 ordering changed")
    output = ROOT / "src" / "data" / "n2.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (ROOT / "scripts" / "n2_review.json").write_text(json.dumps(flags, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Wrote", len(result), "N2 entries")
    print("flags", {kind: sum(flag[1] == kind for flag in flags) for kind in sorted(set(flag[1] for flag in flags))})


if __name__ == "__main__":
    main()
