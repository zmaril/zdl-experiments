/**
 * Enumeration of positions / entanglement classes (phase 2).
 *
 * Enumerates candidate positions (partition x hammerlock x entanglement
 * data) and classifies them with invariants from src/core, reconciling
 * with the 157 feasible states of the partition-only model. `run.ts` is
 * the `npm run enumerate` entry point.
 */
export * from './invariants.js';
export * from './refine.js';
