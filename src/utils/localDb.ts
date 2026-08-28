import { Timestamp } from 'firebase/firestore';
import { Group, Expense, GroupMember, GroupType, BudgetType } from '../types';

const GROUPS_KEY = 'budgeted_local_groups';
const EXPENSES_PREFIX = 'budgeted_local_expenses_';
const MEMBERS_PREFIX = 'budgeted_local_members_';

function generateId(): string {
  return Math.random().toString(36).substring(2, 11) + Math.random().toString(36).substring(2, 11);
}

function serializeTimestamp(ts: any): { seconds: number; nanoseconds: number } {
  if (ts && typeof ts.toDate === 'function') {
    return { seconds: ts.seconds, nanoseconds: ts.nanoseconds };
  }
  if (ts && typeof ts.seconds === 'number') {
    return { seconds: ts.seconds, nanoseconds: ts.nanoseconds || 0 };
  }
  const d = ts instanceof Date ? ts : ts ? new Date(ts) : new Date();
  const ms = d.getTime();
  return {
    seconds: Math.floor(ms / 1000),
    nanoseconds: (ms % 1000) * 1000000
  };
}

function deserializeTimestamp(obj: any): Timestamp {
  if (obj && typeof obj.seconds === 'number') {
    return new Timestamp(obj.seconds, obj.nanoseconds || 0);
  }
  return Timestamp.now();
}

function triggerLocalUpdate() {
  window.dispatchEvent(new Event('budgeted-local-update'));
}

export function getLocalGroups(): Group[] {
  const data = localStorage.getItem(GROUPS_KEY);
  if (!data) return [];
  try {
    const rawGroups = JSON.parse(data);
    return rawGroups.map((g: any) => ({
      ...g,
      createdAt: deserializeTimestamp(g.createdAt),
    } as Group));
  } catch (e) {
    console.error('Error parsing local groups:', e);
    return [];
  }
}

export function getLocalGroup(groupId: string): Group | null {
  const groups = getLocalGroups();
  return groups.find(g => g.id === groupId) || null;
}

export function saveLocalGroup(groupData: Omit<Group, 'id' | 'createdAt'>): Group {
  const groups = getLocalGroups();
  const newGroup: Group = {
    ...groupData,
    id: generateId(),
    createdAt: Timestamp.now(),
  };

  groups.push(newGroup);
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups.map(g => ({
    ...g,
    createdAt: serializeTimestamp(g.createdAt),
  }))));

  // Auto-initialize members list
  const defaultMember: GroupMember = {
    uid: 'local_guest',
    role: 'admin',
    joinedAt: Timestamp.now(),
    displayName: 'Guest User',
    email: 'guest@budgeted.local',
  };
  saveLocalMembers(newGroup.id, [defaultMember]);

  triggerLocalUpdate();
  return newGroup;
}

export function updateLocalGroup(groupId: string, data: Partial<Group>): void {
  const groups = getLocalGroups();
  const updatedGroups = groups.map(g => {
    if (g.id === groupId) {
      return {
        ...g,
        ...data,
      };
    }
    return g;
  });

  localStorage.setItem(GROUPS_KEY, JSON.stringify(updatedGroups.map(g => ({
    ...g,
    createdAt: serializeTimestamp(g.createdAt),
  }))));

  triggerLocalUpdate();
}

export function deleteLocalGroup(groupId: string): void {
  const groups = getLocalGroups();
  const filtered = groups.filter(g => g.id !== groupId);
  localStorage.setItem(GROUPS_KEY, JSON.stringify(filtered.map(g => ({
    ...g,
    createdAt: serializeTimestamp(g.createdAt),
  }))));

  localStorage.removeItem(`${EXPENSES_PREFIX}${groupId}`);
  localStorage.removeItem(`${MEMBERS_PREFIX}${groupId}`);

  triggerLocalUpdate();
}

export function getLocalExpenses(groupId: string): Expense[] {
  const data = localStorage.getItem(`${EXPENSES_PREFIX}${groupId}`);
  if (!data) return [];
  try {
    const rawExpenses = JSON.parse(data);
    return rawExpenses.map((e: any) => ({
      ...e,
      date: deserializeTimestamp(e.date),
      createdAt: deserializeTimestamp(e.createdAt),
    } as Expense));
  } catch (e) {
    console.error(`Error parsing local expenses for group ${groupId}:`, e);
    return [];
  }
}

