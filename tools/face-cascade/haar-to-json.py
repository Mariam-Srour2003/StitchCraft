"""Converts an OpenCV Haar cascade XML (new format, HAAR features, no tilted
features) into the compact JSON the API's face detector reads.

    python tools/face-cascade/haar-to-json.py haarcascade_frontalface_alt2.xml \
        apps/api/src/modules/imaging/faces/frontalface-alt2.json

The XML ships with opencv-python (cv2.data.haarcascades). Output layout:
  { width, height,
    stages: [[stageThreshold, [[nodes, leaves], ...]], ...],   # one entry per weak tree
    features: [[[x, y, w, h, weight], ...], ...] }
where each node is [left, right, featureIndex, threshold]; left/right <= 0
point at leaf -left / -right, > 0 at another node.
"""

import json
import sys
import xml.etree.ElementTree as ET


def items(parent, tag):
    return parent.find(tag).findall("_")


def main(src: str, dst: str) -> None:
    cascade = ET.parse(src).getroot().find("cascade")
    if cascade.findtext("featureType").strip() != "HAAR":
        raise SystemExit("only HAAR cascades are supported")
    if cascade.find("featureParams/maxCatCount").text.strip() != "0":
        raise SystemExit("categorical features are not supported")

    stages = []
    for stage in items(cascade, "stages"):
        trees = []
        for weak in items(stage, "weakClassifiers"):
            raw = [float(v) for v in weak.findtext("internalNodes").split()]
            nodes = [[int(raw[i]), int(raw[i + 1]), int(raw[i + 2]), raw[i + 3]] for i in range(0, len(raw), 4)]
            leaves = [float(v) for v in weak.findtext("leafValues").split()]
            trees.append([nodes, leaves])
        stages.append([float(stage.findtext("stageThreshold")), trees])

    features = []
    for feature in items(cascade, "features"):
        if (feature.findtext("tilted") or "0").strip() != "0":
            raise SystemExit("tilted features are not supported")
        rects = []
        for rect in items(feature, "rects"):
            x, y, w, h, weight = rect.text.split()
            rects.append([int(x), int(y), int(w), int(h), float(weight.rstrip("."))])
        features.append(rects)

    out = {
        "source": "OpenCV haarcascade_frontalface_alt2.xml (Rainer Lienhart), Intel License - see LICENSE-opencv-cascade.txt",
        "width": int(cascade.findtext("width")),
        "height": int(cascade.findtext("height")),
        "stages": stages,
        "features": features,
    }
    with open(dst, "w") as fh:
        json.dump(out, fh, separators=(",", ":"))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
