/**
 * Standard result bundle shared by the report and the tests: builds the
 * models, runs the analytic counts, the bounded enumerations, the
 * sensitivity sweep, and the named-grip checks, once (memoized).
 */

import { analyticCount, rawSpaceSize } from './analytic.js';
import type { Category } from './categorize.js';
import { categorize } from './categorize.js';
import { enumerateGrips, rawBoundedCount, type EnumResult } from './enumerate.js';
import { buildModel, type GripModel } from './model.js';
import { NAMED_GRIPS, type NamedGrip } from './named-grips.js';
import { coarseHand, fineHand } from './regions.js';
import { ALL_RULES, checkGrip, RULE_IDS, type GripCheck, type RuleId, type RuleToggles } from './rules.js';

export const COARSE_MAX_SIZE = 6;
export const FINE_MAX_SIZE = 3;

export interface SensitivityRow {
  label: string;
  toggles: RuleToggles;
  feasible: number;
}

export interface GranularityResults {
  model: GripModel;
  nPairs: number;
  rawAllSizes: bigint;
  rawBounded: number;
  maxSize: number;
  analyticOrientation: bigint;
  analyticOrientationOpposite?: bigint; // coarse only
  baseline: EnumResult; // all rules, classified
  sensitivity: SensitivityRow[];
}

export interface NamedGripResult {
  grip: NamedGrip;
  coarseCheck: GripCheck;
  fineCheck: GripCheck;
  coarseCategory: Category;
  fineCategory: Category;
  coarseSymmetric: boolean;
  fineSymmetric: boolean;
}

export interface Results {
  coarse: GranularityResults;
  fine: GranularityResults;
  coarseWrist: { model: GripModel; nPairs: number; rawAllSizes: bigint; baseline: EnumResult };
  namedGrips: NamedGripResult[];
}

function leaveOneOut(rule: RuleId): RuleToggles {
  return { ...ALL_RULES, [rule]: false };
}

function onlyRule(rule: RuleId): RuleToggles {
  const t: RuleToggles = {
    orientation: false,
    oppositeFaces: false,
    connectedInterface: false,
    smallRegionSpan: false,
  };
  t[rule] = true;
  return t;
}

function sensitivitySweep(model: GripModel, maxSize: number): SensitivityRow[] {
  const rows: SensitivityRow[] = [];
  rows.push({
    label: 'all rules ON (baseline)',
    toggles: ALL_RULES,
    feasible: enumerateGrips(model, { maxSize, toggles: ALL_RULES }).feasible,
  });
  for (const rule of RULE_IDS) {
    const toggles = leaveOneOut(rule);
    rows.push({
      label: `without ${rule}`,
      toggles,
      feasible: enumerateGrips(model, { maxSize, toggles }).feasible,
    });
  }
  for (const rule of RULE_IDS) {
    const toggles = onlyRule(rule);
    rows.push({
      label: `only ${rule}`,
      toggles,
      feasible: enumerateGrips(model, { maxSize, toggles }).feasible,
    });
  }
  rows.push({
    label: 'no rules (raw, bounded)',
    toggles: {
      orientation: false,
      oppositeFaces: false,
      connectedInterface: false,
      smallRegionSpan: false,
    },
    feasible: rawBoundedCount(model.nPairs, maxSize),
  });
  return rows;
}

function granularityResults(
  model: GripModel,
  maxSize: number,
  withOppositeAnalytic: boolean,
): GranularityResults {
  const res: GranularityResults = {
    model,
    nPairs: model.nPairs,
    rawAllSizes: rawSpaceSize(model),
    rawBounded: rawBoundedCount(model.nPairs, maxSize),
    maxSize,
    analyticOrientation: analyticCount(model),
    baseline: enumerateGrips(model, { maxSize, toggles: ALL_RULES, classify: true }),
    sensitivity: sensitivitySweep(model, maxSize),
  };
  if (withOppositeAnalytic) {
    res.analyticOrientationOpposite = analyticCount(model, { withOppositeFaces: true });
  }
  return res;
}

let cached: Results | undefined;

export function computeResults(): Results {
  if (cached) return cached;

  const coarseModel = buildModel(coarseHand());
  const fineModel = buildModel(fineHand());
  const coarseWristModel = buildModel(coarseHand({ includeWrist: true }));
  const fineWristModel = buildModel(fineHand({ includeWrist: true }));

  const namedGrips: NamedGripResult[] = NAMED_GRIPS.map((grip) => {
    const cm = grip.needsWrist ? coarseWristModel : coarseModel;
    const fm = grip.needsWrist ? fineWristModel : fineModel;
    const coarseCheck = checkGrip(cm, grip.coarse, ALL_RULES);
    const fineCheck = checkGrip(fm, grip.fine, ALL_RULES);
    const cc = categorize(cm, grip.coarse);
    const fc = categorize(fm, grip.fine);
    return {
      grip,
      coarseCheck,
      fineCheck,
      coarseCategory: cc.category,
      fineCategory: fc.category,
      coarseSymmetric: cc.symmetric,
      fineSymmetric: fc.symmetric,
    };
  });

  cached = {
    coarse: granularityResults(coarseModel, COARSE_MAX_SIZE, true),
    fine: granularityResults(fineModel, FINE_MAX_SIZE, false),
    coarseWrist: {
      model: coarseWristModel,
      nPairs: coarseWristModel.nPairs,
      rawAllSizes: rawSpaceSize(coarseWristModel),
      baseline: enumerateGrips(coarseWristModel, {
        maxSize: COARSE_MAX_SIZE,
        toggles: ALL_RULES,
        classify: true,
      }),
    },
    namedGrips,
  };
  return cached;
}
