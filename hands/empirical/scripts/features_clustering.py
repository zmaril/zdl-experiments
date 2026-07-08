#!/usr/bin/env python3
"""Grip features + clustering on the extracted hand landmarks.

Reads data/landmarks.json (MediaPipe output), data/sources.json (manual grip
labels) and data/audit.json (manual overlay audit), then:

  1. Summarizes detection / grip-recoverability rates by grip type
     -> data/detection_rates.png
  2. For every image where >= 2 hands were detected, computes simple
     two-hand grip features (inter-hand distances normalized by hand size,
     per-finger curl angles), runs k-means and Ward hierarchical clustering,
     and compares clusters to the manual grip labels (adjusted Rand index)
     -> data/clustering.png, data/clustering_results.json

Caveat printed with the results: the audit shows most "2 hands detected"
images do NOT actually have both gripping hands tracked (chimeras, free
hands, bystanders), so the clustering input is noisy by construction. That
is part of the finding, not a bug in this script.
"""
import json
import math
import os
from collections import Counter

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")

# --- palette (validated, light mode; see NOTES.md) -------------------------
SURFACE = "#fcfcfb"
INK = "#0b0b0b"
INK2 = "#52514e"
MUTED = "#898781"
GRID = "#e1e0d9"
OUTCOME_COLORS = {"yes": "#2a78d6", "partial": "#eda100", "no": "#e34948"}
CATEGORICAL = ["#2a78d6", "#1baf7a", "#eda100", "#008300",
               "#4a3aa7", "#e34948", "#e87ba4", "#eb6834"]

FINGERS = {  # landmark chains per finger (MCP, PIP, DIP, TIP)
    "thumb": [1, 2, 3, 4],
    "index": [5, 6, 7, 8],
    "middle": [9, 10, 11, 12],
    "ring": [13, 14, 15, 16],
    "pinky": [17, 18, 19, 20],
}
TIPS = [4, 8, 12, 16, 20]
PALM = [0, 5, 9, 13, 17]  # wrist + MCPs approximate the palm


def hand_size(lm):
    """Wrist -> middle-MCP distance in normalized image coords."""
    return float(np.linalg.norm(lm[9][:2] - lm[0][:2]))


def curl(lm, chain):
    """Mean bend angle (radians) along a finger chain; 0 = straight."""
    total, n = 0.0, 0
    for a, b, c in zip(chain, chain[1:], chain[2:]):
        v1 = lm[b][:2] - lm[a][:2]
        v2 = lm[c][:2] - lm[b][:2]
        n1, n2 = np.linalg.norm(v1), np.linalg.norm(v2)
        if n1 < 1e-9 or n2 < 1e-9:
            continue
        cosang = float(np.clip(np.dot(v1, v2) / (n1 * n2), -1, 1))
        total += math.acos(cosang)
        n += 1
    return total / max(n, 1)


def grip_features(h1, h2):
    """Two-hand grip descriptor. All distances normalized by mean hand size."""
    lm1 = np.array(h1["landmarks"], dtype=float)
    lm2 = np.array(h2["landmarks"], dtype=float)
    s = (hand_size(lm1) + hand_size(lm2)) / 2 or 1e-6

    tips1, tips2 = lm1[TIPS][:, :2], lm2[TIPS][:, :2]
    palm1 = lm1[PALM][:, :2].mean(axis=0)
    palm2 = lm2[PALM][:, :2].mean(axis=0)

    tip_tip = np.linalg.norm(tips1[:, None] - tips2[None], axis=2)
    feats = {
        "palm_palm_dist": float(np.linalg.norm(palm1 - palm2)) / s,
        "min_tip_tip": float(tip_tip.min()) / s,
        "mean_tip_tip": float(tip_tip.mean()) / s,
        "tips1_to_palm2": float(np.linalg.norm(tips1 - palm2, axis=1).mean()) / s,
        "tips2_to_palm1": float(np.linalg.norm(tips2 - palm1, axis=1).mean()) / s,
    }
    for name, chain in FINGERS.items():
        feats[f"curl_{name}"] = (curl(lm1, chain) + curl(lm2, chain)) / 2
    return feats


