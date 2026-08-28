import { Expense, Group, GroupMember } from '../types';

export interface FilterCriteria {
  keyword?: string;
  groupId?: string;
  category?: string;
  payerId?: string;
  memberId?: string;
  minAmount?: number;
  maxAmount?: number;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  splitType?: string;
}

/**
 * Multi-criteria search and filter across expenses
 */
export function filterExpenses(
  expenses: Expense[],
  groups: Group[],
  membersMap: Map<string, GroupMember>,
  criteria: FilterCriteria
): Expense[] {
  return expenses.filter(expense => {
    // 1. Group filter
    if (criteria.groupId && expense.groupId !== criteria.groupId) {
      return false;
    }

    // 2. Category filter
    if (criteria.category && criteria.category !== 'All' && expense.category !== criteria.category) {
      return false;
    }

    // 3. Payer filter
    if (criteria.payerId && expense.paidBy !== criteria.payerId) {
      return false;
    }

    // 4. Split Type filter
    if (criteria.splitType && criteria.splitType !== 'All' && expense.splitType !== criteria.splitType) {
      return false;
    }

    // 5. Amount range filter
    if (criteria.minAmount !== undefined && criteria.minAmount > 0 && expense.amount < criteria.minAmount) {
      return false;
    }
    if (criteria.maxAmount !== undefined && criteria.maxAmount > 0 && expense.amount > criteria.maxAmount) {
      return false;
    }

    // 6. Date range filter
    if (expense.date) {
      const expDate = expense.date.toDate().toISOString().split('T')[0];
      if (criteria.startDate && expDate < criteria.startDate) {
        return false;
      }
      if (criteria.endDate && expDate > criteria.endDate) {
        return false;
      }
    }

    // 7. Keyword search (case-insensitive across description, category, payer name, group name, amount)
    if (criteria.keyword && criteria.keyword.trim() !== '') {
      const kw = criteria.keyword.toLowerCase().trim();
      const group = groups.find(g => g.id === expense.groupId);
      const groupName = group ? group.name.toLowerCase() : '';
      const payerMember = membersMap.get(expense.paidBy);
      const payerName = payerMember ? (payerMember.displayName || payerMember.email || '').toLowerCase() : '';

      const matchDesc = expense.description.toLowerCase().includes(kw);
      const matchCat = expense.category.toLowerCase().includes(kw);
      const matchGroup = groupName.includes(kw);
      const matchPayer = payerName.includes(kw) || expense.paidBy.toLowerCase().includes(kw);
      const matchAmount = expense.amount.toString().includes(kw);

      if (!matchDesc && !matchCat && !matchGroup && !matchPayer && !matchAmount) {
        return false;
      }
    }

    return true;
  });
}
