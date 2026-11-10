# NetFix ISP SaaS - Project Guidelines & Frontend Design System

This file serves as the permanent source of truth for all coding and UI design standards in the NetFix codebase. Every new page, modal, and component must strictly follow these rules to maintain 100% design uniformity.

---

## 1. Page Container & Layout Uniformity
- **Root Page Wrapper**: Every page component MUST start with:
  ```tsx
  <div className="w-full min-w-0 space-y-6">
  ```
- **NO Arbitrary Width Constraints**: Never use `max-w-5xl`, `max-w-4xl`, or `mx-auto` on the page container. All dashboard pages must span the standard full layout width so they look completely identical in scale and padding.
- **Header Component**: Always use the unified `PageHeader` component:
  ```tsx
  import PageHeader from '@/components/common/PageHeader';

  <PageHeader
    icon={<IconComponent className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
    title="Page Title"
    subtitle="Short descriptive subtitle explaining what the page does"
    badge="Optional Badge"
    actions={
      <div className="flex items-center gap-2.5">
        {/* Action buttons */}
      </div>
    }
  />
  ```

---

## 2. Card & Section Styling
- **Card Wrapper**:
  ```tsx
  <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
  ```
- **Card Section Header**:
  ```tsx
  <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
      <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
      Section Title
    </h2>
    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
      Section description
    </p>
  </div>
  ```

---

## 3. Form Controls & Inputs
- **Labels**:
  ```tsx
  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
    Field Label
  </label>
  ```
- **Text / Number / Email Inputs**:
  ```tsx
  <input
    type="text"
    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
  />
  ```
- **Input with Left Icon**:
  ```tsx
  <div className="relative">
    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
      <Mail className="w-4 h-4" />
    </span>
    <input
      type="email"
      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
    />
  </div>
  ```
- **Helper Text**:
  ```tsx
  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
    Helper note text
  </p>
  ```
- **Disabled / Read-Only Inputs**:
  ```tsx
  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100/70 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 cursor-not-allowed font-medium text-sm"
  ```

---

## 4. Button Standards
- **Primary Button (Save, Submit, Add)**:
  ```tsx
  <button
    type="submit"
    disabled={loading}
    className="inline-flex items-center gap-2 px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm transition-all active:scale-95 disabled:opacity-50"
  >
    <Save className="w-4 h-4" />
    <span>Save</span>
  </button>
  ```
- **Secondary / Cancel / Reset Button**:
  ```tsx
  <button
    type="button"
    className="px-4 py-2 rounded-xl text-sm font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors disabled:opacity-50"
  >
    Cancel
  </button>
  ```

---

## 5. Feedback, Toasts & Language Rules
- **Global Toast Notification**: Always use `useToastContext` for user feedback:
  ```tsx
  import { useToastContext } from '@/contexts/ToastContext';
  const toast = useToastContext();
  toast.success('Successfully saved');
  toast.error('Operation failed');
  ```
- **Zero Conversational Notes in UI**: NEVER put conversational commentary, chat remarks, or subjective instructions in UI banners or cards. The UI must remain 100% clean, professional, and consistent with the standard English SaaS design language.

---

## 6. Icons & Dependencies
- Use `lucide-react` for all page and modal icons.
- Checkboxes: Use `@/components/common/ModernCheckbox` for all selection checkboxes.
- Loading states: Use circular animated spinners `w-8 h-8 rounded-full border-2 border-slate-200 border-t-blue-600 animate-spin`.

