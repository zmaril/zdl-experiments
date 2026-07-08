# Can grip data be extracted from single photos of two hands? — Empirical feasibility study

**Question.** Maril's set-partition result (the ZDL blog post "A New Kind of Dance
Science") classifies two-dancer hand *connections* combinatorially (B(4) = 15).
The next layer down is the hands themselves: the grip morphology inside a single
connection. This study asks whether off-the-shelf hand-pose estimation
(MediaPipe HandLandmarker, 21 landmarks/hand) can recover grip configurations
from single ordinary photographs of two hands gripping each other — handshakes,
hand clasps, interlaced fingers, fingertip holds, hook grips, dance connections.

**Short answer: mostly no.** The occlusion problem is as bad as feared, and it
fails in a more insidious way than simple non-detection.

## Data

40 photographs curated from Wikimedia Commons (searchable, permissively
licensed, re-downloadable): 8 handshakes, 15 hand clasps, 4 interlaced-finger
holds, 1 hand-on-top, 3 fingertip holds, 2 palm presses, 6 hook grips
(arm-wrestling — biomechanically the closest match to a dance hook grip),
1 wrist grip. 13 are dance contexts (salsa, lindy hop, west coast swing,
contra, folk); the rest are greetings, couples, and sport. Manifest with URLs,
licenses, artists, and manual grip labels: `data/sources.json`. Images are not
committed (copyright); `scripts/download_images.py` re-fetches them.

## Detection results (40 images)

Hand counts, best of three passes (strict 0.5 / loose 0.2 / loose on a
35%-padded canvas):

| hands detected | images | share |
|---|---|---|
| 0 | 13 | 33% |
| 1 | 14 | 35% |
| 2 | 12 | 30% |
| 4 (hallucinated duplicates on 2 real hands) | 1 | 2% |

But raw hand counts overstate success badly. A manual audit of every landmark
overlay against its photo (`data/audit.json`, overlays in `data/overlays/`,
gitignored) gives the honest numbers:

| audit outcome | images | share |
|---|---|---|
| both gripping hands tracked, grip recoverable | 5 | 12.5% |
| one gripping hand tracked (partner missed) — partial | 8 | 20% |
| grip not recoverable | 27 | 67.5% |

By grip type (recoverable / partial / no): handshake 1/1/6 · hand_clasp 0/2/13 ·
interlaced 0/2/2 · hand_on_top 1/0/0 · fingertip_hold 1/0/2 · palm_press 1/0/1 ·
hook_grip 1/2/3 · wrist_grip 0/1/0. See `data/detection_rates.png`.

### Failure modes (the interesting part)

1. **Chimera hands (11/40).** The most common non-trivial failure: the detector
   returns *one* confident "hand" whose 21 landmarks actually span **both**
   gripping hands — fingers assigned across the pair (clear in img009, img018,
   img025, img044). In img045 and img067, *each* of two joined pairs in frame
   was detected as one merged hand. These come back with high confidence
   (0.8–1.0) and plausible-looking skeletons; nothing in the API output flags
   them. Downstream features computed from them are quietly wrong.
2. **Zero detection on textbook grips (13/40).** Frame-filling handshake
   close-ups (img000, img007, img008) — the clearest possible grip photos —
   return nothing at any threshold. The palm detector appears not to fire when
   the visual gestalt is a two-hand knot rather than a single open hand. All
   room-distance dance-floor shots (img035, img053, img124, img131) also
   return zero: joined hands at social-dance distance are simply too small.
3. **Wrong hands (3/40).** Detections land on free or bystander hands while the
   grip is missed (img055, img073, img113). In img077 the "second hand" is a
   spectator waving in the background. An image-level "2 hands found" metric
   would count these as successes.
4. **Duplicate hallucination.** The padded pass on img112 produced 4
   overlapping skeletons on 2 real hands.
5. **What works:** *light* contact with most of both hands visible — an open
   palm-to-palm dance connection (img125, the best case in the set), hand
   resting on hand (img21), a fingertip/fist folk hold (img029), plus one
   handshake (img006) and one arm-wrestling grip (img075). Pattern: the less
   the hands occlude each other, the better — which is exactly backwards for
   studying *grips*, whose defining feature is mutual occlusion.

Confidence scores are useless as a quality signal here: chimeras scored up to
1.00 while correct detections scored as low as 0.60.

