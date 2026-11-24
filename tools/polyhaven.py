"""Download CC0 assets from Poly Haven into studio/public/ph/.

  python tools/polyhaven.py hdri <name> [1k|2k]
  python tools/polyhaven.py tex <name> [1k|2k]      -> diff / nor_gl / rough jpgs
  python tools/polyhaven.py model <name> [1k|2k]    -> gltf + bin + textures
"""
import json
import os
import sys
import urllib.request

OUT = os.path.join(os.path.dirname(__file__), "..", "studio", "public", "ph")
UA = {"User-Agent": "anim-studio/1.0"}


def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120).read()


def save(url, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if not os.path.exists(path):
        open(path, "wb").write(get(url))
    print("  ", os.path.relpath(path, OUT))


def files(name):
    return json.loads(get(f"https://api.polyhaven.com/files/{name}"))


def hdri(name, res="2k"):
    f = files(name)["hdri"][res]["hdr"]
    save(f["url"], os.path.join(OUT, "hdri", f"{name}_{res}.hdr"))


def tex(name, res="1k"):
    f = files(name)
    for key, short in [("Diffuse", "diff"), ("nor_gl", "nor"), ("Rough", "rough"), ("AO", "ao")]:
        if key in f and res in f[key]:
            u = f[key][res]["jpg"]["url"]
            save(u, os.path.join(OUT, "tex", name, f"{short}.jpg"))


def model(name, res="1k"):
    g = files(name)["gltf"][res]["gltf"]
    d = os.path.join(OUT, "models", name)
    save(g["url"], os.path.join(d, f"{name}.gltf"))
    for rel, inc in g.get("include", {}).items():
        save(inc["url"], os.path.join(d, rel))


if __name__ == "__main__":
    kind, name = sys.argv[1], sys.argv[2]
    res = sys.argv[3] if len(sys.argv) > 3 else ("2k" if kind == "hdri" else "1k")
    print(kind, name, res)
    {"hdri": hdri, "tex": tex, "model": model}[kind](name, res)
