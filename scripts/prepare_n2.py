"""Cut the image-only N2 PDF into table cells for local OCR.

Requires 1400px-wide page PNGs named mimikara_n2_page-01.png ... -44.png
in the Windows temp directory, generated with pdftoppm -scale-to 1400.
"""
from __future__ import annotations

import json
import tempfile
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
TEMP = Path(tempfile.gettempdir())
OUT = TEMP / "mimikara_n2_cells"
X_RANGES = {
    "reading": (116, 337),
    "headword": (339, 517),
    "hanViet": (519, 719),
    "meaning": (721, 948),
}


def horizontal_lines(image: Image.Image) -> list[int]:
    gray = image.convert("L")
    pix = gray.load()
    candidates = []
    for y in range(245, min(image.height - 80, 1320)):
        if sum(pix[x, y] < 220 for x in range(45, 945)) > 860:
            candidates.append(y)
    groups = []
    for y in candidates:
        if not groups or y > groups[-1][-1] + 1:
            groups.append([y])
        else:
            groups[-1].append(y)
    return [round(sum(group) / len(group)) for group in groups if len(group) <= 3]


def main() -> None:
    OUT.mkdir(exist_ok=True)
    manifest = []
    counts = []
    for page in range(1, 45):
        path = TEMP / f"mimikara_n2_page-{page:02}.png"
        image = Image.open(path).convert("RGB")
        lines = horizontal_lines(image)
        # Page 1 has an extra column-heading row below the blue banner.
        top = 336 if page == 1 else 249
        bounds = [top] + [y for y in lines if y > top + 15 and y < 1300]
        rgb = image.load()
        footer = next(
            y for y in range(bounds[-1] + 20, min(image.height - 30, 1340))
            if rgb[500, y][2] > rgb[500, y][0] + 40
            and rgb[500, y][1] > rgb[500, y][0] + 20
        )
        bounds.append(footer)
        rows = [(a, b) for a, b in zip(bounds, bounds[1:]) if 27 <= b - a <= 115]
        counts.append((page, len(rows), bounds[:3], bounds[-3:]))
        for index, (y0, y1) in enumerate(rows):
            number = len(manifest) + 1
            item = {"order": number, "page": page, "row": index + 1, "cells": {}}
            for field, (x0, x1) in X_RANGES.items():
                cell = image.crop((x0, y0 + 3, x1, y1 - 2))
                cell = ImageOps.expand(cell.resize((cell.width * 3, cell.height * 3)), border=12, fill="white")
                dest = OUT / f"{number:04}-{field}.png"
                cell.save(dest)
                item["cells"][field] = str(dest)
            manifest.append(item)
    path = OUT / "manifest.json"
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print("rows", len(manifest), "manifest", path)
    print("page counts", counts)


if __name__ == "__main__":
    main()
