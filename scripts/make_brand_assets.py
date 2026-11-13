"""Generate sexy, precision aeronautical SVG and PNG brand assets for AIRTRUTH:
- favicon.svg
- apple-touch-icon.png (180x180)
- icon-192.png (192x192)
- icon-512.png (512x512)
- icon-maskable-512.png (512x512)
- favicon.ico (multi-resolution 16, 32, 48)
"""
import math
import os
import struct
import time
import zlib
from pathlib import Path

# Paths
PUBLIC_DIR = Path(__file__).resolve().parent.parent / "apps" / "web" / "public"
PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

# 1. Generate master SVG
SVG_CONTENT = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <!-- Background Vignette -->
    <radialGradient id="at-bg" cx="50%" cy="32%" r="68%">
      <stop offset="0%" stop-color="#121826" />
      <stop offset="65%" stop-color="#080b12" />
      <stop offset="100%" stop-color="#040609" />
    </radialGradient>

    <!-- Outer Chamfer Border -->
    <linearGradient id="at-border" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="rgba(255, 255, 255, 0.28)" />
      <stop offset="35%" stop-color="rgba(58, 43, 255, 0.75)" />
      <stop offset="70%" stop-color="rgba(58, 43, 255, 0.2)" />
      <stop offset="100%" stop-color="rgba(255, 255, 255, 0.08)" />
    </linearGradient>

    <!-- Radar Primary Ring Gradient -->
    <linearGradient id="at-radar" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7366ff" />
      <stop offset="45%" stop-color="#3a2bff" />
      <stop offset="100%" stop-color="#2416d8" />
    </linearGradient>

    <!-- Left Wing Surface (Luminescent White) -->
    <linearGradient id="at-wing-l" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="65%" stop-color="#e2e8f5" />
      <stop offset="100%" stop-color="#cbd5e1" />
    </linearGradient>

    <!-- Right Wing Surface (Stealth Shading) -->
    <linearGradient id="at-wing-r" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f8fafc" />
      <stop offset="65%" stop-color="#cbd5e1" />
      <stop offset="100%" stop-color="#8896ab" />
    </linearGradient>

    <!-- Fuselage Spine / Radar Beam -->
    <linearGradient id="at-spine" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="25%" stop-color="#7366ff" />
      <stop offset="100%" stop-color="#3a2bff" />
    </linearGradient>

    <!-- Electric Blue Glow Filter -->
    <filter id="at-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="9" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <!-- Precision Aerospace Squircle Capsule -->
  <rect x="8" y="8" width="496" height="496" rx="120" fill="url(#at-bg)" stroke="url(#at-border)" stroke-width="4.5" />

  <!-- Outer Concentric Radar Boundary -->
  <circle cx="256" cy="256" r="190" fill="none" stroke="rgba(58, 43, 255, 0.22)" stroke-width="2" />

  <!-- Luminous Primary Radar Ring -->
  <circle cx="256" cy="256" r="176" fill="none" stroke="url(#at-radar)" stroke-width="7" filter="url(#at-glow)" opacity="0.9" />
  <circle cx="256" cy="256" r="176" fill="none" stroke="url(#at-radar)" stroke-width="5.5" />

  <!-- Concentric Inner ADS-B Transponder Reticle -->
  <circle cx="256" cy="256" r="126" fill="none" stroke="rgba(255, 255, 255, 0.2)" stroke-width="2.2" stroke-dasharray="5 9" />

  <!-- Radar Cardinal Calibration Ticks (North, East, South, West) -->
  <line x1="256" y1="52" x2="256" y2="78" stroke="#7366ff" stroke-width="4.5" stroke-linecap="round" />
  <line x1="256" y1="434" x2="256" y2="460" stroke="#7366ff" stroke-width="4.5" stroke-linecap="round" />
  <line x1="52" y1="256" x2="78" y2="256" stroke="#7366ff" stroke-width="4.5" stroke-linecap="round" />
  <line x1="434" y1="256" x2="460" y2="256" stroke="#7366ff" stroke-width="4.5" stroke-linecap="round" />

  <!-- Diagonal Calibration Precision Pings -->
  <circle cx="148" cy="148" r="3.5" fill="#5445ff" />
  <circle cx="364" cy="148" r="3.5" fill="#5445ff" />
  <circle cx="148" cy="364" r="3.5" fill="#5445ff" />
  <circle cx="364" cy="364" r="3.5" fill="#5445ff" />

  <!-- Dynamic Radar Sweep Arc (Luminous Horizon) -->
  <path d="M 256 80 A 176 176 0 0 1 432 256" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity="0.9" />

  <!-- Supersonic Stealth Delta Aircraft -->
  <!-- Left Main Wing Surface -->
  <path d="M 256 122 L 124 356 L 216 312 L 256 292 Z" fill="url(#at-wing-l)" />

  <!-- Right Main Wing Surface -->
  <path d="M 256 122 L 388 356 L 296 312 L 256 292 Z" fill="url(#at-wing-r)" />

  <!-- Precision Winglet Fins -->
  <path d="M 124 356 L 114 340 L 132 344 Z" fill="#7366ff" />
  <path d="M 388 356 L 398 340 L 380 344 Z" fill="#7366ff" />

  <!-- Center Dorsal Keel & Telemetry Spine -->
  <path d="M 256 122 L 261.5 284 L 256 294 L 250.5 284 Z" fill="url(#at-spine)" />

  <!-- Transponder Cryptographic Core Beacon -->
  <circle cx="256" cy="246" r="7.5" fill="#ffffff" />
  <circle cx="256" cy="246" r="17" fill="none" stroke="#3a2bff" stroke-width="2.8" opacity="0.95" />
