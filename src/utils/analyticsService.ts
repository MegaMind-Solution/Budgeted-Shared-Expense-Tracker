import { Expense, GroupMember } from '../types';
import { safeAdd, safeSubtract } from './moneyUtils';

export interface AnalyticsMetrics {
  currentMonthTotal: number;
  previousMonthTotal: number;
  momPercentageChange: number | null; // e.g. 18 for +18%
  avgDailySpending: number;
  totalExpensesCount: number;
  highestExpense: Expense | null;
  lowestExpense: Expense | null;
  avgExpenseAmount: number;
  categoryTotals: { [category: string]: number };
  categoryPercentages: { [category: string]: number };
  memberTotals: { [uid: string]: number };
  weekdaySpending: { [day: string]: number }; // Mon..Sun
  monthlySpending: { [monthKey: string]: number }; // 'Jan 2026'..
}

export function computeAnalyticsMetrics(expenses: Expense[], members: GroupMember[] = []): AnalyticsMetrics {
  if (expenses.length === 0) {
    return {
      currentMonthTotal: 0,
      previousMonthTotal: 0,
      momPercentageChange: null,
      avgDailySpending: 0,
      totalExpensesCount: 0,
      highestExpense: null,
      lowestExpense: null,
      avgExpenseAmount: 0,
      categoryTotals: {},
      categoryPercentages: {},
      memberTotals: {},
      weekdaySpending: { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 },
      monthlySpending: {},
    };
  }

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const prevMonthDate = new Date(now);
  prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
  const prevMonth = prevMonthDate.getMonth();
  const prevYear = prevMonthDate.getFullYear();

  let currentMonthTotal = 0;
  let previousMonthTotal = 0;
  let highestExpense: Expense | null = null;
  let lowestExpense: Expense | null = null;
  let totalSum = 0;

  const categoryTotals: { [key: string]: number } = {};
  const memberTotals: { [key: string]: number } = {};
  const weekdayMap: { [key: string]: number } = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthlySpending: { [key: string]: number } = {};

  const daysSet = new Set<string>();

  expenses.forEach(e => {
    const d = e.date.toDate();
    const dateStr = d.toISOString().split('T')[0];
    daysSet.add(dateStr);

    totalSum = safeAdd(totalSum, e.amount);

    // Current & previous month totals
    if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
      currentMonthTotal = safeAdd(currentMonthTotal, e.amount);
    }
    if (d.getMonth() === prevMonth && d.getFullYear() === prevYear) {
      previousMonthTotal = safeAdd(previousMonthTotal, e.amount);
    }

    // Min / Max
    if (!highestExpense || e.amount > highestExpense.amount) highestExpense = e;
    if (!lowestExpense || e.amount < lowestExpense.amount) lowestExpense = e;

    // Category
    categoryTotals[e.category] = safeAdd(categoryTotals[e.category] || 0, e.amount);

    // Member paid
    memberTotals[e.paidBy] = safeAdd(memberTotals[e.paidBy] || 0, e.amount);

    // Weekday
    const dayName = weekdays[d.getDay()];
    if (dayName in weekdayMap) {
      weekdayMap[dayName] = safeAdd(weekdayMap[dayName], e.amount);
    }

    // Monthly
    const mKey = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    monthlySpending[mKey] = safeAdd(monthlySpending[mKey] || 0, e.amount);
  });

  // MoM % change
  let momPercentageChange: number | null = null;
  if (previousMonthTotal > 0) {
    momPercentageChange = Math.round(((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100);
  }

  // Avg daily
  const activeDaysCount = Math.max(1, daysSet.size);
  const avgDailySpending = Math.round((totalSum / activeDaysCount) * 100) / 100;

  // Category %
  const categoryPercentages: { [key: string]: number } = {};
  Object.entries(categoryTotals).forEach(([cat, amount]) => {
    categoryPercentages[cat] = Math.round((amount / Math.max(1, totalSum)) * 100);
  });

  return {
    currentMonthTotal,
    previousMonthTotal,
    momPercentageChange,
    avgDailySpending,
    totalExpensesCount: expenses.length,
    highestExpense,
    lowestExpense,
    avgExpenseAmount: Math.round((totalSum / expenses.length) * 100) / 100,
    categoryTotals,
    categoryPercentages,
    memberTotals,
    weekdaySpending: weekdayMap,
    monthlySpending,
  };
}
