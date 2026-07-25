#!/usr/bin/env python3

import argparse
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter


def clamp(value: float) -> float:
    return max(0.0, min(1.0, value))


def classify_gold(source: Image.Image, feather: float) -> Image.Image:
    hsv = source.convert("HSV")
    mask_values: list[int] = []

    for hue, saturation, value in hsv.getdata():
        # Champagne gold occupies a compact warm hue range. Saturation rejects
        # warm gray substrate; value preserves darker bronze-facing bevels.
        hue_confidence = min(
            clamp((hue - 8) / 14),
            clamp((58 - hue) / 18),
        )
        saturation_confidence = clamp((saturation - 22) / 86)
        value_confidence = clamp((value - 34) / 112)
        confidence = hue_confidence * (saturation_confidence ** 0.72) * (value_confidence ** 0.55)
        mask_values.append(round(255 * confidence))

    mask = Image.new("L", source.size)
    mask.putdata(mask_values)
    mask = ImageEnhance.Contrast(mask).enhance(1.35)
    mask = mask.filter(ImageFilter.MaxFilter(3))
    return mask.filter(ImageFilter.GaussianBlur(feather))


def build_preview(source: Image.Image, mask: Image.Image) -> Image.Image:
    dimmed = ImageEnhance.Brightness(source.convert("RGB")).enhance(0.22)
    return Image.composite(source.convert("RGB"), dimmed, mask)


def main() -> None:
    parser = argparse.ArgumentParser(description="Classify authored champagne-gold pixels into a runtime material mask.")
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--mask", required=True, type=Path)
    parser.add_argument("--preview", type=Path)
    parser.add_argument("--feather", type=float, default=0.55)
    args = parser.parse_args()

    source = Image.open(args.input).convert("RGB")
    mask = classify_gold(source, args.feather)
    args.mask.parent.mkdir(parents=True, exist_ok=True)
    mask.save(args.mask)

    if args.preview:
        preview = build_preview(source, mask)
        args.preview.parent.mkdir(parents=True, exist_ok=True)
        preview.save(args.preview)


if __name__ == "__main__":
    main()
