import { describe, expect, it } from 'vitest';
import { componentCount, jonesPolynomial, validateDiagram } from '../core/index.js';
import { partitionById } from './partitions.js';
import {
  buildPositionTangle,
  closePosition,
  isLockedVariant,
  lockedVariants,
  planPosition,
  stringLinkingSums,
  variantSpace,
} from './tangles.js';
import { buildNamedPosition, NAMED_POSITIONS } from './positions.js';
import { fingerprint, fingerprintKey } from '../enumerate/invariants.js';

function plan(partitionId: string, hammerlocks: string[] = []) {
  const r = planPosition({
    partition: partitionById(partitionId),
    hammerlocks: new Set(hammerlocks as never[]),
  });
  if (!r.ok) throw new Error(`plan failed: ${r.reason}`);
  return r.plan;
}

const UNLINK_2 = '-q^-2 - q^2';
const UNLINK_3 = 'q^-4 + 2 + q^4';
const UNLINK_4 = '-q^-6 - 3q^-2 - 3q^2 - q^6';

describe('position tangles: trivial holds', () => {
  it('no contact closes to the 2-component unlink (two torso bars)', () => {
    const p = plan('none');
    const built = buildPositionTangle(p, { signs: [], twist: 0 });
    const d = closePosition(built);
    validateDiagram(d);
    expect(componentCount(d)).toBe(2);
    expect(jonesPolynomial(d).toString('q')).toBe(UNLINK_2);
  });

  it('open two-hand hold needs zero crossings; closure is a 4-unlink', () => {
    const p = plan('LL.FR|LR.FL');
    expect(p.letters).toHaveLength(0);
    const built = buildPositionTangle(p, { signs: [], twist: 0 });
    const d = closePosition(built);
    validateDiagram(d);
    expect(d.crossings).toHaveLength(0);
    expect(componentCount(d)).toBe(4);
    expect(jonesPolynomial(d).toString('q')).toBe(UNLINK_4);
  });

  it('a single handshake (right-to-right) is topologically trivial', () => {
    const built = buildPositionTangle(plan('LR.FR'), { signs: [], twist: 0 });
    const d = closePosition(built);
    validateDiagram(d);
    expect(d.crossings).toHaveLength(0);
    expect(jonesPolynomial(d).toString('q')).toBe(UNLINK_3);
  });
});

describe('crossed vs straight holds', () => {
  it('crossed two-hand hold forces exactly one inter-chain crossing', () => {
    const p = plan('LL.FL|LR.FR');
    expect(p.letters).toHaveLength(1);
    expect(p.letters[0]!.kind).toBe('armPass');
  });

  it('the two mirror crossed holds are distinguished by linking sums', () => {
    const p = plan('LL.FL|LR.FR');
    const a = buildPositionTangle(p, { signs: [1], twist: 0 });
    const b = buildPositionTangle(p, { signs: [-1], twist: 0 });
    const fa = fingerprint(a);
    const fb = fingerprint(b);
    // Jones of the (concatenated) closure cannot see the single crossing...
    expect(fa.jones).toBe(fb.jones);
    // ...but the string-linking sum can: +1 vs -1.
    expect(fa.linking).not.toEqual(fb.linking);
    expect(fingerprintKey(fa)).not.toBe(fingerprintKey(fb));
  });

  it('crossed and straight two-hand holds are different partitions AND different topology slots', () => {
    const straight = buildPositionTangle(plan('LL.FR|LR.FL'), { signs: [], twist: 0 });
    const crossed = buildPositionTangle(plan('LL.FL|LR.FR'), { signs: [1], twist: 0 });
    expect(stringLinkingSums(straight).size).toBe(0);
    expect(stringLinkingSums(crossed).size).toBe(1);
  });

  it('straight hold with a full arm twist (clasp) is distinct from the clean hold', () => {
    const p = plan('LL.FR|LR.FL');
    expect(p.twistPair).not.toBeNull();
    const clean = fingerprint(buildPositionTangle(p, { signs: [], twist: 0 }));
    const clasp = fingerprint(buildPositionTangle(p, { signs: [], twist: 1 }));
    const claspM = fingerprint(buildPositionTangle(p, { signs: [], twist: -1 }));
    const keys = new Set([clean, clasp, claspM].map(fingerprintKey));
    expect(keys.size).toBe(3);
  });
});

