/**
 * Three.js view: two stylized facing dancers rendered directly from the
 * braid-grid layout. World axes: x = strand columns (leader on the left,
 * follower on the right, the front zone between the torso bars), y = braid
 * height (shoulders at the bottom of the strip, grips at the top),
 * z = over/under (a strand passing IN FRONT bulges toward the default
 * camera). Torso bars are thick tubes that follow their own strand path
 * (so arm-behind-back passes are honest crossings), extended floor to
 * ceiling as translucent obstacle bars. Free hammerlocked hands (no
 * strand, no topology) are posed semi-transparent behind the back.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { BuiltPosition, Hand, StrandName } from '@model';
import { layoutBraid, strandColor, type BraidLayout, type LayoutCap } from './layout.js';

const SPACING = 0.8;
const Y_BOTTOM = 1.45;
const SHOULDER_Y = 1.28;
const ARM_R = 0.055;
const TORSO_R = 0.13;
const AMP_TORSO = 0.3;
const AMP_ARM = 0.14;

const SIDE_Z: Record<Hand, number> = { LL: -0.22, LR: 0.22, FL: 0.22, FR: -0.22 };

function isHand(s: StrandName): s is Hand {
  return s !== 'LT' && s !== 'FT';
}

export class DanceScene {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private group: THREE.Group | null = null;

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x10141b);
    this.scene.fog = new THREE.Fog(0x10141b, 14, 26);

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.camera.position.set(0.4, 2.6, 10.5);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 1.4, 0);
    this.controls.enableDamping = true;
    this.controls.maxDistance = 20;
    this.controls.minDistance = 2;

    const hemi = new THREE.HemisphereLight(0xffffff, 0x28303f, 1.0);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 1.6);
    dir.position.set(4, 7, 5);
    this.scene.add(dir);
    const back = new THREE.DirectionalLight(0x8899cc, 0.5);
    back.position.set(-4, 3, -6);
    this.scene.add(back);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(7, 48),
      new THREE.MeshStandardMaterial({ color: 0x161c26, roughness: 0.95 }),
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);
    const grid = new THREE.GridHelper(14, 28, 0x2c3648, 0x222a38);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.4;
    grid.position.y = 0.001;
    this.scene.add(grid);

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      this.renderer.setSize(w, h);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(host);
    resize();

    this.renderer.setAnimationLoop(() => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    });
  }

  /** Replace the dancers with a new position (null clears the strands). */
  setPosition(built: BuiltPosition | null): void {
    if (this.group) {
      this.scene.remove(this.group);
      this.group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        }
      });
      this.group = null;
    }
    if (!built) return;
    this.group = buildPositionGroup(built);
    this.scene.add(this.group);
  }
}

function tube(points: THREE.Vector3[], radius: number, color: string, opacity = 1): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const geo = new THREE.TubeGeometry(curve, Math.max(48, points.length * 14), radius, 14, false);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.5,
    metalness: 0.05,
    transparent: opacity < 1,
    opacity,
  });
  return new THREE.Mesh(geo, mat);
}

function ball(p: THREE.Vector3, r: number, color: string, opacity = 1): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.4,
    transparent: opacity < 1,
    opacity,
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat);
  m.position.copy(p);
  return m;
}

interface Frame {
  layout: BraidLayout;
  colX: (c: number) => number;
  yOf: (step: number) => number;
  yTop: number;
  torsoBottomX: (owner: 'leader' | 'follower') => number;
  outDir: (owner: 'leader' | 'follower') => number;
}

function makeFrame(layout: BraidLayout): Frame {
  const colX = (c: number) => (c - (layout.columns - 1) / 2) * SPACING;
  const rowH = layout.steps > 0 ? Math.min(0.3, 1.2 / layout.steps) : 0;
  const yTop = Y_BOTTOM + (layout.steps > 0 ? layout.steps * rowH : 0.3);
  const yOf = (step: number) => Y_BOTTOM + step * rowH;
  const torsoBottomX = (owner: 'leader' | 'follower') =>
    colX(owner === 'leader' ? layout.leaderTorsoCol : layout.followerTorsoCol);
  const outDir = (owner: 'leader' | 'follower') => (owner === 'leader' ? -1 : 1);
  return { layout, colX, yOf, yTop, torsoBottomX, outDir };
}

function ownerOf(h: Hand): 'leader' | 'follower' {
  return h.startsWith('L') ? 'leader' : 'follower';
}

function shoulderPoint(f: Frame, h: Hand): THREE.Vector3 {
  const owner = ownerOf(h);
  const x = f.torsoBottomX(owner) - f.outDir(owner) * 0.18;
  return new THREE.Vector3(x, SHOULDER_Y, SIDE_Z[h]);
}

/** Braid-region points for one strand, with over/under z-bulges. */
function strandPoints(f: Frame, name: StrandName): THREE.Vector3[] {
  const s = f.layout.strands.find((x) => x.name === name)!;
  const pts: THREE.Vector3[] = [new THREE.Vector3(f.colX(s.cols[0]!), Y_BOTTOM, 0)];
  for (let step = 0; step < f.layout.steps; step++) {
    const cross = f.layout.crossings.find(
      (c) => c.step === step && (c.left === name || c.right === name),
    );
    if (cross) {
      const amIOver = (cross.over === 'left') === (cross.left === name);
      // Torso bars stay in the z = 0 plane; the arm does all the bulging.
      if (!(name === 'LT' || name === 'FT')) {
        const amp = cross.torso ? AMP_TORSO : AMP_ARM;
        const midX = (f.colX(s.cols[step]!) + f.colX(s.cols[step + 1]!)) / 2;
        pts.push(new THREE.Vector3(midX, f.yOf(step) + (f.yOf(step + 1) - f.yOf(step)) / 2, amIOver ? amp : -amp));
      }
    }
    pts.push(new THREE.Vector3(f.colX(s.cols[step + 1]!), f.yOf(step + 1), 0));
  }
  if (f.layout.steps === 0) pts.push(new THREE.Vector3(f.colX(s.cols[0]!), f.yTop, 0));
  return pts;
}

