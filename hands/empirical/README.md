# hands/empirical — grip extraction from photos, feasibility study

Empirical test of whether MediaPipe hand-pose estimation can recover two-person
grip configurations (handshake, clasp, interlaced, fingertip, hook, ...) from
single photographs. **Findings and verdict: see [NOTES.md](NOTES.md).**

## Layout

```
scripts/
  download_images.py     # re-fetch the 40 study images from data/sources.json
  extract_landmarks.py   # MediaPipe HandLandmarker -> data/landmarks.json + overlay renders
  features_clustering.py # detection stats, grip features, k-means/Ward, plots
data/
  sources.json           # image manifest: URL, license, artist, manual grip label
  audit.json             # manual visual audit of every landmark overlay (the key data)
  landmarks.json         # extracted 21-point landmarks per detected hand
  clustering_results.json
  detection_rates.png    # audit outcomes by grip type
  clustering.png         # PCA of grip features, labels vs clusters
  images/    (gitignored — copyrighted photos, re-downloadable)
  overlays/  (gitignored — landmark skeletons drawn on the photos)
```

## Run

```
pip install mediapipe opencv-python-headless scikit-learn scipy matplotlib
# Debian/Ubuntu may also need: apt-get install libgles2 libegl1 libgl1
python3 scripts/download_images.py
python3 scripts/extract_landmarks.py
python3 scripts/features_clustering.py
```

Python is used here (repo default is TypeScript) — rationale in NOTES.md.
