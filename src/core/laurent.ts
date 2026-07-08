/**
 * Exact Laurent polynomial arithmetic in one variable.
 *
 * Coefficients are `bigint` (exact integers), exponents are plain integers
 * (may be negative). Instances are immutable; all operations return new
 * polynomials. Zero coefficients are never stored.
 */

export class Laurent {
  /** exponent -> nonzero coefficient */
  private readonly terms: ReadonlyMap<number, bigint>;

  private constructor(terms: Map<number, bigint>) {
    this.terms = terms;
  }

  static readonly ZERO: Laurent = new Laurent(new Map());
  static readonly ONE: Laurent = Laurent.monomial(1n, 0);

  /** coeff * x^exp */
  static monomial(coeff: bigint | number, exp: number): Laurent {
    const c = BigInt(coeff);
    if (!Number.isInteger(exp)) throw new Error(`exponent must be an integer, got ${exp}`);
    const m = new Map<number, bigint>();
    if (c !== 0n) m.set(exp, c);
    return new Laurent(m);
  }

  /** Build from [exponent, coefficient] pairs (repeated exponents are summed). */
  static fromTerms(pairs: Iterable<readonly [number, bigint | number]>): Laurent {
    const m = new Map<number, bigint>();
    for (const [exp, coeff] of pairs) {
      if (!Number.isInteger(exp)) throw new Error(`exponent must be an integer, got ${exp}`);
      const c = (m.get(exp) ?? 0n) + BigInt(coeff);
      if (c === 0n) m.delete(exp);
      else m.set(exp, c);
    }
    return new Laurent(m);
  }

  isZero(): boolean {
    return this.terms.size === 0;
  }

  coefficient(exp: number): bigint {
    return this.terms.get(exp) ?? 0n;
  }

  /** Sorted list of [exponent, coefficient] pairs, ascending exponent. */
  termList(): Array<[number, bigint]> {
    return [...this.terms.entries()].sort((a, b) => a[0] - b[0]);
  }

  add(other: Laurent): Laurent {
    const m = new Map(this.terms);
    for (const [exp, coeff] of other.terms) {
      const c = (m.get(exp) ?? 0n) + coeff;
      if (c === 0n) m.delete(exp);
      else m.set(exp, c);
    }
    return new Laurent(m);
  }

  neg(): Laurent {
    const m = new Map<number, bigint>();
    for (const [exp, coeff] of this.terms) m.set(exp, -coeff);
    return new Laurent(m);
  }

  sub(other: Laurent): Laurent {
    return this.add(other.neg());
  }

  mul(other: Laurent): Laurent {
    const m = new Map<number, bigint>();
    for (const [e1, c1] of this.terms) {
      for (const [e2, c2] of other.terms) {
        const exp = e1 + e2;
        const c = (m.get(exp) ?? 0n) + c1 * c2;
        if (c === 0n) m.delete(exp);
        else m.set(exp, c);
      }
    }
    return new Laurent(m);
  }

  /** Nonnegative integer power. */
  pow(k: number): Laurent {
    if (!Number.isInteger(k) || k < 0) throw new Error(`pow expects a nonnegative integer, got ${k}`);
    let result = Laurent.ONE;
    let base: Laurent = this;
    let n = k;
    while (n > 0) {
      if (n & 1) result = result.mul(base);
      base = base.mul(base);
      n >>= 1;
    }
    return result;
  }

  equals(other: Laurent): boolean {
    if (this.terms.size !== other.terms.size) return false;
    for (const [exp, coeff] of this.terms) {
      if (other.terms.get(exp) !== coeff) return false;
    }
    return true;
  }

  /** Substitute x -> x^k (k a nonzero integer; k = -1 gives the mirror substitution). */
  substitutePower(k: number): Laurent {
    if (!Number.isInteger(k) || k === 0) throw new Error(`substitutePower expects a nonzero integer, got ${k}`);
    const m = new Map<number, bigint>();
    for (const [exp, coeff] of this.terms) m.set(exp * k, coeff);
    return new Laurent(m);
  }

  /**
   * Divide all exponents by `d`. Throws if any exponent is not a multiple of d.
   * Used e.g. to re-express a polynomial in q = t^(1/4) as a polynomial in t.
   */
  rescaleExponents(d: number): Laurent {
    if (!Number.isInteger(d) || d === 0) throw new Error(`rescaleExponents expects a nonzero integer, got ${d}`);
    const m = new Map<number, bigint>();
    for (const [exp, coeff] of this.terms) {
      if (exp % d !== 0) throw new Error(`exponent ${exp} is not a multiple of ${d}`);
      m.set(exp / d, coeff);
    }
    return new Laurent(m);
  }

  /** Lowest exponent with nonzero coefficient (throws on the zero polynomial). */
  minExponent(): number {
    if (this.isZero()) throw new Error('zero polynomial has no exponents');
    return Math.min(...this.terms.keys());
  }

  maxExponent(): number {
    if (this.isZero()) throw new Error('zero polynomial has no exponents');
    return Math.max(...this.terms.keys());
  }

  /**
   * Human-readable form, e.g. "-t^-4 + t^-3 + t^-1".
   * `expDenominator` renders exponents divided by that value (for polynomials
   * stored in q = t^(1/4), pass 4 to print fractional powers of t).
   */
  toString(variable = 't', expDenominator = 1): string {
    if (this.isZero()) return '0';
    const parts: string[] = [];
    for (const [exp, coeff] of this.termList()) {
      const sign = coeff < 0n ? '-' : '+';
      const abs = coeff < 0n ? -coeff : coeff;
      let body: string;
      if (exp === 0) {
        body = abs.toString();
      } else {
        let e: string;
        if (expDenominator === 1) {
          e = exp.toString();
        } else if (exp % expDenominator === 0) {
          e = (exp / expDenominator).toString();
        } else {
          const g = gcd(Math.abs(exp), expDenominator);
          e = `${exp / g}/${expDenominator / g}`;
        }
        const powStr = e === '1' ? variable : `${variable}^${e}`;
        body = abs === 1n ? powStr : `${abs}${powStr}`;
      }
      parts.push(parts.length === 0 && sign === '+' ? body : `${sign} ${body}`);
    }
    // First term: attach a leading minus without a space.
    let s = parts.join(' ');
    if (s.startsWith('- ')) s = '-' + s.slice(2);
    return s;
  }
}

function gcd(a: number, b: number): number {
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}
