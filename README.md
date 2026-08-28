# Budgeted - Shared Expense Tracker

A collaborative budget and expense tracker designed for households, trips, and personal use. Split bills easily, track spending by category, analyze historical habits, and simplify group debts seamlessly.

---

## Key Features

### 📊 Comprehensive Analytics & Financial Insights Engine
- **Interactive 6-Month Visualization**: Recharts-powered stacked bar chart on the dashboard displaying monthly group expense breakdowns.
- **Category Spending Distribution**: Interactive pie chart displaying spending distribution across categories with percentage values and hover tooltips.
- **Automated Financial Insights**: Deterministic insights engine highlighting Month-over-Month spending shifts, top categories, average daily spending, and largest single purchases.
- **Recent Activity Widget**: Displays the 5 latest transactions across all active groups with direct edit, duplicate, and delete controls.

### ⚖️ Advanced Expense Splitting & Debt Simplification
- **Flexible Splitting Methods**: Supports Equal, Custom Exact Amount, Percentage, and Share-Based expense splitting.
- **Zero-Drift Cent Reconciliation**: Integer minor unit calculations (`moneyUtils.ts`) ensuring participant shares sum exactly to expense totals down to the cent.
- **Greedy Debt Simplification**: Graph algorithm (`settlementEngine.ts`) minimizing the number of transfers required to settle all debts in a group.
- **Interactive Settlements**: Single-click debt recording with persistent settlement history tracking.

### ⏱️ Recurring Expenses & Customizable Categories
- **Idempotent Recurring Rules**: Automated processing for Daily, Weekly, Monthly, and Yearly recurring expenses with start/end date bounds and duplicate prevention.
- **Custom Category Management**: Create, rename, archive, and restore custom expense categories with custom icons and duplicate name safeguards.

### 🎯 Group Budgeting & Overspending Alerts
- **Configurable Period Budgets**: Set weekly, monthly, or total budgets for groups.
- **Utilization & Remaining Balances**: Live progress bars displaying remaining budget, utilization percentages, and overspending indicators.

### 🔍 Global Search & Multi-Criteria Filtering
- **Multi-Field Search**: Real-time search across memos, notes, categories, group names, payer names, and amounts.
- **Composable Filtering**: Filter expenses by group, category, payer, date range, and amount ranges simultaneously.

### 🛠️ Quick Tools Speed Dial & Actions
- **Floating Speed Dial (FAB)**: Rapid access to Add Expense, Create Group, Export CSV, and Search & Filter.
- **Undo Delete & Duplicate**: One-click transaction duplication and floating Undo toast notification for deleted expenses.

### 💾 Import, Export & Account Sync
- **Multi-Scope CSV Export & CSV Import**: Import expense spreadsheets with header validation and export sanitized CSVs.
- **Versioned JSON Backup & Restore**: Full database backup and restore with schema validation and reference integrity checks.
- **Guest Mode to Firebase Migration**: Idempotent data migration tool transferring local guest data to an authenticated Firebase account.

### 👤 Hybrid Authentication & Guest Mode
- **Google OAuth & Firestore Sync**: Cloud persistence, multi-user real-time sync, and Firestore Security Rules.
- **Isolated Offline Guest Mode**: Full-featured local operation powered by Local Storage (`/src/utils/localDb.ts`) without requiring an account.

---

## Technical Stack & Architecture

- **Frontend Core**: React 18+ with TypeScript
- **Bundler & Dev Server**: Vite
- **Styling**: Tailwind CSS with custom smooth typography and dark/light theme support
- **Motion & Transitions**: `motion/react` for micro-interactions and modal animations
- **Data Visualizations**: Recharts for responsive bar and pie charts
- **Core Utility Services**:
  - `/src/utils/moneyUtils.ts` - Safe cent-based financial arithmetic & reconciliation
  - `/src/utils/splitEngine.ts` - Equal, exact, percentage, and share splitting
  - `/src/utils/settlementEngine.ts` - Debt simplification and settlement tracking
  - `/src/utils/categoryService.ts` - Custom category lifecycle management
  - `/src/utils/recurringService.ts` - Idempotent recurring expense rule engine
  - `/src/utils/budgetService.ts` - Group and category budget utilization
  - `/src/utils/analyticsService.ts` - Financial analytics & metrics calculations
  - `/src/utils/insightsEngine.ts` - Fact-based automated insight generation
  - `/src/utils/searchAndFilterService.ts` - Multi-criteria search and filter engine
  - `/src/utils/exportImportService.ts` - Backup, CSV import/export, and account migration
- **Database / Sync**: Firebase Firestore (when authenticated) and isolated Local Storage emulation for Guest Mode.

