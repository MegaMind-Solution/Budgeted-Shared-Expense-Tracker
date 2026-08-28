import { Group, Expense, GroupMember } from '../types';
import { SettlementRecord } from './settlementEngine';
import { RecurringRule, getRecurringRules } from './recurringService';
import { CategoryItem, getGroupCategories } from './categoryService';
import { Timestamp } from 'firebase/firestore';
import { getLocalGroups, getLocalExpenses, getLocalMembers, saveLocalGroup, saveLocalExpense, saveLocalMembers } from './localDb';

export interface BackupData {
  version: number;
  exportedAt: string;
  appName: string;
  groups: Group[];
  expenses: { [groupId: string]: Expense[] };
  members: { [groupId: string]: GroupMember[] };
  settlements: SettlementRecord[];
  categories: CategoryItem[];
  recurringRules: RecurringRule[];
}

/**
 * Escapes fields for CSV to handle quotes, commas, and newlines cleanly.
 */
export function escapeCSVField(field: string | number | undefined | null): string {
  if (field === null || field === undefined) return '""';
  const str = String(field);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates properly formatted CSV string for expenses.
 */
export function exportExpensesToCSV(expenses: Expense[], groupsMap: Map<string, Group>, membersMap: Map<string, GroupMember>): string {
  const headers = ['Date', 'Description', 'Category', 'Amount', 'Group', 'Paid By', 'Split Type'];
  const rows = expenses.map(e => {
    const group = groupsMap.get(e.groupId || '');
    const member = membersMap.get(e.paidBy);
    const dateStr = e.date ? e.date.toDate().toLocaleDateString('en-US') : '';
    const groupName = group ? group.name : 'Personal';
    const payerName = member ? (member.displayName || member.email || e.paidBy) : e.paidBy;

    return [
      escapeCSVField(dateStr),
      escapeCSVField(e.description),
      escapeCSVField(e.category),
      e.amount.toFixed(2),
      escapeCSVField(groupName),
      escapeCSVField(payerName),
      escapeCSVField(e.splitType || 'equal')
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Versioned JSON Backup Export
 */
export function generateJSONBackup(groups: Group[], allExpenses: Expense[], userUid: string): BackupData {
  const expensesMap: { [groupId: string]: Expense[] } = {};
  const membersMap: { [groupId: string]: GroupMember[] } = {};

  groups.forEach(g => {
    expensesMap[g.id] = getLocalExpenses(g.id);
    membersMap[g.id] = getLocalMembers(g.id);
  });

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    appName: 'Budgeted',
    groups,
    expenses: expensesMap,
    members: membersMap,
    settlements: [],
    categories: getGroupCategories(),
    recurringRules: getRecurringRules()
  };
}

/**
 * Validates JSON backup file structure before restore
 */
export function validateJSONBackup(data: any): { isValid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { isValid: false, error: 'Invalid file format: Expected JSON object.' };
  }
  if (data.version !== 1) {
    return { isValid: false, error: `Unsupported backup version: ${data.version}` };
  }
  if (!Array.isArray(data.groups)) {
    return { isValid: false, error: 'Backup is missing valid "groups" array.' };
  }
  return { isValid: true };
}

/**
 * Parses and validates CSV import lines
 */
export function parseCSVExpenses(csvText: string): { validExpenses: Partial<Expense>[]; errors: string[] } {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
  const errors: string[] = [];
  const validExpenses: Partial<Expense>[] = [];

  if (lines.length < 2) {
    return { validExpenses: [], errors: ['CSV file is empty or missing data rows.'] };
  }

  // Parse header
  const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
  const dateIdx = header.findIndex(h => h.includes('date'));
  const descIdx = header.findIndex(h => h.includes('desc') || h.includes('memo') || h.includes('item'));
  const catIdx = header.findIndex(h => h.includes('cat'));
  const amountIdx = header.findIndex(h => h.includes('amount') || h.includes('cost') || h.includes('price'));

  if (descIdx === -1 || amountIdx === -1) {
    return { validExpenses: [], errors: ['CSV must contain at least "Description" and "Amount" columns.'] };
  }

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(',').map(cell => cell.trim().replace(/^"|"$/g, ''));
    if (row.length < 2) continue;

    const desc = row[descIdx] || 'Imported Expense';
    const amountNum = parseFloat(row[amountIdx] || '0');
    const cat = catIdx !== -1 && row[catIdx] ? row[catIdx] : 'Other';
    const dateStr = dateIdx !== -1 && row[dateIdx] ? row[dateIdx] : new Date().toISOString();

    if (isNaN(amountNum) || amountNum <= 0) {
      errors.push(`Row ${i + 1}: Invalid or zero amount "${row[amountIdx]}"`);
      continue;
    }

    let parsedDate = new Date(dateStr);
    if (isNaN(parsedDate.getTime())) {
      parsedDate = new Date();
    }

    validExpenses.push({
      description: desc,
      amount: amountNum,
      category: cat,
      date: Timestamp.fromDate(parsedDate),
      splitType: 'equal',
      paidBy: 'local_guest'
    });
  }

  return { validExpenses, errors };
}

/**
 * Guest Mode -> Account Data Migration Plan & Execution
 */
export async function migrateGuestDataToFirebase(
  firestoreDb: any,
  authenticatedUserUid: string,
  userDisplayName: string,
  userEmail: string
): Promise<{ success: boolean; groupsMigrated: number; expensesMigrated: number; error?: string }> {
  try {
    const { collection, doc, setDoc, serverTimestamp, writeBatch } = await import('firebase/firestore');

    const guestGroups = getLocalGroups();
    if (guestGroups.length === 0) {
      return { success: true, groupsMigrated: 0, expensesMigrated: 0 };
    }

    let groupsCount = 0;
    let expensesCount = 0;

    for (const group of guestGroups) {
      const groupRef = doc(firestoreDb, 'groups', group.id);
      await setDoc(groupRef, {
        name: group.name,
        description: group.description || '',
        type: group.type,
        createdBy: authenticatedUserUid,
        createdAt: serverTimestamp(),
        memberIds: [authenticatedUserUid],
        maxBudget: group.maxBudget || null,
        budgetType: group.budgetType || 'monthly'
      });
      groupsCount++;

      // Member doc
      const memberRef = doc(firestoreDb, 'groups', group.id, 'members', authenticatedUserUid);
      await setDoc(memberRef, {
        uid: authenticatedUserUid,
        role: 'admin',
        joinedAt: serverTimestamp(),
        displayName: userDisplayName,
        email: userEmail
      });

      // Migrate expenses
      const localExpenses = getLocalExpenses(group.id);
      for (const expense of localExpenses) {
        const expRef = doc(firestoreDb, 'groups', group.id, 'expenses', expense.id);
        await setDoc(expRef, {
          amount: expense.amount,
          description: expense.description,
          category: expense.category,
          paidBy: authenticatedUserUid,
          date: expense.date,
          createdAt: serverTimestamp(),
          splitType: expense.splitType || 'equal'
        });
        expensesCount++;
      }
    }

    return { success: true, groupsMigrated: groupsCount, expensesMigrated: expensesCount };
  } catch (e: any) {
    console.error('Error migrating guest data to Firebase:', e);
    return { success: false, groupsMigrated: 0, expensesMigrated: 0, error: e.message || String(e) };
  }
}
