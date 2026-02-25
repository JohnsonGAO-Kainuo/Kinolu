"""Downsample 64^3 .cube LUTs to 33^3 for web delivery."""

import os

def downsample_cube(inpath, outpath, target_size=33):
    lines = open(inpath).read().strip().split("\n")
    title = ""
    size = 0
    data = []
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("TITLE"):
            title = line.replace("TITLE", "").strip().strip('"')
            continue
        if line.startswith("LUT_3D_SIZE"):
            size = int(line.split()[-1])
            continue
        if line.startswith("DOMAIN"):
            continue
        parts = line.split()
        if len(parts) >= 3:
            try:
                data.append((float(parts[0]), float(parts[1]), float(parts[2])))
            except ValueError:
                continue

    if size <= target_size:
        print(f"  {os.path.basename(inpath)}: already size {size}, skipped")
        return

    def get(ri, gi, bi):
        idx = bi * size * size + gi * size + ri
        return data[idx]

    def lerp(a, b, t):
        return a + (b - a) * t

    def sample(r, g, b):
        mx = size - 1
        rs, gs, bs = r * mx, g * mx, b * mx
        r0, g0, b0 = int(rs), int(gs), int(bs)
        r1 = min(r0 + 1, mx)
        g1 = min(g0 + 1, mx)
        b1 = min(b0 + 1, mx)
        rd, gd, bd = rs - r0, gs - g0, bs - b0
        result = []
        for ch in range(3):
            c000 = get(r0, g0, b0)[ch]
            c100 = get(r1, g0, b0)[ch]
            c010 = get(r0, g1, b0)[ch]
            c110 = get(r1, g1, b0)[ch]
            c001 = get(r0, g0, b1)[ch]
            c101 = get(r1, g0, b1)[ch]
            c011 = get(r0, g1, b1)[ch]
            c111 = get(r1, g1, b1)[ch]
            c00 = lerp(c000, c100, rd)
            c10 = lerp(c010, c110, rd)
            c01 = lerp(c001, c101, rd)
            c11 = lerp(c011, c111, rd)
            c0 = lerp(c00, c10, gd)
            c1 = lerp(c01, c11, gd)
            result.append(lerp(c0, c1, bd))
        return result

    out_lines = [f'TITLE "{title}"', f"LUT_3D_SIZE {target_size}", ""]
    mx2 = target_size - 1
    for bi in range(target_size):
        for gi in range(target_size):
            for ri in range(target_size):
                r, g, b = ri / mx2, gi / mx2, bi / mx2
                nr, ng, nb = sample(r, g, b)
                out_lines.append(f"{nr:.6f} {ng:.6f} {nb:.6f}")

    with open(outpath, "w") as f:
        f.write("\n".join(out_lines))
    print(f"  {os.path.basename(inpath)}: {size}^3 -> {target_size}^3")


if __name__ == "__main__":
    dir_path = os.path.join(os.path.dirname(__file__), "..", "public", "luts", "builtin")
    for fname in sorted(os.listdir(dir_path)):
        if fname.endswith(".cube"):
            fpath = os.path.join(dir_path, fname)
            downsample_cube(fpath, fpath, 33)
    print("Done!")
