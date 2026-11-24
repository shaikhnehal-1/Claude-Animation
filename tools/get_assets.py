"""Download every free (CC0) asset the Doom video uses.

  python tools/get_assets.py

Poly Haven skies / textures / props -> studio/public/ph/
three.js example characters + birds -> studio/public/models/
Safe to run again: files that already exist are skipped.
"""
import os
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(__file__))
import polyhaven as ph  # noqa: E402

HDRIS = ["rogland_moonlit_night", "kloppenheim_02_puresky"]
TEXTURES = [
    "castle_brick_07", "castle_wall_slates", "castle_wall_varriation", "cobblestone_floor_04", "rock_face_02",
    "defense_wall", "snow_02", "brown_planks_05", "dark_wooden_planks", "plaster_stone_wall_01", "grey_roof_tiles",
    "asphalt_02", "concrete_tiles", "marble_tiles", "metal_plate", "brick_wall_02", "floor_tiles_06",
]
MODELS = [
    "wooden_barrels_01", "wooden_lantern_01", "large_castle_door", "kite_shield", "wooden_crate_01",
    "treasure_chest", "street_lamp_01", "stone_fire_pit", "wooden_bucket_01", "vintage_oil_lamp",
]
THREE = "https://raw.githubusercontent.com/mrdoob/three.js/r170/examples/models/gltf/"
THREE_MODELS = ["Xbot.glb", "Soldier.glb", "Michelle.glb", "Parrot.glb", "Flamingo.glb", "Horse.glb"]


def main():
    for h in HDRIS:
        ph.hdri(h, "2k")
    for t in TEXTURES:
        print("tex", t)
        ph.tex(t, "1k")
    for m in MODELS:
        print("model", m)
        ph.model(m, "1k")
    out = os.path.join(os.path.dirname(__file__), "..", "studio", "public", "models")
    os.makedirs(out, exist_ok=True)
    for m in THREE_MODELS:
        p = os.path.join(out, m)
        if not os.path.exists(p):
            open(p, "wb").write(urllib.request.urlopen(urllib.request.Request(THREE + m, headers=ph.UA), timeout=120).read())
        print("  models/" + m)
    print("\nAll assets ready.")


if __name__ == "__main__":
    main()
