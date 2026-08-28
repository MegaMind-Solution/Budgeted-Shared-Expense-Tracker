import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Receipt, 
  ArrowRight,
  Plus,
  Wallet,
  Calendar,
  Pencil,
  Trash2,
  Loader2,
  X,
  Search,
  Download
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip as RechartsTooltip, 
  Legend, 
  CartesianGrid 
} from 'recharts';
import { Group, Expense, BudgetType, CATEGORIES } from '../types';
import { db } from '../firebase';
import { collection, query, onSnapshot, orderBy, limit, doc, updateDoc, deleteDoc, Timestamp, addDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { formatCurrency } from '../utils/format';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';
import { getLocalExpenses, updateLocalExpense, deleteLocalExpense, saveLocalExpense } from '../utils/localDb';

interface DashboardProps {
  user: User;
  groups: Group[];
  onSelectGroup: (id: string) => void;
  theme: 'light' | 'dark';
}

interface Alert {
  id: string;
  message: string;
  type: 'warning' | 'info';
  groupId: string;
}

interface DashboardExpense extends Expense {
  groupId: string;
}

export default function Dashboard({ user, groups, onSelectGroup, theme }: DashboardProps) {
  const [recentExpenses, setRecentExpenses] = useState<DashboardExpense[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isGroupsListOpen, setIsGroupsListOpen] = useState(false);

  const [allGroupsExpenses, setAllGroupsExpenses] = useState<DashboardExpense[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Quick Add states
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAmount, setQuickAmount] = useState('');
  const [quickDescription, setQuickDescription] = useState('');
  const [quickCategory, setQuickCategory] = useState(CATEGORIES[0]);
  const [quickDate, setQuickDate] = useState(new Date().toISOString().split('T')[0]);
  const [quickGroupId, setQuickGroupId] = useState('');

  // Pre-select group when groups list updates
  useEffect(() => {
    if (groups.length > 0 && !quickGroupId) {
      setQuickGroupId(groups[0].id);
    }
  }, [groups, quickGroupId]);

  // Filtered groups based on search query
  const filteredGroups = React.useMemo(() => {
    const queryStr = searchQuery.toLowerCase().trim();
    if (!queryStr) return [];
    return groups.filter(
      group => 
        group.name.toLowerCase().includes(queryStr) || 
        group.type.toLowerCase().includes(queryStr)
    );
  }, [groups, searchQuery]);

  // CSV Export for personal records
  const handleExportCSV = () => {
    if (allGroupsExpenses.length === 0) return;

    const headers = ['Group', 'Date', 'Description', 'Category', 'Amount', 'Paid By', 'Split Type'];
    
    const rows = allGroupsExpenses.map(expense => {
      const group = groups.find(g => g.id === expense.groupId);
      const groupName = group ? group.name : 'Unknown';
      const dateStr = expense.date.toDate().toLocaleDateString();
      const paidByStr = expense.paidBy === user.uid ? 'You' : expense.paidBy;
      
      const cleanGroupName = `"${groupName.replace(/"/g, '""')}"`;
      const cleanDesc = `"${expense.description.replace(/"/g, '""')}"`;
      const cleanCategory = `"${expense.category.replace(/"/g, '""')}"`;
      
      return [
        cleanGroupName,
        dateStr,
        cleanDesc,
        cleanCategory,
        expense.amount.toFixed(2),
        paidByStr,
        expense.splitType
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `budgeted_all_groups_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Recharts Monthly Summary Calculations for the last 6 months
  const monthlyChartData = React.useMemo(() => {
    const dataMap: { [key: string]: { monthName: string; total: number; [groupName: string]: any } } = {};
    const months: { year: number; month: number; label: string; key: string }[] = [];

    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString('en-US', { month: 'short' });
      const year = d.getFullYear();
      const month = d.getMonth();
      const key = `${year}-${month}`;
      months.push({ year, month, label, key });
      dataMap[key] = { monthName: label, total: 0 };
    }

    groups.forEach(g => {
      months.forEach(m => {
        dataMap[m.key][g.name] = 0;
      });
    });

    allGroupsExpenses.forEach(expense => {
      const expDate = expense.date.toDate();
      const year = expDate.getFullYear();
      const month = expDate.getMonth();
      const key = `${year}-${month}`;

      if (dataMap[key]) {
        const group = groups.find(g => g.id === expense.groupId);
        const groupName = group ? group.name : 'Unknown';
        
        dataMap[key].total = (dataMap[key].total || 0) + expense.amount;
        dataMap[key][groupName] = (dataMap[key][groupName] || 0) + expense.amount;
      }
    });

    return months.map(m => dataMap[m.key]);
  }, [allGroupsExpenses, groups]);

  // Quick Add handler
  const handleQuickAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAmount || !quickDescription || !quickGroupId) return;

    setIsSaving(true);
    try {
      const expenseData = {
        amount: parseFloat(quickAmount),
        description: quickDescription.trim(),
        category: quickCategory,
        paidBy: user.uid,
        date: Timestamp.fromDate(new Date(quickDate)),
        splitType: 'equal' as const,
      };

      if (user.uid === 'local_guest') {
        saveLocalExpense(quickGroupId, expenseData);
      } else {
        const { serverTimestamp } = await import('firebase/firestore');
        await addDoc(collection(db, 'groups', quickGroupId, 'expenses'), {
          ...expenseData,
          createdAt: serverTimestamp(),
        });
      }

      setQuickAmount('');
      setQuickDescription('');
      setQuickCategory(CATEGORIES[0]);
      setQuickDate(new Date().toISOString().split('T')[0]);
      setQuickAddOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `groups/${quickGroupId}/expenses`);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Edit/Delete states
  const [editingExpense, setEditingExpense] = useState<DashboardExpense | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<DashboardExpense | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const groupsListModalRef = React.useRef<HTMLDivElement>(null);
  const deleteExpenseModalRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isGroupsListOpen && groupsListModalRef.current) {
      groupsListModalRef.current.focus();
    }
  }, [isGroupsListOpen]);

  useEffect(() => {
    if (expenseToDelete && deleteExpenseModalRef.current) {
      deleteExpenseModalRef.current.focus();
    }
  }, [expenseToDelete]);

  // Form states for editing
  const [editAmount, setEditAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState(CATEGORIES[0]);
  const [editDate, setEditDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (editingExpense) {
      setEditAmount(editingExpense.amount.toString());
      setEditDescription(editingExpense.description);
      setEditCategory(editingExpense.category);
      setEditDate(editingExpense.date.toDate().toISOString().split('T')[0]);
    }
  }, [editingExpense]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditingExpense(null);
        setExpenseToDelete(null);
        setIsGroupsListOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleUpdateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;

    setIsSaving(true);
    try {
      if (user.uid === 'local_guest') {
        updateLocalExpense(editingExpense.groupId, editingExpense.id, {
          amount: parseFloat(editAmount),
          description: editDescription,
          category: editCategory,
          date: Timestamp.fromDate(new Date(editDate)),
        });
      } else {
        const expenseRef = doc(db, 'groups', editingExpense.groupId, 'expenses', editingExpense.id);
        await updateDoc(expenseRef, {
          amount: parseFloat(editAmount),
          description: editDescription,
          category: editCategory,
          date: Timestamp.fromDate(new Date(editDate)),
        });
      }
      setEditingExpense(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `groups/${editingExpense.groupId}/expenses/${editingExpense.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteExpense = async () => {
    if (!expenseToDelete) return;

    setIsDeleting(true);
    try {
      if (user.uid === 'local_guest') {
        deleteLocalExpense(expenseToDelete.groupId, expenseToDelete.id);
      } else {
        const expenseRef = doc(db, 'groups', expenseToDelete.groupId, 'expenses', expenseToDelete.id);
        await deleteDoc(expenseRef);
      }
      setExpenseToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `groups/${expenseToDelete.groupId}/expenses/${expenseToDelete.id}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const isDateInCurrentPeriod = (date: Date, type: BudgetType) => {
    const now = new Date();
    if (type === 'total') return true;
    
    if (type === 'monthly') {
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }
    
    if (type === 'weekly') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);
      
      return date >= startOfWeek && date < endOfWeek;
    }
    
    return true;
  };

  useEffect(() => {
    if (groups.length === 0) {
      setRecentExpenses([]);
      setAlerts([]);
      return;
    }

    if (user.uid === 'local_guest') {
      const fetchLocalData = () => {
        const allExpenses: DashboardExpense[] = [];
        const newAlerts: Alert[] = [];

        groups.forEach(group => {
          const gExpenses = getLocalExpenses(group.id).map(e => ({
            ...e,
            groupId: group.id,
          } as DashboardExpense));

          allExpenses.push(...gExpenses);

          if (group.maxBudget) {
            const currentPeriodExpenses = gExpenses.filter(e =>
              isDateInCurrentPeriod(e.date.toDate(), group.budgetType || 'total')
            );
            const totalSpent = currentPeriodExpenses.reduce((sum, e) => sum + e.amount, 0);

            if (totalSpent > group.maxBudget) {
              newAlerts.push({
                id: `over-budget-${group.id}`,
                message: `Group "${group.name}" is over its ${group.budgetType || 'total'} budget ($${totalSpent.toFixed(2)} / $${group.maxBudget.toFixed(2)})`,
                type: 'warning' as const,
                groupId: group.id,
              });
            }
          }
        });

        allExpenses.sort((a, b) => b.date.toMillis() - a.date.toMillis());
        setRecentExpenses(allExpenses.slice(0, 10));
        setAllGroupsExpenses(allExpenses);
        setAlerts(newAlerts);
      };

      fetchLocalData();
      window.addEventListener('budgeted-local-update', fetchLocalData);
      return () => window.removeEventListener('budgeted-local-update', fetchLocalData);
    }

    const expensesMap = new Map<string, DashboardExpense[]>();
    
    const unsubscribes = groups.map(group => {
      const expensesQuery = query(
        collection(db, 'groups', group.id, 'expenses'),
        orderBy('date', 'desc')
      );

      return onSnapshot(expensesQuery, (snapshot) => {
        const fetchedExpenses = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          groupId: group.id,
          ...doc.data() 
        } as DashboardExpense));
        
        expensesMap.set(group.id, fetchedExpenses);
        
        // Combine all expenses from all groups
        const allExpenses = Array.from(expensesMap.values()).flat();
        
        // Sort by date descending
        allExpenses.sort((a, b) => b.date.toMillis() - a.date.toMillis());
        
        // Take top 10
        setRecentExpenses(allExpenses.slice(0, 10));
        setAllGroupsExpenses(allExpenses);
        
        // Generate alerts based on budgets
        const newAlerts: Alert[] = [];
        
        groups.forEach(g => {
          if (!g.maxBudget) return;
          
          const gExpenses = expensesMap.get(g.id) || [];
          const currentPeriodExpenses = gExpenses.filter(e => 
            isDateInCurrentPeriod(e.date.toDate(), g.budgetType || 'total')
          );
          
          const totalSpent = currentPeriodExpenses.reduce((sum, e) => sum + e.amount, 0);
          
          if (totalSpent > g.maxBudget) {
            newAlerts.push({
              id: `over-budget-${g.id}`,
              message: `Group "${g.name}" is over its ${g.budgetType || 'total'} budget ($${totalSpent.toFixed(2)} / $${g.maxBudget.toFixed(2)})`,
              type: 'warning' as const,
              groupId: g.id
            });
          }
        });
        
        setAlerts(newAlerts);
        
      }, (error) => {
        if (error.message.includes('Missing or insufficient permissions')) {
          // This is expected if the group was just deleted and the listener hasn't been detached yet
          return;
        }
        console.error("Error fetching expenses for group", group.id, error);
      });
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [groups, user.uid]);

  return (
    <div className="max-w-6xl mx-auto">
      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-zinc-900 dark:text-white mb-3 font-display">
            Welcome back, <span className="text-indigo-600 dark:text-indigo-400">{user.displayName?.split(' ')[0]}</span>
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 font-medium text-lg">Here's what's happening with your shared budgets today.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={handleExportCSV}
            disabled={allGroupsExpenses.length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-2xl text-sm font-bold hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm font-display"
          >
            <Download className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            Export CSV
          </button>
          <button 
            onClick={() => (window as any).openCreateGroupModal?.()}
            className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-2xl text-sm font-bold hover:bg-purple-700 hover:shadow-xl hover:shadow-purple-600/30 transition-all shadow-lg shadow-purple-600/20 active:scale-95 cursor-pointer font-display"
          >
            <Plus className="w-4 h-4" />
            Create New Group
          </button>
        </div>
      </header>

      {/* Search Bar */}
      <div className="relative mb-10 max-w-xl">
        <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
        <input
          type="text"
          placeholder="Search groups by name or type (e.g. personal, household, trip)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-10 py-3.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-sm dark:text-white font-medium shadow-sm outline-none"
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {searchQuery.trim() !== '' ? (
        <section className="mb-12">
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white font-display mb-6">
            Search Results ({filteredGroups.length})
          </h2>
          {filteredGroups.length === 0 ? (
            <div className="p-12 bg-white dark:bg-zinc-900 rounded-[32px] border border-zinc-200 dark:border-zinc-800 text-center text-zinc-500 dark:text-zinc-400 font-medium">
              No groups match "{searchQuery}"
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredGroups.map(group => (
                <button
                  key={group.id}
                  onClick={() => onSelectGroup(group.id)}
                  className="text-left bg-white dark:bg-zinc-900 p-6 rounded-[28px] border border-zinc-200 dark:border-zinc-800 hover:border-purple-500 dark:hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/5 transition-all group flex flex-col justify-between h-44 cursor-pointer relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-zinc-50 dark:bg-zinc-800/20 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform animate-pulse" />
                  <div className="relative z-10 w-full">
                    <div className="flex items-center justify-between mb-4">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${
                        group.type === 'personal' ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20' :
                        group.type === 'household' ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' :
                        group.type === 'trip' ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20' :
                        'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20'
                      }`}>
                        {group.type}
                      </span>
                      <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:translate-x-1.5 transition-transform" />
                    </div>
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors line-clamp-1 mb-1 font-display">{group.name}</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">{group.description || 'No description provided.'}</p>
                  </div>
                  {group.maxBudget && (
                    <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 mt-4 font-display">
                      Budget: ${group.maxBudget} ({group.budgetType})
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </section>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <button 
          onClick={() => {
            if (groups.length === 0) return;
            if (groups.length === 1) {
              onSelectGroup(groups[0].id);
            } else {
              setIsGroupsListOpen(true);
            }
          }}
          className={`text-left bg-purple-600 p-8 rounded-[32px] shadow-lg shadow-purple-600/30 relative overflow-hidden group transition-all ${groups.length > 0 ? 'hover:scale-[1.02] active:scale-95 cursor-pointer' : 'cursor-default'}`}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
          <div className="relative z-10">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6">
              <Users className="w-6 h-6 text-white" />
            </div>
            <p className="text-xs font-bold text-purple-100 uppercase tracking-[0.2em] mb-1 font-display">Active Groups</p>
            <p className="text-4xl font-bold text-white font-display tracking-tight">{groups.length}</p>
          </div>
        </button>

        <button 
          onClick={() => {
            if (recentExpenses.length === 0) return;
            onSelectGroup(recentExpenses[0].groupId);
          }}
          className={`text-left bg-emerald-600 p-8 rounded-[32px] shadow-lg shadow-emerald-500/30 relative overflow-hidden group transition-all ${recentExpenses.length > 0 ? 'hover:scale-[1.02] active:scale-95 cursor-pointer' : 'cursor-default'}`}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
          <div className="relative z-10">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6">
              <Receipt className="w-6 h-6 text-white" />
            </div>
            <p className="text-xs font-bold text-emerald-100 uppercase tracking-[0.2em] mb-1 font-display">Recent Expenses</p>
            <p className="text-4xl font-bold text-white font-display tracking-tight">{recentExpenses.length}</p>
          </div>
        </button>

        <button 
          onClick={() => {
            if (alerts.length === 0) return;
            onSelectGroup(alerts[0].groupId);
          }}
          className={`text-left bg-amber-600 p-8 rounded-[32px] shadow-lg shadow-amber-500/30 relative overflow-hidden group transition-all ${alerts.length > 0 ? 'hover:scale-[1.02] active:scale-95 cursor-pointer' : 'cursor-default'}`}
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
          <div className="relative z-10">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <p className="text-xs font-bold text-amber-100 uppercase tracking-[0.2em] mb-1 font-display">Active Alerts</p>
            <p className="text-4xl font-bold text-white font-display tracking-tight">{alerts.length}</p>
          </div>
        </button>
      </div>

      <AnimatePresence>
        {isGroupsListOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
              onClick={() => setIsGroupsListOpen(false)}
            />
            <motion.div 
              ref={groupsListModalRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby="select-group-title"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] shadow-2xl overflow-hidden outline-none"
            >
              <div className="p-8">
                <h3 id="select-group-title" className="text-xl font-bold text-zinc-900 dark:text-white mb-6 font-display">Select a Group</h3>
                <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {groups.map(group => (
                  <button
                    key={group.id}
                    onClick={() => {
                      onSelectGroup(group.id);
                      setIsGroupsListOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/50 transition-all text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${group.type === 'personal' ? 'bg-blue-400' : group.type === 'household' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                      <span className="font-bold text-zinc-900 dark:text-white">{group.name}</span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-400 dark:text-zinc-500 group-hover:translate-x-1 transition-transform" />
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-12">
          {/* Monthly Summary Card */}
          <section className="bg-white dark:bg-zinc-900 p-8 rounded-[40px] border border-zinc-200/80 dark:border-zinc-800 shadow-xl shadow-zinc-200/40 dark:shadow-black/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white font-display flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  Monthly Summary
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-1">Spending trends over the last 6 months across your active groups</p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-2xl font-bold font-mono tracking-tight text-purple-600 dark:text-purple-400">
                  ${formatCurrency(allGroupsExpenses.reduce((sum, e) => {
                    const expDate = e.date.toDate();
                    const now = new Date();
                    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
                    return expDate >= sixMonthsAgo ? sum + e.amount : sum;
                  }, 0))}
                </span>
                <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-display">6-Month Total</p>
              </div>
            </div>

            {allGroupsExpenses.length === 0 ? (
              <div className="h-[280px] flex flex-col items-center justify-center text-center p-6 bg-zinc-50 dark:bg-zinc-800/10 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-[24px]">
                <Calendar className="w-10 h-10 text-zinc-300 dark:text-zinc-700 mb-3" />
                <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">No spending data available to visualize yet.</p>
                <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-1">Log some expenses to populate the monthly summary chart.</p>
              </div>
            ) : (
              <div className="h-[280px] w-full pr-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#27272a' : '#f4f4f5'} />
                    <XAxis 
                      dataKey="monthName" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#a1a1aa', fontWeight: 500 }}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 10, fill: '#a1a1aa', fontWeight: 500 }}
                      tickFormatter={(value) => `$${value}`}
                    />
                    <RechartsTooltip 
                      cursor={{ fill: theme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', radius: 12 }}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          const total = payload.reduce((sum: number, entry: any) => sum + (entry.value || 0), 0);
                          if (total === 0) return null;
                          return (
                            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-xl backdrop-blur-md z-50">
                              <p className="font-bold text-zinc-900 dark:text-white mb-2 text-xs font-display">{label}</p>
                              <div className="space-y-1.5 max-h-[160px] overflow-y-auto custom-scrollbar">
                                {payload.map((entry: any, index: number) => {
                                  if (!entry.value) return null;
                                  return (
                                    <p key={index} className="text-[10px] font-medium flex items-center gap-2">
                                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
                                      <span className="text-zinc-500 dark:text-zinc-400 truncate max-w-[120px]">{entry.name}:</span>
                                      <span className="font-mono font-bold text-zinc-900 dark:text-white">${entry.value.toFixed(2)}</span>
                                    </p>
                                  );
                                })}
                              </div>
                              <div className="border-t border-zinc-100 dark:border-zinc-800 mt-2 pt-2 flex items-center justify-between">
                                <span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300">Total:</span>
                                <span className="font-mono font-bold text-xs text-purple-600 dark:text-purple-400">
                                  ${total.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend 
                      verticalAlign="top" 
                      height={36} 
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 10, fontWeight: 500, paddingBottom: 10 }}
                    />
                    {groups.map((group, index) => {
                      const CHART_COLORS = ['#9333ea', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#14b8a6', '#a855f7', '#8b5cf6'];
                      return (
                        <Bar 
                          key={group.id} 
                          dataKey={group.name} 
                          stackId="a" 
                          fill={CHART_COLORS[index % CHART_COLORS.length]} 
                          radius={index === groups.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} 
                        />
                      );
                    })}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white font-display">Recent Activity</h2>
            </div>
            <div className="bg-white dark:bg-zinc-900 rounded-[32px] border border-zinc-200/80 dark:border-zinc-800 shadow-xl shadow-zinc-200/40 dark:shadow-black/20 overflow-hidden">
              {recentExpenses.length === 0 ? (
                <div className="p-16 text-center">
                  <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Receipt className="w-8 h-8 text-zinc-300 dark:text-zinc-600" />
                  </div>
                  <p className="text-zinc-500 dark:text-zinc-400 font-medium">No recent expenses found.</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {recentExpenses.map(expense => (
                    <div key={expense.id} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between transition-all group hover:bg-zinc-50 dark:hover:bg-zinc-800/50 gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 bg-purple-50 dark:bg-purple-500/10 rounded-2xl flex items-center justify-center text-purple-600 dark:text-purple-400 transition-all border border-purple-100 dark:border-purple-500/20 shrink-0">
                          <Receipt className="w-6 h-6 sm:w-7 sm:h-7" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-zinc-900 dark:text-white text-base sm:text-lg truncate">{expense.description}</p>
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1">
                            <span className="text-[9px] sm:text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider px-2 py-0.5 sm:px-2.5 sm:py-1 bg-purple-50 dark:bg-purple-500/10 rounded-lg border border-purple-100 dark:border-purple-500/20">{expense.category}</span>
                            <span className="text-[9px] sm:text-[10px] text-zinc-500 font-mono font-bold">
                              {expense.date.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                            <span className="text-[9px] sm:text-[10px] text-zinc-400 font-medium italic truncate max-w-[100px] sm:max-w-none">
                              in {groups.find(g => g.id === expense.groupId)?.name}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 border-t border-zinc-100 dark:border-zinc-800 sm:border-0 pt-3 sm:pt-0 shrink-0">
                        <div className="text-left sm:text-right min-w-0">
                          <p 
                            className={`text-lg sm:text-xl font-bold font-mono truncate ${expense.paidBy === user.uid ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-900 dark:text-white'}`}
                            title={`$${formatCurrency(expense.amount)}`}
                          >
                            ${formatCurrency(expense.amount)}
                          </p>
                          <p className="text-[9px] sm:text-[10px] text-zinc-500 uppercase tracking-widest font-bold mt-0.5">
                            {expense.paidBy === user.uid ? 'You paid' : 'Someone paid'}
                          </p>
                        </div>
                        {expense.paidBy === user.uid && (
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => setEditingExpense(expense)}
                              className="p-2 text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded-xl lg:opacity-0 group-hover:opacity-100 focus:opacity-100 focus:bg-purple-50 dark:focus:bg-purple-500/10 transition-all active:scale-90 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                              title="Edit Expense"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => setExpenseToDelete(expense)}
                              className="p-2 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl lg:opacity-0 group-hover:opacity-100 focus:opacity-100 focus:bg-rose-50 dark:focus:bg-rose-500/10 transition-all active:scale-90 outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
                              title="Delete Expense"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-12">
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white font-display">Budget Alerts</h2>
            </div>
            <div className="space-y-4">
              {alerts.length === 0 ? (
                <div className="p-10 bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 rounded-[32px] text-center shadow-xl shadow-zinc-200/40 dark:shadow-black/20">
                  <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-3">
                    <TrendingDown className="w-6 h-6 text-emerald-500" />
                  </div>
                  <p className="text-zinc-500 text-sm font-medium">All budgets on track</p>
                </div>
              ) : (
                alerts.map(alert => (
                  <motion.div 
                    key={alert.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`p-6 rounded-[32px] border shadow-md transition-all duration-300 ${
                      alert.type === 'warning' 
                        ? 'bg-rose-50 dark:bg-rose-950/80 border-rose-200 dark:border-rose-900/50 text-rose-900 dark:text-rose-100 backdrop-blur-sm' 
                        : 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/20'
                    }`}
                  >
                    <div className="flex gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        alert.type === 'warning' ? 'bg-rose-500/10 dark:bg-rose-500/20' : 'bg-white/20'
                      }`}>
                        <TrendingUp className={`w-5 h-5 ${alert.type === 'warning' ? 'text-rose-600 dark:text-rose-400' : 'text-white'}`} />
                      </div>
                      <p className="text-sm font-bold leading-relaxed">{alert.message}</p>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
        </>
      )}

      {/* Modals */}
      <AnimatePresence>
        {editingExpense && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setEditingExpense(null)}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-expense-title"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-2xl p-8 sm:p-10 outline-none z-10"
              tabIndex={-1}
            >
              <div className="flex items-center justify-between mb-8">
                <h3 id="edit-expense-title" className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white font-display">Edit Expense</h3>
                <button 
                  onClick={() => setEditingExpense(null)} 
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>
              
              <form onSubmit={handleUpdateExpense} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-[0.15em] mb-2 font-display">Amount</label>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 font-mono font-bold">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="w-full pl-10 pr-5 py-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all font-mono font-bold text-zinc-900 dark:text-white"
                      required
                      autoFocus
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-[0.15em] mb-2 font-display">Description</label>
                  <input
                    type="text"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all font-medium text-zinc-900 dark:text-white"
                    placeholder="What was this for?"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-[0.15em] mb-2 font-display">Category</label>
                    <select
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all font-medium appearance-none text-zinc-900 dark:text-white"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-[0.15em] mb-2 font-display">Date</label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all font-medium text-zinc-900 dark:text-white"
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-4 bg-purple-600 text-white rounded-2xl font-bold hover:bg-purple-700 transition-all mt-4 flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-purple-600/20 active:scale-95 cursor-pointer font-display"
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {expenseToDelete && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setExpenseToDelete(null)}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
            />
            <motion.div
              ref={deleteExpenseModalRef}
              tabIndex={-1}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="delete-expense-title"
              aria-describedby="delete-expense-desc"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] shadow-2xl p-8 sm:p-10 text-center outline-none z-10"
            >
              <div className="w-16 h-16 bg-rose-50 dark:bg-rose-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-rose-600 border border-rose-200 dark:border-rose-500/20">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 id="delete-expense-title" className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white mb-3 font-display">Delete Expense?</h3>
              <p id="delete-expense-desc" className="text-zinc-500 dark:text-zinc-400 mb-8 leading-relaxed text-sm">
                Are you sure you want to delete this expense? This action cannot be undone.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setExpenseToDelete(null)}
                  className="flex-1 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-2xl font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all active:scale-95 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteExpense}
                  disabled={isDeleting}
                  className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-bold hover:bg-rose-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-rose-500/20 active:scale-95 cursor-pointer"
                >
                  {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {quickAddOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setQuickAddOpen(false)}
              className="absolute inset-0 bg-zinc-950/60 backdrop-blur-sm"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="quick-add-expense-title"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] shadow-2xl p-8 sm:p-10 outline-none z-10"
              tabIndex={-1}
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-50 dark:bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-500/20">
                    <Plus className="w-5 h-5" />
                  </div>
                  <h3 id="quick-add-expense-title" className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white font-display">Quick Add Expense</h3>
                </div>
                <button 
                  onClick={() => setQuickAddOpen(false)} 
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>
              
              <form onSubmit={handleQuickAddExpense} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-[0.15em] mb-2 font-display">Select Group</label>
                  <select
                    value={quickGroupId}
                    onChange={(e) => setQuickGroupId(e.target.value)}
                    className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all font-medium appearance-none text-zinc-900 dark:text-white"
                    required
                  >
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-[0.15em] mb-2 font-display">Amount</label>
                  <div className="relative">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-400 font-mono font-bold">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={quickAmount}
                      onChange={(e) => setQuickAmount(e.target.value)}
                      className="w-full pl-10 pr-5 py-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all font-mono font-bold text-zinc-900 dark:text-white"
                      placeholder="0.00"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-[0.15em] mb-2 font-display">Description</label>
                  <input
                    type="text"
                    value={quickDescription}
                    onChange={(e) => setQuickDescription(e.target.value)}
                    className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all font-medium text-zinc-900 dark:text-white"
                    placeholder="What was this for?"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-[0.15em] mb-2 font-display">Category</label>
                    <select
                      value={quickCategory}
                      onChange={(e) => setQuickCategory(e.target.value)}
                      className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all font-medium appearance-none text-zinc-900 dark:text-white"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-[0.15em] mb-2 font-display">Date</label>
                    <input
                      type="date"
                      value={quickDate}
                      onChange={(e) => setQuickDate(e.target.value)}
                      className="w-full px-5 py-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all font-medium text-zinc-900 dark:text-white"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-4 bg-purple-600 text-white rounded-2xl font-bold hover:bg-purple-700 transition-all mt-4 flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-purple-600/20 active:scale-95 cursor-pointer font-display"
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Log Expense'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Quick Add FAB */}
      {groups.length > 0 && (
        <div className="fixed bottom-8 right-8 z-[50]">
          <button
            onClick={() => setQuickAddOpen(true)}
            className="flex items-center justify-center w-14 h-14 bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-full shadow-2xl shadow-purple-600/40 hover:scale-110 active:scale-95 transition-all group relative outline-none focus:ring-4 focus:ring-purple-500/40 cursor-pointer"
            title="Quick Add Expense"
          >
            <Plus className="w-7 h-7 transition-transform group-hover:rotate-90 duration-300" />
            <span className="absolute right-16 bg-zinc-900 text-white text-xs font-bold py-1.5 px-3 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl border border-zinc-800">
              Quick Add Expense
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
