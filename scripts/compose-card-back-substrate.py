#!/usr/bin/env python3

import argparse
from pathlib import Path

from PIL import Image


def smoothstep(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3 - 2 * value)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Use a clean generated edge while preserving the registered authored substrate interior."
    )
    parser.add_argument("--interior", required=True, type=Path)
    parser.add_argument("--edge", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--edge-width", type=int, default=52)
    parser.add_argument("--feather", type=int, default=16)
    args = parser.parse_args()

    interior = Image.open(args.interior).convert("RGB")
    edge = Image.open(args.edge).convert("RGB")
    if interior.size != edge.size:
        raise ValueError(f"Asset sizes differ: {interior.size} != {edge.size}")

    width, height = interior.size
    mask = Image.new("L", interior.size)
    values: list[int] = []
    for y in range(height):
        for x in range(width):
            distance = min(x, y, width - 1 - x, height - 1 - y)
            blend = smoothstep((distance - args.edge_width) / args.feather)
            values.append(round(255 * blend))
    mask.putdata(values)

    output = Image.composite(interior, edge, mask)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    output.save(args.output)


if __name__ == "__main__":
    main()
