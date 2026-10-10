#!/usr/bin/env python3
"""Builds the fake webcam clip used by the end to end tests and the demo GIF.

A public domain portrait (test/fixtures/portraits/23.jpg) starts small and
off center, then eases into place, so the guide goes from red to green while
Chromium plays the file as its camera. Needs Pillow, numpy and ffmpeg.
"""
import json
import math
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
W, H, FPS, SECONDS = 1280, 720, 30, 8
PORTRAIT = "23.jpg"
ROLL_FIX = 3.9  # the portrait is tilted by this much, so the head ends up level


def ease(x):
    x = min(1.0, max(0.0, x))
    return x * x * (3 - 2 * x)


def person_layer():
    """The portrait with its person mask as alpha, bottom extended, sides faded."""
    src = Image.open(ROOT / "test/fixtures/portraits" / PORTRAIT).convert("RGB")
    alpha = Image.open(ROOT / "test/fixtures/camera-mask.png").getchannel("A").resize(src.size)
    rgba = np.dstack([np.asarray(src), np.asarray(alpha)])
    rgba = np.pad(rgba, ((0, 900), (0, 0), (0, 0)), mode="edge")
    ramp = np.minimum(1.0, np.minimum(np.arange(rgba.shape[1]), rgba.shape[1] - 1 - np.arange(rgba.shape[1])) / 70.0)
    rgba[..., 3] = (rgba[..., 3] * ramp[None, :]).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def wall():
    top, bottom = np.array([226, 224, 218]), np.array([208, 206, 199])
    rows = np.linspace(top, bottom, H)[:, None, :].repeat(W, axis=1)
    return Image.fromarray(rows.astype(np.uint8), "RGB").convert("RGBA")


def main(out):
    notes = {a["file"]: a for a in json.loads((ROOT / "test/fixtures/annotations.json").read_text())}[PORTRAIT]
    layer = person_layer()
    sw, sh = 900, 1200
    head = (notes["chinY"] - notes["crownY"]) * sh
    crown = notes["crownY"] * sh
    cx = sw / 2
    background = wall()
    final_scale = 0.6 * H / head
    frames = SECONDS * FPS
    proc = subprocess.Popen(
        ["ffmpeg", "-loglevel", "error", "-y", "-framerate", str(FPS), "-f", "image2pipe", "-i", "-",
         "-c:v", "mjpeg", "-q:v", "11", "-pix_fmt", "yuvj420p", str(out)],
        stdin=subprocess.PIPE,
    )
    for i in range(frames):
        t = i / FPS
        k = ease((t - 0.8) / 2.4)
        scale = final_scale * (0.5 + 0.5 * k)
        dest_x = W / 2 + 300 * (1 - k)
        dest_y = 0.13 * H + 0.1 * H * (1 - k) + 1.2 * math.sin(t * 2.1)
        roll = math.radians(7 * (1 - k) + ROLL_FIX)
        # Inverse map: output pixel (u, v) -> source pixel in the padded image.
        cos, sin = math.cos(roll), math.sin(roll)
        a, b, d, e = cos / scale, sin / scale, -sin / scale, cos / scale
        px, py = cx, crown
        c = px - (a * dest_x + b * dest_y)
        f = py - (d * dest_x + e * dest_y)
        person = layer.transform((W, H), Image.AFFINE, (a, b, c, d, e, f), resample=Image.BICUBIC)
        Image.alpha_composite(background, person).convert("RGB").save(proc.stdin, format="PNG")
    proc.stdin.close()
    proc.wait()


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ROOT / "test/fixtures/camera.mjpeg")
