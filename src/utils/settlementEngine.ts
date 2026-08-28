import { Expense, GroupMember } from '../types';
import { calculateSplits } from './splitEngine';
import { toMinorUnits, fromMinorUnits, safeSubtract, safeAdd } from './moneyUtils';

export interface MemberBalance {
  uid: string;
  displayName: string;
  paid: number;    // Total paid for group expenses
  owed: number;    // Total share owed across expenses
  net: number;     // Net balance: positive = is owed money, negative = owes money
}

export interface SuggestedSettlement {
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  amount: number;
}

export interface SettlementRecord {
  id: string;
  groupId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  status: 'pending' | 'paid';
  createdAt: any;
  paidAt?: any;
  createdBy: string;
}

/**
 * Calculates net member balances across expenses.
 * Note: Settlements paid marked as 'paid' are factored in to reduce debts appropriately.
 */
export function calculateMemberBalances(
  members: GroupMember[],
  expenses: Expense[],
  paidSettlements: SettlementRecord[] = []
): MemberBalance[] {
  const balancesMap: { [uid: string]: { paid: number; owed: number; name: string } } = {};

  members.forEach(m => {
    balancesMap[m.uid] = {
      paid: 0,
      owed: 0,
      name: m.displayName || m.email || m.uid
    };
  });

  // 1. Process expenses
  expenses.forEach(e => {
    // Add paid amount to payer
    if (balancesMap[e.paidBy]) {
      balancesMap[e.paidBy].paid = safeAdd(balancesMap[e.paidBy].paid, e.amount);
    } else {
      balancesMap[e.paidBy] = { paid: e.amount, owed: 0, name: e.paidBy };
    }

    // Split amount among members
    const memberIds = members.map(m => m.uid);
    // If expense participants specified or splitType equal across members
    const splitRes = calculateSplits(e.amount, memberIds, 'equal');
    if (splitRes.isValid) {
      splitRes.splits.forEach(s => {
        if (balancesMap[s.userId]) {
          balancesMap[s.userId].owed = safeAdd(balancesMap[s.userId].owed, s.amount);
        } else {
          balancesMap[s.userId] = { paid: 0, owed: s.amount, name: s.userId };
        }
      });
    }
  });

  // 2. Factor in paid settlements (fromUserId paid toUserId)
  paidSettlements.forEach(s => {
    if (s.status === 'paid') {
      // fromUserId paid out amount -> reduces their net debt (effectively increases paid)
      if (balancesMap[s.fromUserId]) {
        balancesMap[s.fromUserId].paid = safeAdd(balancesMap[s.fromUserId].paid, s.amount);
      }
      // toUserId received amount -> reduces their net credit (effectively increases owed)
      if (balancesMap[s.toUserId]) {
        balancesMap[s.toUserId].owed = safeAdd(balancesMap[s.toUserId].owed, s.amount);
      }
    }
  });

  return Object.keys(balancesMap).map(uid => {
    const item = balancesMap[uid];
    const net = safeSubtract(item.paid, item.owed);
    return {
      uid,
      displayName: item.name,
      paid: item.paid,
      owed: item.owed,
      net
    };
  });
}

/**
 * Greedy debt simplification algorithm:
 * Minimizes total number of transfers required to settle all debts in a group.
 */
export function generateSettlementSuggestions(balances: MemberBalance[]): SuggestedSettlement[] {
  const debtors: { uid: string; name: string; amountMinor: number }[] = [];
  const creditors: { uid: string; name: string; amountMinor: number }[] = [];

  balances.forEach(b => {
    const netMinor = toMinorUnits(b.net);
    if (netMinor < 0) {
      debtors.push({ uid: b.uid, name: b.displayName, amountMinor: Math.abs(netMinor) });
    } else if (netMinor > 0) {
      creditors.push({ uid: b.uid, name: b.displayName, amountMinor: netMinor });
    }
  });

  // Sort debtors & creditors by amount descending
  debtors.sort((a, b) => b.amountMinor - a.amountMinor);
  creditors.sort((a, b) => b.amountMinor - a.amountMinor);

  const suggestions: SuggestedSettlement[] = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const transferMinor = Math.min(debtor.amountMinor, creditor.amountMinor);
    if (transferMinor > 0) {
      suggestions.push({
        fromUserId: debtor.uid,
        fromUserName: debtor.name,
        toUserId: creditor.uid,
        toUserName: creditor.name,
        amount: fromMinorUnits(transferMinor)
      });
    }

    debtor.amountMinor -= transferMinor;
    creditor.amountMinor -= transferMinor;

    if (debtor.amountMinor === 0) dIdx++;
    if (creditor.amountMinor === 0) cIdx++;
  }

  return suggestions;
}
