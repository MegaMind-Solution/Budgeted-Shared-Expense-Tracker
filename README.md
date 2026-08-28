# Budgeted - Shared Expense Tracker

A collaborative budget and expense tracker designed for households, trips, and personal use. Split bills easily, track spending by category, and analyze historical habits seamlessly.

## Key Features

### 📊 Monthly Summary Trends
- **Interactive 6-Month Visualization**: An elegantly rendered Recharts-powered stacked bar chart on the dashboard displaying monthly group expense breakdowns.
- **Dynamic Tooltips**: Hover to reveal itemized spending per active group alongside the collective month-over-month total.
- **Theme-Adaptive Grid**: Fluid light/dark responsive chart borders matching your current preference.

### ⚡ Quick Add FAB & Floating Actions
- **Floating Action Button (FAB)**: Accessible from anywhere on the main dashboard for rapid, immediate expense logging.
- **Simplified Modal Entry**: Choose the targeted group, input the price amount, log a descriptive memo, choose categories, and submit immediately without deep navigation.

### 📤 Multi-Scope CSV Export
- **Dashboard Global Export**: Consolidates and compiles all recent expenses from all active groups into a perfectly structured spreadsheet for personal archival.
- **Localized Group Export**: Located in the top bar of each Group View for downloading targeted, group-level expense databases.
- **Fully Sanitized Format**: Automatically escapes double-quotes and wraps values containing commas to preserve formatting.

### 🔍 Intuitive Group Search & Filtering
- **Dynamic Filter Input**: Instantly narrow down your list of groups by typing names, descriptions, or specific structural types (`trip`, `personal`, `household`).
- **Responsive Empty State**: Displays helpful system suggestions when no matching categories or groups are found.

### 👤 Hybrid Authentication & Guest Mode
- **Google OAuth Integration**: Connect your Google Account for real-time Firestore database persistence, multi-user sync, and active budget tracking.
- **Complete Offline Guest Experience**: Continue securely as a guest using an advanced client-side key-value Local Storage solution with identical styling.

---

## Technical Stack & Configuration

- **Frontend Core**: React 18+ with TypeScript
- **Bundler & Dev Server**: Vite
- **Styling**: Tailwind CSS with custom smooth scrollbars and modern fluid layouts
- **Motion & Transitions**: `motion/react` for elegant micro-interactions, modal backdrops, and active-button scaling
- **Data Visualizations**: Recharts for responsive, fully scalable vector chart components
- **Database / Sync**: Firebase Firestore (when authenticated) alongside an isolated Local Storage emulator (`/src/utils/localDb.ts`) for seamless guest operations.