/** Parabolic grip-cap arc from t = 0 (col a) to t = 1 (col b). */
function capPoint(f: Frame, cap: LayoutCap, t: number): THREE.Vector3 {
  const ax = f.colX(cap.aCol);
  const bx = f.colX(cap.bCol);
  const h = 0.24 + 0.32 * cap.depth + 0.06 * (cap.bCol - cap.aCol);
  const zOff = cap.zone === 'front' ? 0 : -0.14;
  return new THREE.Vector3(
    ax + (bx - ax) * t,
    f.yTop + h * 4 * t * (1 - t),
    zOff * 4 * t * (1 - t),
  );
}

function buildPositionGroup(built: BuiltPosition): THREE.Group {
  const layout = layoutBraid(built);
  const f = makeFrame(layout);
  const g = new THREE.Group();

  const grippedHands = new Set<Hand>(built.plan.chains.flatMap((c) => c.hands));

  // --- Torso bars (thick tubes following their strand path) + heads.
  for (const torso of ['LT', 'FT'] as const) {
    const owner = torso === 'LT' ? ('leader' as const) : ('follower' as const);
    const inner = strandPoints(f, torso);
    const bottomX = inner[0]!.x;
    const topX = inner[inner.length - 1]!.x;
    const pts = [
      new THREE.Vector3(bottomX, 0.18, 0),
      ...inner,
      new THREE.Vector3(topX, f.yTop + 0.3, 0),
    ];
    g.add(tube(pts, TORSO_R, strandColor(torso)));
    // Translucent obstacle bar: the torso extends floor to ceiling.
    const obstacle = [
      new THREE.Vector3(bottomX, 0.0, 0),
      ...pts,
      new THREE.Vector3(topX, 3.2, 0),
    ];
    g.add(tube(obstacle, TORSO_R + 0.06, strandColor(torso), 0.08));
    g.add(ball(new THREE.Vector3(topX, f.yTop + 0.56, 0), 0.19, '#c8ceda'));
    // Shoulder anchors.
    for (const h of (owner === 'leader' ? ['LL', 'LR'] : ['FL', 'FR']) as Hand[]) {
      g.add(ball(shoulderPoint(f, h), 0.055, strandColor(h)));
    }
  }

  // --- Gripped arms: shoulder -> braid strand -> half grip cap.
  for (const chain of built.plan.chains) {
    const cap = layout.caps.find((c) => c.hands === chain.hands || (c.hands[0] === chain.hands[0] && c.hands[1] === chain.hands[1]))!;
    for (const [k, hand] of chain.hands.entries()) {
      const body = strandPoints(f, hand);
      const topX = body[body.length - 1]!.x;
      const startT = Math.abs(f.colX(cap.aCol) - topX) < 1e-6 ? 0 : 1;
      const half =
        startT === 0
          ? [capPoint(f, cap, 0.2), capPoint(f, cap, 0.35), capPoint(f, cap, 0.5)]
          : [capPoint(f, cap, 0.8), capPoint(f, cap, 0.65), capPoint(f, cap, 0.5)];
      const sh = shoulderPoint(f, hand);
      const pts = [
        sh,
        new THREE.Vector3(body[0]!.x, Y_BOTTOM - 0.1, SIDE_Z[hand] * 0.35),
        ...body,
        ...half,
      ];
      g.add(tube(pts, ARM_R, strandColor(hand)));
      if (k === 0) g.add(ball(capPoint(f, cap, 0.5), 0.09, '#e8ecf3'));
    }
  }

  // --- Free arms: posed hammerlock (semi-transparent, no topology) or hanging.
  for (const hand of ['LL', 'LR', 'FL', 'FR'] as Hand[]) {
    if (grippedHands.has(hand)) continue;
    const owner = ownerOf(hand);
    const tx = f.torsoBottomX(owner);
    const out = f.outDir(owner);
    const sh = shoulderPoint(f, hand);
    if (layout.geometricHammerlocks.includes(hand)) {
      const pts = [
        sh,
        new THREE.Vector3(tx, 1.08, -0.32),
        new THREE.Vector3(tx + out * 0.42, 1.0, -0.14),
        new THREE.Vector3(tx + out * 0.5, 0.98, 0),
      ];
      g.add(tube(pts, ARM_R * 0.95, strandColor(hand), 0.55));
      g.add(ball(pts[pts.length - 1]!, 0.07, strandColor(hand), 0.55));
    } else {
      const pts = [
        sh,
        new THREE.Vector3(tx - out * 0.02, 0.95, SIDE_Z[hand]),
        new THREE.Vector3(tx + out * 0.1, 0.66, SIDE_Z[hand] * 0.8),
      ];
      g.add(tube(pts, ARM_R * 0.95, strandColor(hand), 0.5));
      g.add(ball(pts[pts.length - 1]!, 0.065, strandColor(hand), 0.5));
    }
  }

  return g;
}
