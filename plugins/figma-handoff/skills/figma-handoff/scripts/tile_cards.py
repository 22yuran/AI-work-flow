#!/usr/bin/env python3
"""Tile a single Figma card image into a horizontal row of N identical cards.

Used by the figma-handoff skill when a block is a row of repeated sibling cards
that all reference one source image. Downloads one card, tiles it here.

Example:
    python3 tile_cards.py m1-single.png out/m1-card.png \
        --card-w 476 --card-h 156 --cols 3 --gap 16 --scale 2

Output size = ((card-w*cols + gap*(cols-1)) * scale) x (card-h * scale),
transparent background so it drops onto any block color.
"""
import argparse
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow required: pip3 install Pillow")


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("src", help="single-card source PNG")
    ap.add_argument("out", help="output tiled-row PNG")
    ap.add_argument("--card-w", type=int, required=True, help="logical card width (px)")
    ap.add_argument("--card-h", type=int, required=True, help="logical card height (px)")
    ap.add_argument("--cols", type=int, default=3, help="number of cards (default 3)")
    ap.add_argument("--gap", type=int, default=16, help="gap between cards (default 16)")
    ap.add_argument("--scale", type=int, default=2, help="DPI scale, e.g. 2 for @2x (default 2)")
    args = ap.parse_args()

    card = Image.open(args.src).convert("RGBA")
    cw, ch = args.card_w * args.scale, args.card_h * args.scale
    card = card.resize((cw, ch), Image.LANCZOS)

    total_w = (args.card_w * args.cols + args.gap * (args.cols - 1)) * args.scale
    canvas = Image.new("RGBA", (total_w, ch), (255, 255, 255, 0))

    x = 0
    for _ in range(args.cols):
        canvas.paste(card, (x, 0), card)
        x += cw + args.gap * args.scale

    canvas.save(args.out)
    print(f"{args.out}  {canvas.size[0]}x{canvas.size[1]}  ({args.cols} cards, gap {args.gap}, @{args.scale}x)")


if __name__ == "__main__":
    main()
