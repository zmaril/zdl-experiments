/**
 * Named partner-dance grips mapped into the contact-set model, at both
 * granularities. These serve the same role that named holds served in the
 * ZDL set-partition work: each named grip must land on a feasible contact
 * set, or the feasibility rules are wrong.
 *
 * Hand A = leader's right hand, hand B = follower's left hand. A right and
 * a left hand meeting palm-to-palm align mirror-wise, so like-named regions
 * correspond (thenar meets thenar, radial edge meets radial edge).
 *
 * Contact sets are canonical MINIMAL descriptions: the pairs essential to
 * the hold's identity, not every incidental brush of skin.
 */

import type { ContactPair } from './model.js';
import type { Category } from './categorize.js';

export interface NamedGrip {
  id: string;
  name: string;
  description: string;
  /** requires the optional wrist region */
  needsWrist: boolean;
  coarse: ContactPair[];
  fine: ContactPair[];
  expectedCategory: Category;
  expectedSymmetric: boolean;
}

function pairs(list: Array<[string, string]>): ContactPair[] {
  return list.map(([a, b]) => ({ a, b }));
}

export const NAMED_GRIPS: NamedGrip[] = [
  {
    id: 'handshake',
    name: 'Handshake hold',
    description:
      'Palms together, each hand\'s fingers wrap the partner\'s dorsum, thumbs over the back, webs engaged.',
    needsWrist: false,
    coarse: pairs([
      ['palm', 'palm'],
      ['fingers', 'dorsum'],
      ['thumb', 'dorsum'],
      ['dorsum', 'fingers'],
      ['dorsum', 'thumb'],
      ['edge', 'edge'],
    ]),
    fine: pairs([
      ['palmCenter', 'palmCenter'],
      ['thenar', 'thenar'],
      ['hypothenar', 'hypothenar'],
      ['iTip', 'dorsum'],
      ['mTip', 'dorsum'],
      ['rTip', 'dorsum'],
      ['pTip', 'dorsum'],
      ['dorsum', 'iTip'],
      ['dorsum', 'mTip'],
      ['dorsum', 'rTip'],
      ['dorsum', 'pTip'],
      ['thumbTip', 'dorsum'],
      ['dorsum', 'thumbTip'],
      ['radialEdge', 'radialEdge'],
    ]),
    expectedCategory: 'power',
    expectedSymmetric: true,
  },
  {
    id: 'pistol',
    name: 'Cross / pistol grip',
    description:
      'Leader\'s hand bladed; follower grips it like a pistol handle: palm over the back, fingers wrapped over the ulnar edge onto the leader\'s palm heel, thumb along the back.',
    needsWrist: false,
    coarse: pairs([
      ['edge', 'palm'],
      ['dorsum', 'fingers'],
      ['palm', 'fingertips'],
      ['edge', 'thumb'],
    ]),
    fine: pairs([
      ['dorsum', 'palmCenter'],
      ['dorsum', 'thenar'],
      ['dorsum', 'hypothenar'],
      ['dorsum', 'iProx'],
      ['dorsum', 'mProx'],
      ['ulnarEdge', 'iMid'],
      ['ulnarEdge', 'mMid'],
      ['ulnarEdge', 'rMid'],
      ['hypothenar', 'iTip'],
      ['hypothenar', 'mTip'],
      ['hypothenar', 'rTip'],
      ['dorsum', 'thumbTip'],
    ]),
    expectedCategory: 'power',
    expectedSymmetric: false,
  },
  {
    id: 'fingertip',
    name: 'Fingertip hold',
    description: 'Only the fingertip pads meet - the lightest full connection in partner dance.',
    needsWrist: false,
    coarse: pairs([['fingertips', 'fingertips']]),
    fine: pairs([
      ['iTip', 'iTip'],
      ['mTip', 'mTip'],
      ['rTip', 'rTip'],
      ['pTip', 'pTip'],
    ]),
    expectedCategory: 'precision',
    expectedSymmetric: true,
  },
  {
    id: 'hook',
    name: 'Hook grip',
    description:
      'Curled fingers hook into curled fingers; palms and thumbs stay out of it. Common in swing for stretch/elastic connection.',
    needsWrist: false,
    coarse: pairs([
      ['fingers', 'fingers'],
      ['fingertips', 'fingers'],
      ['fingers', 'fingertips'],
    ]),
    fine: pairs([
      ['iTip', 'iTip'],
      ['iTip', 'iMid'],
      ['iMid', 'iTip'],
      ['mTip', 'mTip'],
      ['mTip', 'mMid'],
      ['mMid', 'mTip'],
      ['rTip', 'rTip'],
      ['rTip', 'rMid'],
      ['rMid', 'rTip'],
      ['pTip', 'pTip'],
      ['pTip', 'pMid'],
      ['pMid', 'pTip'],
    ]),
    expectedCategory: 'hook',
    expectedSymmetric: true,
  },
  {
    id: 'cupped',
    name: 'Cupped hand hold (mutual C-grip)',
    description:
      'Each hand\'s fingertips rest in the other\'s palm - two shallow C shapes cradling each other.',
    needsWrist: false,
    coarse: pairs([
      ['fingertips', 'palm'],
      ['palm', 'fingertips'],
    ]),
    fine: pairs([
      ['iTip', 'palmCenter'],
      ['mTip', 'palmCenter'],
      ['rTip', 'palmCenter'],
      ['pTip', 'hypothenar'],
      ['palmCenter', 'iTip'],
      ['palmCenter', 'mTip'],
      ['palmCenter', 'rTip'],
      ['hypothenar', 'pTip'],
    ]),
    expectedCategory: 'platform',
    expectedSymmetric: true,
  },
  {
    id: 'ballroom',
    name: 'Ballroom hand-on-top',
    description:
      'Follower\'s hand rests flat on the leader\'s upturned hand; the leader\'s thumb settles lightly over the follower\'s knuckles. No wrap, no squeeze.',
    needsWrist: false,
    coarse: pairs([
      ['palm', 'palm'],
      ['thumb', 'dorsum'],
    ]),
    fine: pairs([
      ['palmCenter', 'palmCenter'],
      ['thenar', 'thenar'],
      ['hypothenar', 'hypothenar'],
      ['iProx', 'iProx'],
      ['mProx', 'mProx'],
      ['rProx', 'rProx'],
      ['pProx', 'pProx'],
      ['iMid', 'iMid'],
      ['mMid', 'mMid'],
      ['rMid', 'rMid'],
      ['pMid', 'pMid'],
      ['thumbTip', 'dorsum'],
    ]),
    expectedCategory: 'platform',
    expectedSymmetric: false,
  },
  {
    id: 'interlaced',
    name: 'Interlaced fingers',
    description:
      'Palms together, fingers interleaved, fingertips landing on the partner\'s dorsum, thumbs crossed.',
    needsWrist: false,
    coarse: pairs([
      ['palm', 'palm'],
      ['fingers', 'fingers'],
      ['fingers', 'dorsum'],
      ['dorsum', 'fingers'],
      ['thumb', 'thumb'],
    ]),
    fine: pairs([
      ['palmCenter', 'palmCenter'],
      ['thenar', 'thenar'],
      ['hypothenar', 'hypothenar'],
      ['iProx', 'iProx'],
      ['mProx', 'mProx'],
      ['rProx', 'rProx'],
      ['pProx', 'pProx'],
      ['iProx', 'mProx'],
      ['mProx', 'iProx'],
      ['iTip', 'dorsum'],
      ['mTip', 'dorsum'],
      ['rTip', 'dorsum'],
      ['pTip', 'dorsum'],
      ['dorsum', 'iTip'],
      ['dorsum', 'mTip'],
      ['dorsum', 'rTip'],
      ['dorsum', 'pTip'],
      ['thumbProx', 'thumbProx'],
      ['thumbTip', 'dorsum'],
      ['dorsum', 'thumbTip'],
    ]),
    expectedCategory: 'power',
    expectedSymmetric: true,
  },
  {
    id: 'wristHold',
    name: 'Wrist hold',
    description:
      'Leader\'s hand wraps the follower\'s wrist. The wrist is outside the hand proper, so it is modeled as an optional extra region; this grip only exists in the wrist-enabled model.',
    needsWrist: true,
    coarse: pairs([
      ['palm', 'wrist'],
      ['fingers', 'wrist'],
      ['thumb', 'wrist'],
      ['fingertips', 'wrist'],
    ]),
    fine: pairs([
      ['palmCenter', 'wrist'],
      ['thenar', 'wrist'],
      ['hypothenar', 'wrist'],
      ['iProx', 'wrist'],
      ['iMid', 'wrist'],
      ['iTip', 'wrist'],
      ['mMid', 'wrist'],
      ['mTip', 'wrist'],
      ['rMid', 'wrist'],
      ['rTip', 'wrist'],
      ['pMid', 'wrist'],
      ['pTip', 'wrist'],
      ['thumbProx', 'wrist'],
      ['thumbTip', 'wrist'],
    ]),
    expectedCategory: 'power',
    expectedSymmetric: false,
  },
];
