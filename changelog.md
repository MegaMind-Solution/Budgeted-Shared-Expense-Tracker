# Changelog

All notable changes to the Budgeted application will be documented in this file.

## [1.4.0] - Business Logic, Expense Splitting, Debt Simplification & Data Engines

### Added
- **Money & Cent Reconciliation Engine (`moneyUtils.ts`)**: Built integer minor unit conversions (cents) with safe floating-point arithmetic and zero-drift cent distribution math.
- **Advanced Expense Splitting (`splitEngine.ts`)**: Supported equal, exact custom amount, percentage, and share-based expense splitting with exact cent reconciliation.
- **Debt Simplification & Settlements (`settlementEngine.ts`)**: Integrated greedy graph debt simplification solver that minimizes required transfers between group members with interactive "Settle Debt" execution and settlement history.
- **Custom Categories Service (`categoryService.ts`)**: Built custom category management with active/archived state tracking, stable IDs, description, icon pairing, and duplicate name prevention.
- **Recurring Expense Processing (`recurringService.ts`)**: Implemented idempotent rule engine supporting daily, weekly, monthly, and yearly recurring expenses with automated next-occurrence calculation.
- **Budgeting & Overspending Detection (`budgetService.ts`)**: Added group and category budget tracking with utilization percentage, remaining balance, and overspending alert badges.
- **Analytics & Deterministic Insights Engine (`analyticsService.ts`, `insightsEngine.ts`)**: Generated factual spending trends, Month-over-Month percentage shifts, average daily spending, top categories, and single largest expense insights.
- **Search & Filter Engine (`searchAndFilterService.ts`)**: Composed multi-criteria search filtering across description, category, payer, amount ranges, dates, and group names.
- **Export & Import Backup Engine (`exportImportService.ts`)**: Implemented versioned JSON backup & restore with schema validation, CSV expense import parsing with validation preview, and Guest Mode -> Auth Firebase migration.
- **Duplicate & Undo Delete Actions**: Added one-click expense duplication and floating Undo toast notification for deleted transactions.
- **Hardened Security Rules (`firestore.rules`)**: Extended Master Gate security rules for settlements, recurring expense rules, and group member role permissions (`owner`, `admin`, `member`).

## [1.3.0] - Dashboard Widgets, Global Search & Quick Tools

### Added
- **Recent Activity Widget**: Displays the 5 most recent transactions added across all user groups with group badge, category indicator, and direct edit/delete capabilities.
- **Global Search Engine**: Expanded the main content search bar to filter both groups AND individual expenses by description, category, paid-by user, group name, or amount.
- **Recharts Spending Distribution Pie Chart**: Integrated a category breakdown pie chart with interactive hover tooltips, category legends, and percentage values.
- **Speed Dial FAB Quick Tools Button**: Upgraded the floating action button to an expandable Quick Tools menu providing quick access to Add Expense, Create Group, Export CSV, and Search & Filter.

## [1.2.0] - UI & Layout Redesign

### Added
- **Purple Primary Design System**: Integrated rich purple (`purple-600`) as the core primary theme color across both light and dark modes.
- **Search & Filter Bar**: Filter groups directly by name or type with instantaneous client-side feedback.
- **Quick Add Floating Action Button**: Accessible FAB on the dashboard allowing immediate expense logging without navigating into individual groups.
- **CSV Data Export**: Export active group expenses or all account transactions into downloadable `.csv` spreadsheets.
- **Monthly Spending Trends Chart**: Visualized spending trends over 6 months on the dashboard and group views using custom-themed Recharts.
- **Plus Jakarta Sans Typography**: Loaded Plus Jakarta Sans for display headers and controls alongside clean, readable body typography.

### Changed
- **Neutral Palette Refinement**: Standardized layout surfaces to clean `zinc` neutrals for high contrast, completely eliminating slate tones.
- **Modernized Component Cards**: Redesigned all metrics cards, group cards, and modals with soft rounded corners (`rounded-[32px]`, `rounded-[40px]`), refined borders, and gentle ambient shadows.
- **Group Details View**: Updated transaction lists, category distribution charts, settings modals, and member invite dialogs to match the primary purple design language.
