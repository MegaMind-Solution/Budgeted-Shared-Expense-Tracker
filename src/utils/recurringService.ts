import { Expense } from '../types';
import { Timestamp } from 'firebase/firestore';

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurringRule {
  id: string;
  groupId: string;
  amount: number;
  description: string;
  category: string;
  paidBy: string;
  splitType: 'equal' | 'percentage' | 'exact';
  frequency: RecurrenceFrequency;
  startDate: string; // ISO string 'YYYY-MM-DD'
  endDate?: string;  // optional end date
  lastProcessedDate?: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
}

const RECURRING_STORAGE_KEY = 'budgeted_recurring_rules';

export function getRecurringRules(groupId?: string): RecurringRule[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECURRING_STORAGE_KEY);
    if (!raw) return [];
    const rules: RecurringRule[] = JSON.parse(raw);
    return groupId ? rules.filter(r => r.groupId === groupId) : rules;
  } catch (e) {
    console.error('Error parsing recurring rules:', e);
    return [];
  }
}

export function saveRecurringRule(rule: Omit<RecurringRule, 'id' | 'createdAt' | 'isActive'>): RecurringRule {
  const rules = getRecurringRules();
  const newRule: RecurringRule = {
    ...rule,
    id: 'rec_' + Math.random().toString(36).substring(2, 11),
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  rules.push(newRule);
  localStorage.setItem(RECURRING_STORAGE_KEY, JSON.stringify(rules));
  return newRule;
}

/**
 * Calculates next occurrence date based on frequency and last processed date or start date.
 */
export function getNextOccurrenceDate(currentDateStr: string, frequency: RecurrenceFrequency): Date {
  const current = new Date(currentDateStr);
  const next = new Date(current);

  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
  }

  return next;
}

/**
 * Idempotently processes active recurring rules up to current date.
 * Returns array of newly generated Expense objects with unique IDs without duplicate generation.
 */
export function processRecurringRules(
  groupId: string,
  existingExpenses: Expense[]
): { newExpenses: Omit<Expense, 'id' | 'createdAt'>[]; updatedRules: RecurringRule[] } {
  const rules = getRecurringRules(groupId).filter(r => r.isActive);
  const newExpenses: Omit<Expense, 'id' | 'createdAt'>[] = [];
  const updatedRules: RecurringRule[] = [];
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const allRules = getRecurringRules();

  allRules.forEach(rule => {
    if (rule.groupId !== groupId || !rule.isActive) return;

    let baseDateStr = rule.lastProcessedDate || rule.startDate;
    let nextDate = new Date(baseDateStr);

    let generatedForThisRule = 0;

    while (nextDate <= today) {
      if (rule.endDate && nextDate > new Date(rule.endDate)) {
        rule.isActive = false;
        break;
      }

      const dateISO = nextDate.toISOString().split('T')[0];

      // Check if expense for this rule on this date was already generated
      const exists = existingExpenses.some(e => 
        e.description === rule.description &&
        e.amount === rule.amount &&
        e.date.toDate().toISOString().split('T')[0] === dateISO
      );

      if (!exists) {
        newExpenses.push({
          amount: rule.amount,
          description: rule.description,
          category: rule.category,
          paidBy: rule.paidBy,
          date: Timestamp.fromDate(new Date(nextDate)),
          splitType: rule.splitType,
        });
      }

      rule.lastProcessedDate = dateISO;
      generatedForThisRule++;

      nextDate = getNextOccurrenceDate(dateISO, rule.frequency);
    }

    if (generatedForThisRule > 0) {
      updatedRules.push(rule);
    }
  });

  if (updatedRules.length > 0) {
    localStorage.setItem(RECURRING_STORAGE_KEY, JSON.stringify(allRules));
  }

  return { newExpenses, updatedRules };
}