## Features + clustering

For the 13 images with ≥ 2 detected hands: 10 features per image (palm–palm
distance, min/mean fingertip–fingertip, fingertip-to-opposite-palm both ways,
all normalized by detected hand size; mean curl angle per finger). K-means
(k = 2–4) and Ward hierarchical clustering, compared against manual grip labels.

**Result: clusters do not correspond to grip types.** Best adjusted Rand index
0.17 (k-means k=4); Ward similar (`data/clustering_results.json`,
`data/clustering.png`). This is expected given the audit: only 5 of those 13
images have both gripping hands genuinely tracked, so most feature vectors
describe chimeras, free hands, or bystanders. The PCA plot is still
informative — the genuinely-captured grips (006, 021, 075, 112, 125) sit
together in a tight low-inter-hand-distance region, while chimera and
wrong-hand images scatter — i.e., the features separate *detection quality*
more than grip type. With so little clean signal (n=5), no grip taxonomy can
be learned from this pipeline as-is.

## What would fix this

In rough order of expected value:

1. **Egocentric / close-range deliberate capture.** The dominant failure is
   input, not model: hands too small, or fully knotted with no context. Photos
   *taken for this purpose* (hands ≥ ~25% of frame, several angles per grip)
   would likely move the recoverable rate substantially — img125/img029 show
   the estimator works when the view cooperates.
2. **Multi-view stills.** The chimera failure is a single-view ambiguity; a
   second camera 45–90° away disambiguates which fingers belong to whom.
   Cheap: two phones on tripods.
3. **Video.** Temporal continuity lets a tracker carry hand identity *into* the
   occluded grip from the frames before contact — likely the single best
   practical fix for dance footage, where hands connect and release
   repeatedly. Worth the next experiment.
4. **Depth cameras** would help chimeras (the two hands are at different
   depths) but require capture hardware at the dance.
5. **Manual annotation** remains the fallback: a human labeling grip type per
   photo is fast and reliable (doing it for 40 images here took minutes);
   pose estimation is not currently competitive with that for taxonomy work.
6. Model-side alternates worth a look before giving up on stills: hand-object /
   two-hand interaction models (e.g. InterHand2.6M-style two-hand nets), which
   are specifically trained on interacting hand pairs, unlike MediaPipe, which
   assumes hands are independent.

**Recommended next data-collection step:** film short clips (phone video,
close range, two angles) of a dancer pair cycling deliberately through the
grip vocabulary — handshake, clasp, interlaced, fingertip, hook, wrist — and
test whether video tracking + the two-hand features here separate them. That
directly serves the B(4)=15 program: each of the 15 connection classes has a
small grip vocabulary per contact point, and video is how dancers would
actually record it.

## Pipeline notes

- **Python, not TypeScript.** The repo's default is TypeScript, but MediaPipe's
  Python task API plus scikit-learn/matplotlib made this a one-afternoon
  pipeline; the JS route (`@mediapipe/tasks-vision`) needs a browser/WASM
  harness for image batches. Tradeoff accepted for a feasibility spike; a
  production pipeline inside the main repo could use the same `.task` model
  from Node/browser and port trivially, since landmarks are saved to JSON and
  everything downstream is language-agnostic.
- mediapipe 0.10.35 (Python 3.11), `hand_landmarker.task` float16 model
  (auto-downloaded, ~7.8 MB, gitignored). Linux needs `libgles2 libegl1
  libgl1` (apt) for the C bindings.
- Three-pass detection: confidence 0.5, 0.2, and 0.2 on a gray-padded canvas
  (padding rescues some frame-filling hands, e.g. img009/img075, but also
  causes the img112 duplicate hallucination — report both, trust neither
  blindly).
- Plot palette validated with the repo-external dataviz checker (CVD ΔE ≥ 12,
  lightness band, chroma floor); the yellow slot is sub-3:1 contrast on white,
  mitigated by direct on-bar count labels.

## Rerunning

```
pip install mediapipe opencv-python-headless scikit-learn scipy matplotlib
python3 scripts/download_images.py      # re-fetch images from sources.json
python3 scripts/extract_landmarks.py    # MediaPipe -> data/landmarks.json + overlays
python3 scripts/features_clustering.py  # stats, clustering, plots
```

`data/audit.json` is the one manual artifact (visual audit of overlays); the
rest regenerates.
