"""Run:  python verify.py   -- checks the folder is a loadable MV3 extension."""
import json, os, re, sys
root = os.path.dirname(os.path.abspath(__file__))
err = []
mp = os.path.join(root, "manifest.json")
if not os.path.isfile(mp): sys.exit("FAIL: manifest.json is not in " + root)
raw = open(mp, "rb").read()
if raw.startswith(b"\xef\xbb\xbf"): err.append("manifest.json has a BOM")
m = json.loads(raw.decode("utf-8"))
if m.get("manifest_version") != 3: err.append("manifest_version must be 3")
refs = [m["background"]["service_worker"], m["action"]["default_popup"]]
refs += list(m["icons"].values()) + list(m["action"]["default_icon"].values())
for r in refs:
    if not os.path.isfile(os.path.join(root, r)): err.append("missing file: " + r)
for f in ("popup/popup.html",):
    h = open(os.path.join(root, f), encoding="utf-8").read()
    for r in re.findall(r'(?:src|href)="([^"]+)"', h):
        if not os.path.isfile(os.path.join(root, os.path.dirname(f), r)): err.append(f"{f}: missing {r}")
for f in ("background.js", "popup/popup.js"):
    s = open(os.path.join(root, f), encoding="utf-8").read()
    for r in re.findall(r"from '([^']+)'", s):
        if not os.path.isfile(os.path.normpath(os.path.join(root, os.path.dirname(f), r))): err.append(f"{f}: bad import {r}")
print("\n".join("FAIL: " + e for e in err) if err else "OK: manifest valid, all referenced files exist.")
sys.exit(1 if err else 0)
