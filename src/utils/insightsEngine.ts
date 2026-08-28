import { Expense, GroupMember } from '../types';
import { computeAnalyticsMetrics } from './analyticsService';
import { formatCurrency } from './format';

export interface InsightMessage {
  id: string;
  type: 'info' | 'warning' | 'success';
  title: string;
  description: string;
}

export function generateFinancialInsights(expenses: Expense[], members: GroupMember[] = []): InsightMessage[] {
  if (expenses.length === 0) {
    return [{
      id: 'insufficient_data',
      type: 'info',
      title: 'Insufficient Data',
      description: 'Add expenses to unlock automated spending insights and category trends.'
    }];
  }

  const metrics = computeAnalyticsMetrics(expenses, members);
  const insights: InsightMessage[] = [];

  // 1. Month-over-Month trend
  if (metrics.momPercentageChange !== null) {
    if (metrics.momPercentageChange > 0) {
      insights.push({
        id: 'mom_increase',
        type: 'warning',
        title: 'Spending Increased',
        description: `Spending increased by ${metrics.momPercentageChange}% compared with last month ($${formatCurrency(metrics.currentMonthTotal)} vs $${formatCurrency(metrics.previousMonthTotal)}).`
      });
    } else if (metrics.momPercentageChange < 0) {
      insights.push({
        id: 'mom_decrease',
        type: 'success',
        title: 'Spending Decreased',
        description: `Great job! Monthly spending decreased by ${Math.abs(metrics.momPercentageChange)}% compared with last month.`
      });
    }
  }

  // 2. Top Category
  const sortedCategories = Object.entries(metrics.categoryTotals).sort((a, b) => b[1] - a[1]);
  if (sortedCategories.length > 0) {
    const [topCat, topAmount] = sortedCategories[0];
    const topPct = metrics.categoryPercentages[topCat] || 0;
    insights.push({
      id: 'top_category',
      type: 'info',
      title: 'Top Category',
      description: `${topCat} is your highest spending category at $${formatCurrency(topAmount)} (${topPct}% of total spending).`
    });
  }

  // 3. Average Daily Spending
  if (metrics.avgDailySpending > 0) {
    insights.push({
      id: 'avg_daily',
      type: 'info',
      title: 'Average Daily Spending',
      description: `Your average daily spending across active days is $${formatCurrency(metrics.avgDailySpending)}.`
    });
  }

  // 4. Highest Single Expense
  if (metrics.highestExpense) {
    insights.push({
      id: 'highest_expense',
      type: 'info',
      title: 'Largest Expense',
      description: `Largest single purchase: "${metrics.highestExpense.description}" ($${formatCurrency(metrics.highestExpense.amount)}) in ${metrics.highestExpense.category}.`
    });
  }

  return insights;
}
