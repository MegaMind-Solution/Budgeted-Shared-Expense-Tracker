import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Users, Home, Plane, Briefcase } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';
import { GroupType, BudgetType } from '../types';
import { handleFirestoreError, OperationType } from '../utils/errorHandling';
import { saveLocalGroup } from '../utils/localDb';
import { WORLD_CURRENCIES, getCurrencySymbol } from '../utils/currencies';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
}

export default function CreateGroupModal({ isOpen, onClose, user }: CreateGroupModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<GroupType>('household');
  const [currency, setCurrency] = useState('USD');
  const [maxBudget, setMaxBudget] = useState('');
  const [budgetType, setBudgetType] = useState<BudgetType>('monthly');
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (user.uid === 'local_guest') {
        const groupData: any = {
          name: name.trim(),
          description: description.trim(),
          type,
          currency,
          createdBy: user.uid,
          memberIds: [user.uid],
        };

        if (maxBudget && !isNaN(parseFloat(maxBudget))) {
          groupData.maxBudget = parseFloat(maxBudget);
          groupData.budgetType = budgetType;
        }

        saveLocalGroup(groupData);
      } else {
        // 1. Create the group
        const groupData: any = {
          name: name.trim(),
          description: description.trim(),
          type,
          currency,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          memberIds: [user.uid],
        };

        if (maxBudget && !isNaN(parseFloat(maxBudget))) {
          groupData.maxBudget = parseFloat(maxBudget);
          groupData.budgetType = budgetType;
        }

        const groupRef = await addDoc(collection(db, 'groups'), groupData);
        console.log(`Group created successfully with ID: ${groupRef.id}`);

        // 2. Add the creator as an admin member
        await setDoc(doc(db, 'groups', groupRef.id, 'members', user.uid), {
          uid: user.uid,
          role: 'admin',
          joinedAt: serverTimestamp(),
          displayName: user.displayName,
          email: user.email,
        });
      }

      onClose();
      setName('');
      setDescription('');
      setType('household');
      setMaxBudget('');
      setBudgetType('monthly');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'groups');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            className="relative w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[32px] shadow-2xl overflow-y-auto max-h-[90vh] outline-none"
            tabIndex={-1}
          >
            <div className="p-8 sm:p-10">
              <div className="flex items-center justify-between mb-8">
                <h2 id="modal-title" className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-white font-display">Create New Group</h2>
                <button 
                  onClick={onClose} 
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                  aria-label="Close modal"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
                <div>
                  <label htmlFor="group-name" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2 sm:mb-3 font-display">Group Name</label>
                  <input
                    id="group-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Summer Trip 2024, Roommates"
                    className="w-full px-5 py-3.5 sm:py-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all font-medium text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label htmlFor="group-desc" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2 sm:mb-3 font-display">Description (Optional)</label>
                  <textarea
                    id="group-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What is this group for?"
                    className="w-full px-5 py-3.5 sm:py-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all resize-none h-24 sm:h-28 font-medium text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-3 sm:mb-4 font-display">Group Type</label>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    {[
                      { id: 'household', label: 'Household', icon: Home, activeClass: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-400 shadow-lg shadow-emerald-500/10', iconActive: 'text-emerald-600 dark:text-emerald-400' },
                      { id: 'trip', label: 'Trip', icon: Plane, activeClass: 'bg-amber-50 dark:bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-400 shadow-lg shadow-amber-500/10', iconActive: 'text-amber-600 dark:text-amber-400' },
                      { id: 'personal', label: 'Personal', icon: Users, activeClass: 'bg-blue-50 dark:bg-blue-500/10 border-blue-500 text-blue-700 dark:text-blue-400 shadow-lg shadow-blue-500/10', iconActive: 'text-blue-600 dark:text-blue-400' },
                      { id: 'other', label: 'Other', icon: Briefcase, activeClass: 'bg-purple-50 dark:bg-purple-500/10 border-purple-500 text-purple-700 dark:text-purple-400 shadow-lg shadow-purple-500/10', iconActive: 'text-purple-600 dark:text-purple-400' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setType(item.id as GroupType)}
                        className={`flex items-center gap-3 p-3.5 sm:p-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer outline-none focus:ring-2 focus:ring-purple-500 ${
                          type === item.id
                            ? item.activeClass
                            : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-700'
                        }`}
                      >
                        <item.icon className={`w-5 h-5 ${type === item.id ? item.iconActive : 'text-zinc-400 dark:text-zinc-600'}`} />
                        <span className="font-bold text-sm">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="group-currency" className="block text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mb-2 sm:mb-3 font-display">Group Currency</label>
                  <select
                    id="group-currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-5 py-3.5 sm:py-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all font-bold text-zinc-900 dark:text-white"
                  >
                    {WORLD_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} ({c.symbol}) - {c.name} - {c.country}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="pt-6 sm:pt-8 border-t border-zinc-100 dark:border-zinc-800">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-4 sm:mb-6 font-display">Budget Settings (Optional)</h3>
                  <div className="grid grid-cols-2 gap-4 sm:gap-6">
                    <div>
                      <label htmlFor="max-budget" className="block text-[10px] font-bold text-zinc-500 mb-2 sm:mb-3 uppercase tracking-wider font-display">Max Budget</label>
                      <div className="relative">
                        <span className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-600 font-bold">{getCurrencySymbol(currency)}</span>
                        <input
                          id="max-budget"
                          type="number"
                          step="0.01"
                          value={maxBudget}
                          onChange={(e) => setMaxBudget(e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-9 sm:pl-10 pr-4 sm:pr-5 py-3.5 sm:py-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all font-mono font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="budget-freq" className="block text-[10px] font-bold text-zinc-500 mb-2 sm:mb-3 uppercase tracking-wider font-display">Frequency</label>
                       <select
                        id="budget-freq"
                        value={budgetType}
                        onChange={(e) => setBudgetType(e.target.value as BudgetType)}
                        className="w-full px-4 sm:px-5 py-3.5 sm:py-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 transition-all appearance-none font-bold text-zinc-900 dark:text-white"
                      >
                        <option value="weekly">Per Week</option>
                        <option value="monthly">Per Month</option>
                        <option value="total">Total</option>
                      </select>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 sm:py-5 bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-2xl font-bold hover:from-purple-700 hover:to-violet-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4 shadow-xl shadow-purple-600/25 active:scale-[0.98] outline-none focus:ring-4 focus:ring-purple-500/40 cursor-pointer font-display"
                >
                  {isSubmitting ? 'Creating...' : 'Create Group'}
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
