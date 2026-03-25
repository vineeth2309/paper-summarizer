import json
import re
import sys
from pathlib import Path

import fitz


FIGURE_RE = re.compile(r"^(Figure|Fig\.)\s*(\d+)\b", re.IGNORECASE)
ARCHITECTURE_RE = re.compile(
    r"\b(architecture|overview|pipeline|framework|method|system|workflow|diagram|model)\b",
    re.IGNORECASE,
)


def normalize_text(value: str) -> str:
    return " ".join(value.split())


def pad_rect(rect: fitz.Rect, page_rect: fitz.Rect, *, left=24, top=44, right=24, bottom=40) -> fitz.Rect:
    padded = fitz.Rect(rect.x0 - left, rect.y0 - top, rect.x1 + right, rect.y1 + bottom)
    return padded & page_rect


def expand_union(rects, page_rect: fitz.Rect):
    if not rects:
        return None

    union = fitz.Rect(rects[0])
    for rect in rects[1:]:
        union.include_rect(rect)

    return union & page_rect


def extract_captions(page: fitz.Page):
    blocks = page.get_text("blocks")
    matches = []

    for block in blocks:
        x0, y0, x1, y1, text, *_ = block
        normalized = normalize_text(text)
        match = FIGURE_RE.search(normalized)

        if not match:
            continue

        if len(normalized) > 500:
            continue

        label = f"Figure {match.group(2)}"
        matches.append(
            {
                "label": label,
                "caption": normalized,
                "rect": fitz.Rect(x0, y0, x1, y1),
                "priority": 1 if ARCHITECTURE_RE.search(normalized) else 0,
            }
        )

    matches.sort(key=lambda item: (item["rect"].y0, item["rect"].x0))
    return matches


def collect_visual_rects(page: fitz.Page):
    candidates = []
    page_rect = page.rect

    text_dict = page.get_text("dict")
    for block in text_dict.get("blocks", []):
        if block.get("type") == 1 and block.get("bbox"):
            rect = fitz.Rect(block["bbox"]) & page_rect
            if rect.width > 40 and rect.height > 40:
                candidates.append(rect)

    for drawing in page.get_drawings():
        rect = drawing.get("rect")
        if not rect:
            continue

        bounded = fitz.Rect(rect) & page_rect
        if bounded.width > 32 and bounded.height > 32:
            candidates.append(bounded)

    return candidates


def nearby_visual_rects(caption_rect: fitz.Rect, visual_rects, page_captions, page_rect: fitz.Rect):
    previous_captions = [item["rect"] for item in page_captions if item["rect"].y0 < caption_rect.y0]
    next_captions = [item["rect"] for item in page_captions if item["rect"].y0 > caption_rect.y0]

    upper_bound = previous_captions[-1].y1 + 6 if previous_captions else page_rect.y0 + page_rect.height * 0.02
    lower_bound = next_captions[0].y0 - 12 if next_captions else page_rect.y1 - page_rect.height * 0.02

    candidates = []
    for rect in visual_rects:
        if rect.y1 > caption_rect.y0 + 18:
            continue

        if rect.y0 < upper_bound - 20:
            continue

        if rect.y1 > lower_bound:
            continue

        if rect.width < page_rect.width * 0.1 or rect.height < page_rect.height * 0.05:
            continue

        horizontal_overlap = max(0, min(rect.x1, caption_rect.x1 + 180) - max(rect.x0, caption_rect.x0 - 180))
        close_horizontally = horizontal_overlap > 0 or abs(rect.x0 - caption_rect.x0) < 220 or abs(rect.x1 - caption_rect.x1) < 220

        if close_horizontally or rect.width > page_rect.width * 0.45:
            candidates.append(rect)

    return candidates


def fallback_crop_rect(caption_rect: fitz.Rect, page_captions, page_rect: fitz.Rect):
    previous_captions = [item["rect"] for item in page_captions if item["rect"].y0 < caption_rect.y0]
    next_captions = [item["rect"] for item in page_captions if item["rect"].y0 > caption_rect.y0]

    top_boundary = previous_captions[-1].y1 + 18 if previous_captions else page_rect.y0 + page_rect.height * 0.05
    bottom_boundary = caption_rect.y0 - 8

    if next_captions:
        bottom_boundary = min(bottom_boundary, next_captions[0].y0 - 16)

    if bottom_boundary <= top_boundary + 36:
        top_boundary = max(page_rect.y0 + page_rect.height * 0.04, caption_rect.y0 - page_rect.height * 0.42)
        bottom_boundary = caption_rect.y0 - 6

    raw = fitz.Rect(
        page_rect.x0 + page_rect.width * 0.03,
        top_boundary,
        page_rect.x1 - page_rect.width * 0.03,
        bottom_boundary,
    )
    return pad_rect(raw, page_rect, left=24, top=48, right=24, bottom=40)


def crop_figure(page: fitz.Page, caption_item, page_captions, visual_rects, output_path: Path):
    page_rect = page.rect
    caption_rect = caption_item["rect"]
    candidate_visuals = nearby_visual_rects(caption_rect, visual_rects, page_captions, page_rect)

    if candidate_visuals:
        crop_rect = expand_union(candidate_visuals, page_rect)
        crop_rect = pad_rect(crop_rect, page_rect, left=28, top=52, right=28, bottom=44)
    else:
        crop_rect = fallback_crop_rect(caption_rect, page_captions, page_rect)

    if crop_rect.height < 60 or crop_rect.width < 60:
        return False

    pix = page.get_pixmap(matrix=fitz.Matrix(2.4, 2.4), clip=crop_rect, alpha=False)
    pix.save(output_path)
    return True


def main():
    if len(sys.argv) != 3:
        print(json.dumps({"error": "usage: extract_figures.py <pdf_path> <output_dir>"}))
        sys.exit(1)

    pdf_path = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])
    output_dir.mkdir(parents=True, exist_ok=True)

    document = fitz.open(pdf_path)
    figures = []

    for page_index in range(document.page_count):
        page = document.load_page(page_index)
        captions = extract_captions(page)
        visual_rects = collect_visual_rects(page)

        for caption_index, item in enumerate(captions, start=1):
            safe_label = item["label"].lower().replace(" ", "-")
            output_name = f"{safe_label}-p{page_index + 1}-{caption_index}.png"
            output_path = output_dir / output_name
            image_saved = crop_figure(page, item, captions, visual_rects, output_path)

            figures.append(
                {
                    "label": item["label"],
                    "caption": item["caption"],
                    "page": page_index + 1,
                    "imagePath": output_name if image_saved else None,
                    "priority": item["priority"],
                }
            )

    figures.sort(key=lambda item: (-item["priority"], item["page"], item["label"]))
    print(json.dumps({"figures": figures}))


if __name__ == "__main__":
    main()
