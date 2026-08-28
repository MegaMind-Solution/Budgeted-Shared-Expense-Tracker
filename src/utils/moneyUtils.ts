/**
 * Centralized Money Utility
 * Avoids floating-point precision issues by working with integer minor units (e.g. cents)
 * where appropriate and providing safe currency rounding methods.
 */

export interface Money {
  amountMinor: number; // e.g. 12550 for $125.50
  currency: string;    // e.g. 'USD', 'PKR'
}

/**
 * Converts a float amount to minor units (e.g., dollars to cents)
 */
export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Converts minor units back to a float number rounded to 2 decimals
 */
export function fromMinorUnits(minorUnits: number): number {
  return Math.round(minorUnits) / 100;
}

/**
 * Safely adds two monetary floating values
 */
export function safeAdd(a: number, b: number): number {
  return fromMinorUnits(toMinorUnits(a) + toMinorUnits(b));
}

/**
 * Safely subtracts b from a
 */
export function safeSubtract(a: number, b: number): number {
  return fromMinorUnits(toMinorUnits(a) - toMinorUnits(b));
}

/**
 * Safely multiplies amount by multiplier
 */
export function safeMultiply(amount: number, multiplier: number): number {
  return fromMinorUnits(Math.round(toMinorUnits(amount) * multiplier));
}

/**
 * Reconciles split amounts so that sum of participant shares equals exact total amount down to the cent.
 * Distributes remainder cents one by one to participants to guarantee zero drift.
 */
export function reconcileShares(totalAmount: number, rawShares: number[]): number[] {
  if (rawShares.length === 0) return [];
  const totalMinor = toMinorUnits(totalAmount);
  
  // Convert each raw share to minor units
  const minorShares = rawShares.map(s => Math.floor(toMinorUnits(s)));
  const sumMinor = minorShares.reduce((acc, curr) => acc + curr, 0);
  let remainder = totalMinor - sumMinor;

  // Distribute remainder cents to first N participants until remainder is 0
  const adjusted = [...minorShares];
  let idx = 0;
  while (remainder !== 0) {
    if (remainder > 0) {
      adjusted[idx % adjusted.length] += 1;
      remainder -= 1;
    } else {
      adjusted[idx % adjusted.length] -= 1;
      remainder += 1;
    }
    idx++;
  }

  return adjusted.map(fromMinorUnits);
}