describe('hammerlocks and the torso obstacle', () => {
  it('a locked hammerlock encloses the torso bar: Hopf link in the closure', () => {
    const p = plan('LR.FL', ['FL']);
    const locked = lockedVariants(p);
    expect(locked).toHaveLength(2); // mirror pair: partner reaches around either flank
    const built = buildPositionTangle(p, locked[0]!);
    const fp = fingerprint(built);
    // Linking with the follower torso is +-2 (twice the linking number 1).
    expect(fp.linking.some((l) => l.includes('FT|grip:LR.FL='))).toBe(true);
    // Closure = Hopf link + split unknot (one torso, chain, other torso).
    const d = closePosition(built);
    validateDiagram(d);
    expect(componentCount(d)).toBe(3);
    const hopfPlusUnknot = new Set([
      '1 + q^4 + q^8 + q^12',
      'q^-12 + q^-8 + q^-4 + 1',
    ]);
    expect(hopfPlusUnknot.has(fp.jones)).toBe(true);
  });

  it('the hammerlock is distinct from the plain grip BECAUSE of the torso: all its nontrivial data involves the torso component', () => {
    const pHam = plan('LR.FL', ['FL']);
    const pPlain = plan('LR.FL');
    const ham = fingerprint(buildPositionTangle(pHam, lockedVariants(pHam)[0]!));
    const plain = fingerprint(buildPositionTangle(pPlain, { signs: [], twist: 0 }));
    expect(fingerprintKey(ham)).not.toBe(fingerprintKey(plain));
    // Every nonzero linking entry of the hammerlock involves a torso bar;
    // drop the torso and nothing distinguishes the arms from a plain grip.
    expect(ham.linking.length).toBeGreaterThan(0);
    for (const entry of ham.linking) {
      expect(/(^|[|;])(LT|FT)\|/.test(entry) || /\|(LT|FT)=/.test(entry)).toBe(true);
    }
    expect(plain.linking).toHaveLength(0);
  });

  it('fake (same-flank) hammerlock variants collapse to the plain grip', () => {
    const pHam = plan('LR.FL', ['FL']);
    const pPlain = plan('LR.FL');
    const plainKey = fingerprintKey(
      fingerprint(buildPositionTangle(pPlain, { signs: [], twist: 0 })),
    );
    const fakes = variantSpace(pHam).filter(
      (v) => !isLockedVariant(buildPositionTangle(pHam, v)),
    );
    expect(fakes).toHaveLength(2);
    for (const v of fakes) {
      expect(fingerprintKey(fingerprint(buildPositionTangle(pHam, v)))).toBe(plainKey);
    }
  });

  it('a hammerlocked FREE hand is geometric only: same tangle as no hammerlock', () => {
    const rA = planPosition({ partition: partitionById('LR.FL'), hammerlocks: new Set(['FR']) });
    const rB = planPosition({ partition: partitionById('LR.FL'), hammerlocks: new Set() });
    if (!rA.ok || !rB.ok) throw new Error('plan failed');
    expect(rA.plan.geometricHammerlocks).toEqual(['FR']);
    expect(rA.plan.strands).toEqual(rB.plan.strands);
    expect(rA.plan.letters).toEqual(rB.plan.letters);
    const fpA = fingerprintKey(fingerprint(buildPositionTangle(rA.plan, { signs: [], twist: 0 })));
    const fpB = fingerprintKey(fingerprint(buildPositionTangle(rB.plan, { signs: [], twist: 0 })));
    expect(fpA).toBe(fpB);
  });

  it('flags multi-hand grips and back-to-back double hammerlocks honestly', () => {
    const multi = planPosition({
      partition: partitionById('LL.LR.FL'),
      hammerlocks: new Set(),
    });
    expect(multi).toEqual({ ok: false, reason: 'multi-grip' });
    const b2b = planPosition({
      partition: partitionById('LL.FL'),
      hammerlocks: new Set(['LL', 'FL']),
    });
    expect(b2b).toEqual({ ok: false, reason: 'back-to-back' });
  });
});

describe('named positions', () => {
  it('all named positions build and close to valid diagrams', () => {
    for (const spec of NAMED_POSITIONS) {
      const np = buildNamedPosition(spec.id);
      validateDiagram(closePosition(np.built));
    }
  });

  it('cuddle/sweetheart wraps both chains around the follower torso', () => {
    const np = buildNamedPosition('cuddle-sweetheart');
    const sums = stringLinkingSums(np.built);
    expect(Math.abs(sums.get('FT|grip:LL.FR') ?? 0)).toBe(2);
    expect(Math.abs(sums.get('FT|grip:LR.FL') ?? 0)).toBe(2);
    // Distinct from the unwrapped open two-hand hold.
    const open = buildNamedPosition('open-two-hand');
    expect(fingerprintKey(fingerprint(np.built))).not.toBe(
      fingerprintKey(fingerprint(open.built)),
    );
  });
});
