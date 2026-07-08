/**
 * Dance -> formalism mapping (phase 2).
 *
 * Maps two-dancer positions (set partitions of the four hands + hammerlock
 * states, per Maril's ZDL census) onto the core formalisms:
 * arms -> tangle strands, grips -> boundary gluings, torsos -> obstacle
 * strands, moves -> braid words.
 */
export * from './partitions.js';
export * from './census.js';
export * from './tangles.js';
export * from './positions.js';
export * from './moves.js';