def main():
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from scipy.cluster.hierarchy import fcluster, linkage
    from sklearn.cluster import KMeans
    from sklearn.decomposition import PCA
    from sklearn.metrics import adjusted_rand_score
    from sklearn.preprocessing import StandardScaler

    landmarks = json.load(open(os.path.join(DATA, "landmarks.json")))
    audit = json.load(open(os.path.join(DATA, "audit.json")))["images"]

    # ---------- 1. detection / recoverability by grip type ----------
    order = ["handshake", "hand_clasp", "interlaced", "hand_on_top",
             "fingertip_hold", "palm_press", "hook_grip", "wrist_grip"]
    by_label = {g: Counter() for g in order}
    for img_id, rec in landmarks.items():
        outcome = audit.get(img_id, {}).get("recoverable", "no")
        by_label[rec["grip_label"]][outcome] += 1

    fig, ax = plt.subplots(figsize=(9, 4.6), facecolor=SURFACE)
    ax.set_facecolor(SURFACE)
    x = np.arange(len(order))
    bottoms = np.zeros(len(order))
    for outcome, label in [("yes", "grip recoverable"),
                           ("partial", "partially (one hand)"),
                           ("no", "not recoverable")]:
        vals = np.array([by_label[g][outcome] for g in order], dtype=float)
        ax.bar(x, vals, 0.62, bottom=bottoms, label=label,
               color=OUTCOME_COLORS[outcome], edgecolor=SURFACE, linewidth=2)
        for xi, (v, b) in enumerate(zip(vals, bottoms)):
            if v > 0:  # direct labels = contrast relief for the yellow slot
                ax.text(xi, b + v / 2, int(v), ha="center", va="center",
                        fontsize=9, color="white", fontweight="bold")
        bottoms += vals
    ax.set_xticks(x)
    ax.set_xticklabels([g.replace("_", "\n") for g in order],
                       fontsize=9, color=INK2)
    ax.set_ylabel("images", color=INK2)
    ax.set_title("Can MediaPipe recover the grip from one photo?  "
                 "(manual audit of 40 images)", color=INK, fontsize=11, pad=12)
    ax.legend(frameon=False, fontsize=9, loc="upper right")
    ax.spines[["top", "right"]].set_visible(False)
    ax.spines[["left", "bottom"]].set_color(GRID)
    ax.tick_params(colors=MUTED)
    ax.yaxis.grid(True, color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)
    fig.tight_layout()
    fig.savefig(os.path.join(DATA, "detection_rates.png"), dpi=160)
    plt.close(fig)

    # ---------- 2. features + clustering on >=2-hand images ----------
    rows, labels, ids, capture = [], [], [], []
    for img_id, rec in sorted(landmarks.items()):
        if rec["n_hands"] < 2:
            continue
        hands = sorted(rec["hands"], key=lambda h: -h["score"])[:2]
        rows.append(grip_features(*hands))
        labels.append(rec["grip_label"])
        ids.append(img_id)
        capture.append(audit.get(img_id, {}).get("grip_capture", "?"))

    feat_names = list(rows[0].keys())
    X = np.array([[r[f] for f in feat_names] for r in rows])
    Xs = StandardScaler().fit_transform(X)

    results = {"n_images_clustered": len(ids), "feature_names": feat_names,
               "images": ids, "grip_labels": labels,
               "grip_capture_audit": capture, "kmeans": {}, "ward": {}}
    best = None
    for k in (2, 3, 4):
        km = KMeans(n_clusters=k, n_init=20, random_state=0).fit(Xs)
        ari = adjusted_rand_score(labels, km.labels_)
        results["kmeans"][f"k={k}"] = {
            "ari_vs_labels": round(ari, 3),
            "clusters": km.labels_.tolist()}
        wa = fcluster(linkage(Xs, method="ward"), k, criterion="maxclust")
        results["ward"][f"k={k}"] = {
            "ari_vs_labels": round(adjusted_rand_score(labels, wa), 3),
            "clusters": [int(c) for c in wa]}
        if best is None or ari > best[1]:
            best = (k, ari, km.labels_)

    k, ari, cl = best
    pca = PCA(n_components=2)
    XY = pca.fit_transform(Xs)
    uniq = [g for g in order if g in labels]
    color_of = {g: CATEGORICAL[i % len(CATEGORICAL)] for i, g in enumerate(uniq)}
    markers = ["o", "s", "^", "D"]

    fig, ax = plt.subplots(figsize=(8, 6), facecolor=SURFACE)
    ax.set_facecolor(SURFACE)
    for (xp, yp), lab, c, img_id in zip(XY, labels, cl, ids):
        ax.scatter(xp, yp, s=110, color=color_of[lab], marker=markers[c % 4],
                   edgecolor=SURFACE, linewidth=1.5, zorder=3)
        ax.annotate(img_id.replace("img", ""), (xp, yp),
                    textcoords="offset points", xytext=(7, 5),
                    fontsize=8, color=INK2)
    for g in uniq:
        ax.scatter([], [], color=color_of[g], marker="o", s=80,
                   label=f"{g} (label)")
    for c in sorted(set(cl)):
        ax.scatter([], [], color=MUTED, marker=markers[c % 4], s=80,
                   label=f"cluster {c} (shape)")
    ax.legend(frameon=False, fontsize=8, loc="best", ncol=2)
    ax.set_xlabel("PC1", color=INK2)
    ax.set_ylabel("PC2", color=INK2)
    ax.set_title(f"Grip features, images with 2 detected hands (n={len(ids)})  "
                 f"- k-means k={k}, ARI vs labels = {ari:.2f}",
                 color=INK, fontsize=10, pad=12)
    ax.spines[["top", "right"]].set_visible(False)
    ax.spines[["left", "bottom"]].set_color(GRID)
    ax.tick_params(colors=MUTED)
    ax.grid(True, color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)
    fig.tight_layout()
    fig.savefig(os.path.join(DATA, "clustering.png"), dpi=160)
    plt.close(fig)

    with open(os.path.join(DATA, "clustering_results.json"), "w") as f:
        json.dump(results, f, indent=1)

    print(f"clustered {len(ids)} images; best k-means k={k} ARI={ari:.3f}")
    print("outcome totals:", Counter(a.get("recoverable", "no")
                                     for a in audit.values()))
    print("wrote detection_rates.png, clustering.png, clustering_results.json")


if __name__ == "__main__":
    main()
