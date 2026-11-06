#!/usr/bin/env python3
import sys
import os

try:
    from PIL import Image, ImageChops
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pillow"])
    from PIL import Image, ImageChops

def compare_images(img1_path, img2_path, diff_path, threshold=0.1):
    if not os.path.exists(img1_path) or not os.path.exists(img2_path):
        print(f"Error: One or both files missing: {img1_path}, {img2_path}")
        return 1

    img1 = Image.open(img1_path).convert("RGBA")
    img2 = Image.open(img2_path).convert("RGBA")

    # Ensure same size for pixel comparison
    w = min(img1.width, img2.width)
    h = min(img1.height, img2.height)

    img1 = img1.crop((0, 0, w, h))
    img2 = img2.crop((0, 0, w, h))

    pixels1 = img1.load()
    pixels2 = img2.load()

    diff_img = Image.new("RGBA", (w, h), (255, 255, 255, 255))
    diff_pixels = diff_img.load()

    total_pixels = w * h
    diff_count = 0

    max_delta = 255 * 3 * threshold

    for y in range(h):
        for x in range(w):
            r1, g1, b1, a1 = pixels1[x, y]
            r2, g2, b2, a2 = pixels2[x, y]

            delta = abs(r1 - r2) + abs(g1 - g2) + abs(b1 - b2)
            if delta > max_delta:
                diff_count += 1
                # Highlight diff pixel in bright red/magenta
                diff_pixels[x, y] = (255, 0, 100, 255)
            else:
                # Dim background for context
                gray = int((r1 + g1 + b1) / 3 * 0.3 + 180)
                diff_pixels[x, y] = (gray, gray, gray, 255)

    diff_img.save(diff_path)
    diff_ratio = (diff_count / total_pixels) * 100

    print("==========================================")
    print("      DevHub GPUI 像素级还原校验报告      ")
    print("==========================================")
    print(f"基准图片 (Web):   {img1_path} ({w}x{h})")
    print(f"比对图片 (GPUI):  {img2_path} ({w}x{h})")
    print(f"差异高亮图:       {diff_path}")
    print(f"总比对像素:       {total_pixels:,}")
    print(f"差异像素数:       {diff_count:,}")
    print(f"像素差异率 (Diff): {diff_ratio:.2f}%")
    print("==========================================")
    return 0

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python3 visual_diff.py <ref_web.png> <gpui_live.png> <diff_out.png>")
        sys.exit(1)
    compare_images(sys.argv[1], sys.argv[2], sys.argv[3])
