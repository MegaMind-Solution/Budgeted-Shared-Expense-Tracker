import { toMinorUnits, fromMinorUnits, reconcileShares } from './moneyUtils';

export type SplitMethod = 'equal' | 'percentage' | 'exact' | 'shares';

export interface ParticipantSplit {
  userId: string;
  amount: number;      // Calculated or exact share amount
  percentage?: number; // Used for percentage split
  shares?: number;     // Used for share-based split
}

export interface SplitResult {
  isValid: boolean;
  error?: string;
  splits: ParticipantSplit[];
}

/**
 * Calculates and validates splits for an expense among participants.
 */
export function calculateSplits(
  totalAmount: number,
  participants: string[],
  splitMethod: SplitMethod,
  inputs?: { [userId: string]: number } // custom amounts, percentages, or shares per participant
): SplitResult {
  if (!participants || participants.length === 0) {
    return { isValid: false, error: 'At least one participant is required', splits: [] };
  }
  if (totalAmount <= 0) {
    return { isValid: false, error: 'Expense amount must be greater than zero', splits: [] };
  }

  const resultSplits: ParticipantSplit[] = [];

  switch (splitMethod) {
    case 'equal': {
      const sharePerPerson = totalAmount / participants.length;
      const rawShares = participants.map(() => sharePerPerson);
      const reconciled = reconcileShares(totalAmount, rawShares);
      participants.forEach((uid, i) => {
        resultSplits.push({ userId: uid, amount: reconciled[i] });
      });
      return { isValid: true, splits: resultSplits };
    }

    case 'exact': {
      if (!inputs) {
        return { isValid: false, error: 'Exact amounts required for exact split', splits: [] };
      }
      let sumInputs = 0;
      participants.forEach(uid => {
        const val = inputs[uid] || 0;
        sumInputs += val;
        resultSplits.push({ userId: uid, amount: fromMinorUnits(toMinorUnits(val)) });
      });

      const totalMinor = toMinorUnits(totalAmount);
      const sumMinor = toMinorUnits(sumInputs);
      if (Math.abs(totalMinor - sumMinor) > 1) { // allow 1 cent rounding gap which can be reconciled
        return {
          isValid: false,
          error: `Sum of shares ($${sumInputs.toFixed(2)}) must equal total amount ($${totalAmount.toFixed(2)})`,
          splits: resultSplits
        };
      }
      
      // Reconcile minor cent variance if any
      const rawShares = resultSplits.map(s => s.amount);
      const reconciled = reconcileShares(totalAmount, rawShares);
      resultSplits.forEach((s, idx) => { s.amount = reconciled[idx]; });

      return { isValid: true, splits: resultSplits };
    }

    case 'percentage': {
      if (!inputs) {
        return { isValid: false, error: 'Percentages required for percentage split', splits: [] };
      }
      let totalPct = 0;
      participants.forEach(uid => {
        totalPct += inputs[uid] || 0;
      });

      if (Math.abs(totalPct - 100) > 0.01) {
        return {
          isValid: false,
          error: `Total percentage must equal 100% (currently ${totalPct.toFixed(1)}%)`,
          splits: []
        };
      }

      const rawShares = participants.map(uid => (totalAmount * (inputs[uid] || 0)) / 100);
      const reconciled = reconcileShares(totalAmount, rawShares);
      participants.forEach((uid, i) => {
        resultSplits.push({
          userId: uid,
          amount: reconciled[i],
          percentage: inputs[uid] || 0
        });
      });

      return { isValid: true, splits: resultSplits };
    }

    case 'shares': {
      if (!inputs) {
        return { isValid: false, error: 'Shares required for share-based split', splits: [] };
      }
      let totalShares = 0;
      participants.forEach(uid => {
        totalShares += Math.max(0, inputs[uid] || 0);
      });

      if (totalShares <= 0) {
        return { isValid: false, error: 'Total shares must be greater than zero', splits: [] };
      }

      const rawShares = participants.map(uid => (totalAmount * (inputs[uid] || 0)) / totalShares);
      const reconciled = reconcileShares(totalAmount, rawShares);
      participants.forEach((uid, i) => {
        resultSplits.push({
          userId: uid,
          amount: reconciled[i],
          shares: inputs[uid] || 0
        });
      });

      return { isValid: true, splits: resultSplits };
    }

    default:
      return { isValid: false, error: 'Unknown split method', splits: [] };
  }
}
