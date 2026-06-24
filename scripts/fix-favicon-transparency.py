"""Make favicon corners transparent via flood-fill from edges."""

from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "app" / "icon.png"
OUTPUTS = [ROOT / "app" / "icon.png", ROOT / "public" / "favicon.png"]

BLACK_THRESHOLD = 25


def is_background_black(r: int, g: int, b: int, a: int) -> bool:
    return a > 0 and r <= BLACK_THRESHOLD and g <= BLACK_THRESHOLD and b <= BLACK_THRESHOLD


def make_transparent_corners(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    w, h = rgba.size
    pixels = rgba.load()
    background = [[False] * w for _ in range(h)]

    queue: deque[tuple[int, int]] = deque()
    for x in range(w):
        for y in (0, h - 1):
            if is_background_black(*pixels[x, y]):
                background[y][x] = True
                queue.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if not background[y][x] and is_background_black(*pixels[x, y]):
                background[y][x] = True
                queue.append((x, y))

    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and not background[ny][nx]:
                if is_background_black(*pixels[nx, ny]):
                    background[ny][nx] = True
                    queue.append((nx, ny))

    for y in range(h):
        for x in range(w):
            if background[y][x]:
                pixels[x, y] = (0, 0, 0, 0)

    return rgba


def main() -> None:
    img = Image.open(SOURCE)
    fixed = make_transparent_corners(img)
    for path in OUTPUTS:
        fixed.save(path, format="PNG", optimize=True)
        print(f"Wrote {path}")


if __name__ == "__main__":
    main()