export function saveLocalExpense(groupId: string, expenseData: Omit<Expense, 'id' | 'createdAt'>): Expense {
  const expenses = getLocalExpenses(groupId);
  const newExpense: Expense = {
    ...expenseData,
    id: generateId(),
    createdAt: Timestamp.now(),
  };

  expenses.push(newExpense);
  localStorage.setItem(`${EXPENSES_PREFIX}${groupId}`, JSON.stringify(expenses.map(e => ({
    ...e,
    date: serializeTimestamp(e.date),
    createdAt: serializeTimestamp(e.createdAt),
  }))));

  triggerLocalUpdate();
  return newExpense;
}

export function updateLocalExpense(groupId: string, expenseId: string, data: Partial<Expense>): void {
  const expenses = getLocalExpenses(groupId);
  const updatedExpenses = expenses.map(e => {
    if (e.id === expenseId) {
      return {
        ...e,
        ...data,
      };
    }
    return e;
  });

  localStorage.setItem(`${EXPENSES_PREFIX}${groupId}`, JSON.stringify(updatedExpenses.map(e => ({
    ...e,
    date: serializeTimestamp(e.date),
    createdAt: serializeTimestamp(e.createdAt),
  }))));

  triggerLocalUpdate();
}

export function deleteLocalExpense(groupId: string, expenseId: string): void {
  const expenses = getLocalExpenses(groupId);
  const filtered = expenses.filter(e => e.id !== expenseId);
  localStorage.setItem(`${EXPENSES_PREFIX}${groupId}`, JSON.stringify(filtered.map(e => ({
    ...e,
    date: serializeTimestamp(e.date),
    createdAt: serializeTimestamp(e.createdAt),
  }))));

  triggerLocalUpdate();
}

export function getLocalMembers(groupId: string): GroupMember[] {
  const data = localStorage.getItem(`${MEMBERS_PREFIX}${groupId}`);
  if (!data) {
    return [{
      uid: 'local_guest',
      role: 'admin',
      joinedAt: Timestamp.now(),
      displayName: 'Guest User',
      email: 'guest@budgeted.local',
    }];
  }
  try {
    const rawMembers = JSON.parse(data);
    return rawMembers.map((m: any) => ({
      ...m,
      joinedAt: deserializeTimestamp(m.joinedAt),
    } as GroupMember));
  } catch (e) {
    console.error(`Error parsing local members for group ${groupId}:`, e);
    return [];
  }
}

export function saveLocalMembers(groupId: string, members: GroupMember[]): void {
  localStorage.setItem(`${MEMBERS_PREFIX}${groupId}`, JSON.stringify(members.map(m => ({
    ...m,
    joinedAt: serializeTimestamp(m.joinedAt),
  }))));
}

export function duplicateLocalExpense(groupId: string, expenseId: string): Expense | null {
  const expenses = getLocalExpenses(groupId);
  const target = expenses.find(e => e.id === expenseId);
  if (!target) return null;

  return saveLocalExpense(groupId, {
    amount: target.amount,
    description: `${target.description} (Copy)`,
    category: target.category,
    paidBy: target.paidBy,
    date: Timestamp.now(),
    splitType: target.splitType,
  });
}

export function restoreLocalExpense(groupId: string, expense: Expense): void {
  const expenses = getLocalExpenses(groupId);
  if (expenses.some(e => e.id === expense.id)) return;
  expenses.push(expense);
  localStorage.setItem(`${EXPENSES_PREFIX}${groupId}`, JSON.stringify(expenses.map(e => ({
    ...e,
    date: serializeTimestamp(e.date),
    createdAt: serializeTimestamp(e.createdAt),
  }))));
  triggerLocalUpdate();
}

const SETTLEMENTS_PREFIX = 'budgeted_local_settlements_';

export function getLocalSettlements(groupId: string): any[] {
  const data = localStorage.getItem(`${SETTLEMENTS_PREFIX}${groupId}`);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

export function saveLocalSettlement(groupId: string, settlement: any): void {
  const settlements = getLocalSettlements(groupId);
  settlements.push(settlement);
  localStorage.setItem(`${SETTLEMENTS_PREFIX}${groupId}`, JSON.stringify(settlements));
  triggerLocalUpdate();
}

export function updateLocalSettlementStatus(groupId: string, settlementId: string, status: 'paid' | 'pending'): void {
  const settlements = getLocalSettlements(groupId);
  const updated = settlements.map((s: any) => s.id === settlementId ? { ...s, status, paidAt: status === 'paid' ? new Date().toISOString() : null } : s);
  localStorage.setItem(`${SETTLEMENTS_PREFIX}${groupId}`, JSON.stringify(updated));
  triggerLocalUpdate();
}

