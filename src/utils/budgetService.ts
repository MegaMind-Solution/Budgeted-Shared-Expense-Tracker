import { Expense, Group, BudgetType } from '../types';
import { safeSubtract, safeAdd } from './moneyUtils';

export interface BudgetStatus {
  maxBudget: number;
  actualSpent: number;
  remaining: number;
  utilizationPercent: number;
  isOverBudget: boolean;
  budgetType: BudgetType;
}

export interface CategoryBudget {
  category: string;
  maxBudget: number;
  actualSpent: number;
  remaining: number;
  utilizationPercent: number;
  isOverBudget: boolean;
}

/**
 * Calculates budget status for a group based on expenses.
 * Excludes settlements and prevents double-counting.
 */
export function calculateBudgetStatus(group: Group, expenses: Expense[]): BudgetStatus | null {
  if (!group.maxBudget || group.maxBudget <= 0) {
    return null;
  }

  const budgetType = group.budgetType || 'monthly';
  const now = new Date();

  // Filter expenses based on budget period
  const filteredExpenses = expenses.filter(e => {
    const expenseDate = e.date.toDate();

    if (budgetType === 'weekly') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(now.getDate() - 7);
      return expenseDate >= oneWeekAgo && expenseDate <= now;
    } else if (budgetType === 'monthly') {
      return expenseDate.getMonth() === now.getMonth() && expenseDate.getFullYear() === now.getFullYear();
    }
    // 'total' or default
    return true;
  });

  const actualSpent = filteredExpenses.reduce((sum, e) => safeAdd(sum, e.amount), 0);
  const remaining = safeSubtract(group.maxBudget, actualSpent);
  const utilizationPercent = Math.min(100, Math.round((actualSpent / group.maxBudget) * 100));

  return {
    maxBudget: group.maxBudget,
    actualSpent,
    remaining,
    utilizationPercent,
    isOverBudget: actualSpent > group.maxBudget,
    budgetType,
  };
}

/**
 * Calculates category-specific budget statuses
 */
export function calculateCategoryBudgets(
  categoryMaxBudgets: { [category: string]: number },
  expenses: Expense[]
): CategoryBudget[] {
  const result: CategoryBudget[] = [];
  const now = new Date();

  const currentMonthExpenses = expenses.filter(e => {
    const d = e.date.toDate();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  Object.entries(categoryMaxBudgets).forEach(([cat, maxB]) => {
    if (maxB <= 0) return;
    const actual = currentMonthExpenses
      .filter(e => e.category === cat)
      .reduce((sum, e) => safeAdd(sum, e.amount), 0);
    const remaining = safeSubtract(maxB, actual);
    const utilization = Math.min(100, Math.round((actual / maxB) * 100));

    result.push({
      category: cat,
      maxBudget: maxB,
      actualSpent: actual,
      remaining,
      utilizationPercent: utilization,
      isOverBudget: actual > maxB
    });
  });

  return result;
}