</svg>"""

(PUBLIC_DIR / "favicon.svg").write_text(SVG_CONTENT, encoding="utf-8")
print(f"Wrote master SVG: {PUBLIC_DIR / 'favicon.svg'}")


# 2. Pure-Python High-Precision Software Rasterizer for PNG/ICO assets
def clamp(val, low=0.0, high=1.0):
    return max(low, min(high, val))

def blend_color(bg, fg, alpha):
    # fg over bg
    inv_a = 1.0 - alpha
    r = int(bg[0] * inv_a + fg[0] * alpha)
    g = int(bg[1] * inv_a + fg[1] * alpha)
    b = int(bg[2] * inv_a + fg[2] * alpha)
    a = int(bg[3] * inv_a + fg[3] * alpha)
    return (r, g, b, a)

def point_in_poly(px, py, poly):
    inside = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        if ((y1 > py) != (y2 > py)) and (px < (x2 - x1) * (py - y1) / (y2 - y1 + 1e-12) + x1):
            inside = not inside
    return inside

def dist_to_segment(px, py, x1, y1, x2, y2):
    dx = x2 - x1
    dy = y2 - y1
    l2 = dx * dx + dy * dy
    if l2 == 0:
        return math.hypot(px - x1, py - y1)
    t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / l2))
    proj_x = x1 + t * dx
    proj_y = y1 + t * dy
    return math.hypot(px - proj_x, py - proj_y)

def dist_squircle(px, py, cx, cy, half_size, radius):
    # Signed distance to rounded rectangle
    qx = abs(px - cx) - (half_size - radius)
    qy = abs(py - cy) - (half_size - radius)
    ax = max(qx, 0.0)
    ay = max(qy, 0.0)
    outside = math.hypot(ax, ay)
    inside = min(max(qx, qy), 0.0)
    return (outside + inside) - radius


def render_brand_bitmap(size: int) -> bytearray:
    """Render anti-aliased 512-coordinate brand vector down to target bitmap size."""
    scale = size / 512.0
    pixels = bytearray(size * size * 4)

    # Coordinates in 512 canvas
    wing_left_poly = [(256, 122), (124, 356), (216, 312), (256, 292)]
    wing_right_poly = [(256, 122), (388, 356), (296, 312), (256, 292)]
    spine_poly = [(256, 122), (261.5, 284), (256, 294), (250.5, 284)]

    # 2x2 Supersampling per pixel for razor-sharp edges
    sub_offsets = [(-0.25, -0.25), (0.25, -0.25), (-0.25, 0.25), (0.25, 0.25)]

    for y in range(size):
        for x in range(size):
            r_acc, g_acc, b_acc, a_acc = 0.0, 0.0, 0.0, 0.0
            for sx, sy in sub_offsets:
                # Map to 512 coordinate space
                px = (x + 0.5 + sx) / scale
                py = (y + 0.5 + sy) / scale

                # 1. Base squircle
                d_sq = dist_squircle(px, py, 256, 256, 240, 115)
                if d_sq > 2.0:
                    continue  # outside icon
                sq_alpha = clamp(0.5 - d_sq)

                # Radial vignette background
                d_center = math.hypot(px - 256, py - 180)
                vig = clamp(d_center / 320.0)
                # #121826 -> #040609
                bg_r = int(18 * (1 - vig) + 4 * vig)
                bg_g = int(24 * (1 - vig) + 6 * vig)
                bg_b = int(38 * (1 - vig) + 9 * vig)
                col = (bg_r, bg_g, bg_b, 255)

                # Border stroke
                if abs(d_sq) < 2.5:
                    b_alpha = clamp(1.0 - abs(d_sq) / 2.5)
                    # Electric blue / white border accent
                    col = blend_color(col, (58, 43, 255, 255), b_alpha * 0.75)

                # 2. Outer concentric radar ring (r=190, stroke=2)
                d_r1 = abs(math.hypot(px - 256, py - 256) - 190)
                if d_r1 < 2.0:
                    r1_alpha = clamp(1.0 - d_r1 / 2.0) * 0.35
                    col = blend_color(col, (58, 43, 255, 255), r1_alpha)

                # 3. Luminous primary radar ring (r=176, stroke=6)
                d_r2 = abs(math.hypot(px - 256, py - 256) - 176)
                if d_r2 < 4.0:
                    r2_alpha = clamp(1.0 - d_r2 / 4.0)
                    col = blend_color(col, (75, 58, 255, 255), r2_alpha * 0.95)
                # Outer glow
                elif d_r2 < 12.0:
                    glow_a = clamp(1.0 - d_r2 / 12.0) * 0.45
                    col = blend_color(col, (99, 85, 255, 255), glow_a)

                # 4. Sweep Arc (Top right quadrant: angle from -90 deg to 0 deg)
                angle_deg = math.degrees(math.atan2(py - 256, px - 256))
                if -90 <= angle_deg <= 0 and abs(math.hypot(px - 256, py - 256) - 176) < 3.5:
                    sweep_a = clamp(1.0 - abs(math.hypot(px - 256, py - 256) - 176) / 3.5) * 0.85
                    col = blend_color(col, (255, 255, 255, 255), sweep_a)

                # 5. Cardinal reticle ticks
                d_tick_n = dist_to_segment(px, py, 256, 52, 256, 78)
                d_tick_s = dist_to_segment(px, py, 256, 434, 256, 460)
                d_tick_w = dist_to_segment(px, py, 52, 256, 78, 256)
                d_tick_e = dist_to_segment(px, py, 434, 256, 460, 256)
                min_tick = min(d_tick_n, d_tick_s, d_tick_w, d_tick_e)
                if min_tick < 3.0:
                    t_alpha = clamp(1.0 - min_tick / 3.0)
                    col = blend_color(col, (115, 102, 255, 255), t_alpha)

                # 6. Supersonic Delta Aircraft
                if point_in_poly(px, py, wing_left_poly):
                    # Gradient from white (tip/front) to #cbd5e1 (root)
                    t_y = clamp((py - 122) / 234.0)
                    wl_r = int(255 * (1 - t_y) + 203 * t_y)
                    wl_g = int(255 * (1 - t_y) + 213 * t_y)
                    wl_b = int(255 * (1 - t_y) + 225 * t_y)
                    col = blend_color(col, (wl_r, wl_g, wl_b, 255), 1.0)
                elif point_in_poly(px, py, wing_right_poly):
                    # Stealth facet shading #f8fafc to #8896ab
                    t_y = clamp((py - 122) / 234.0)
                    wr_r = int(248 * (1 - t_y) + 136 * t_y)
                    wr_g = int(250 * (1 - t_y) + 150 * t_y)
                    wr_b = int(252 * (1 - t_y) + 171 * t_y)
                    col = blend_color(col, (wr_r, wr_g, wr_b, 255), 1.0)

                # Center dorsal spine
                if point_in_poly(px, py, spine_poly):
                    t_sp = clamp((py - 122) / 172.0)
                    sp_r = int(255 * (1 - t_sp) + 58 * t_sp)
                    sp_g = int(255 * (1 - t_sp) + 43 * t_sp)
                    sp_b = int(255 * (1 - t_sp) + 255 * t_sp)
                    col = blend_color(col, (sp_r, sp_g, sp_b, 255), 1.0)

                # 7. Transponder beacon ping
                d_beacon = math.hypot(px - 256, py - 246)
                if d_beacon < 8.0:
                    b_a = clamp(1.0 - (d_beacon - 7.0))
                    col = blend_color(col, (255, 255, 255, 255), b_a)
                elif abs(d_beacon - 17.0) < 2.2:
                    p_a = clamp(1.0 - abs(d_beacon - 17.0) / 2.2) * 0.95
                    col = blend_color(col, (58, 43, 255, 255), p_a)

                # Accumulate subpixel with outer squircle alpha
                final_a = col[3] * sq_alpha
                r_acc += col[0] * (final_a / 255.0)
                g_acc += col[1] * (final_a / 255.0)
                b_acc += col[2] * (final_a / 255.0)
                a_acc += final_a

            # Average subpixels
            a_final = int(round(a_acc / 4.0))
            if a_final > 0:
                inv_af = 255.0 / a_final
                r_final = int(round(clamp((r_acc / 4.0) * inv_af, 0, 255)))
                g_final = int(round(clamp((g_acc / 4.0) * inv_af, 0, 255)))
                b_final = int(round(clamp((b_acc / 4.0) * inv_af, 0, 255)))
            else:
                r_final, g_final, b_final = 0, 0, 0

            idx = (y * size + x) * 4
            pixels[idx] = r_final
            pixels[idx + 1] = g_final
            pixels[idx + 2] = b_final
            pixels[idx + 3] = a_final

    return pixels


def write_png_file(filepath: Path, width: int, height: int, rgba: bytearray):
    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    header = b"\x89PNG\r\n\x1a\n"
    ihdr = chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    raw = bytearray()
    for y in range(height):
        raw.append(0)  # filter type 0 (None)
        raw.extend(rgba[y * width * 4 : (y + 1) * width * 4])
    idat = chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    iend = chunk(b"IEND", b"")
    filepath.write_bytes(header + ihdr + idat + iend)


def write_ico_file(filepath: Path, png_frames: list[tuple[int, bytearray]]):
    """Write multi-resolution ICO file wrapping PNG data."""
    # ICO Header: 0 (2B), 1 = icon (2B), count (2B)
    header = struct.pack("<HHH", 0, 1, len(png_frames))
    entries = []
    image_data_blobs = []
    offset = 6 + len(png_frames) * 16

    for sz, png_bytes in png_frames:
        b_width = 0 if sz >= 256 else sz
        b_height = 0 if sz >= 256 else sz
        b_colors = 0
        b_reserved = 0
        w_planes = 1
        w_bpp = 32
        dw_bytes = len(png_bytes)
        dw_offset = offset

        entry = struct.pack(
            "<BBBBHHII",
            b_width,
            b_height,
            b_colors,
            b_reserved,
            w_planes,
            w_bpp,
            dw_bytes,
            dw_offset,
        )
        entries.append(entry)
        image_data_blobs.append(png_bytes)
        offset += dw_bytes

    with open(filepath, "wb") as f:
        f.write(header)
        for e in entries:
            f.write(e)
        for blob in image_data_blobs:
            f.write(blob)


# Generate targets
targets = [
    ("icon-512.png", 512),
    ("icon-maskable-512.png", 512),
    ("icon-192.png", 192),
    ("apple-touch-icon.png", 180),
    ("icon-48.png", 48),
    ("icon-32.png", 32),
    ("icon-16.png", 16),
]

ico_frames = []

for filename, sz in targets:
    t_start = time.time()
    print(f"Rendering {filename} ({sz}x{sz})...")
    rgba = render_brand_bitmap(sz)
    out_path = PUBLIC_DIR / filename
    write_png_file(out_path, sz, sz, rgba)
    print(f"  -> Generated {out_path} in {round(time.time() - t_start, 2)}s")

    if sz in (16, 32, 48):
        ico_frames.append((sz, out_path.read_bytes()))

# Generate favicon.ico with 16, 32, and 48 frames
write_ico_file(PUBLIC_DIR / "favicon.ico", ico_frames)
print(f"Generated multi-resolution ICO: {PUBLIC_DIR / 'favicon.ico'}")

# Clean up temp 16/32/48 png helper files
for tmp in ("icon-48.png", "icon-32.png", "icon-16.png"):
    (PUBLIC_DIR / tmp).unlink(missing_ok=True)

print("All brand assets generated successfully!")

