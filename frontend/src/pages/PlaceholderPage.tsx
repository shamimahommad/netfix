import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/common';

interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export default function PlaceholderPage({ title, description = 'This feature module is currently under development.' }: PlaceholderPageProps) {
  const navigate = useNavigate();

  return (
    <div className="w-full min-w-0 space-y-6">
      <PageHeader
        icon={<Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        title={title}
        subtitle={description}
        onBack={() => navigate('/dashboard')}
      />

      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-12 text-center shadow-sm">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mb-4">
          <Sparkles className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
          {title} Module
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
          {description}
        </p>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition-colors"
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  );
}
