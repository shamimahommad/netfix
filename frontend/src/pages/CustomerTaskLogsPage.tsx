import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { taskLogsService, TaskLog, TaskLogActionType, TaskLogsCheckResponse } from '@/services/task-logs.service';
import { useToastContext } from '@/contexts/ToastContext';
import { customersService } from '@/services/customers.service';

function BackIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

function ClockIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CreditCardIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
}

function ServerIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
    </svg>
  );
}

function StatusIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function UserIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function ChatBubbleIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function CogIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 2.31.826 1.37 1.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 2.31-1.37 1.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-2.31-.826-1.37-1.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-2.31 1.37-1.37.945.94 2.572 1.065 2.572 1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function DocumentTextIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

const ACTION_TYPE_CONFIG: Record<
  TaskLogActionType,
  { label: string; icon: React.ReactNode; bgClass: string; textClass: string }
> = {
  billing: {
    label: 'Billing',
    icon: <CreditCardIcon />,
    bgClass: 'bg-sky-100 dark:bg-sky-500/15',
    textClass: 'text-sky-700 dark:text-sky-300',
  },
  mikrotik: {
    label: 'MikroTik',
    icon: <ServerIcon />,
    bgClass: 'bg-teal-100 dark:bg-teal-500/15',
    textClass: 'text-teal-700 dark:text-teal-300',
  },
  status: {
    label: 'Status',
    icon: <StatusIcon />,
    bgClass: 'bg-sky-100 dark:bg-sky-500/15',
    textClass: 'text-sky-700 dark:text-sky-300',
  },
  profile: {
    label: 'Profile',
    icon: <UserIcon />,
    bgClass: 'bg-teal-100 dark:bg-teal-500/15',
    textClass: 'text-teal-700 dark:text-teal-300',
  },
  sms: {
    label: 'SMS',
    icon: <ChatBubbleIcon />,
    bgClass: 'bg-teal-100 dark:bg-teal-500/15',
    textClass: 'text-teal-700 dark:text-teal-300',
  },
  system: {
    label: 'System',
    icon: <CogIcon />,
    bgClass: 'bg-slate-100 dark:bg-slate-600/20',
    textClass: 'text-slate-600 dark:text-slate-400',
  },
};

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

function getActionTypeConfig(type: string) {
  const key = type as TaskLogActionType;
  return ACTION_TYPE_CONFIG[key] ?? {
    label: type,
    icon: <DocumentTextIcon />,
    bgClass: 'bg-slate-100 dark:bg-slate-600/20',
    textClass: 'text-slate-600 dark:text-slate-400',
  };
}

export default function CustomerTaskLogsPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const toast = useToastContext();
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [tableCheck, setTableCheck] = useState<TaskLogsCheckResponse | null>(null);

  const loadData = useCallback(() => {
    if (!customerId) return;
    setLoading(true);
    setTableCheck(null);
    Promise.all([
      taskLogsService.getByCustomerId(customerId),
      customersService.getCustomerDetail(customerId).catch(() => null),
      taskLogsService.check().catch(() => ({ success: false, tableExists: false, message: 'Check failed' })),
    ])
      .then(([data, detail, check]) => {
        setLogs(data);
        setTableCheck(check);
        if (detail?.data?.customer?.fullName) setCustomerName(detail.data.customer.fullName);
      })
      .catch((err) => {
        toast.error(err?.response?.data?.message || err?.message || 'Failed to load task logs');
        setLogs([]);
      })
      .finally(() => setLoading(false));
  }, [customerId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBack = () => {
    navigate(`/dashboard/customers/view/${customerId}`);
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-b from-sky-50/80 via-white to-teal-50/60 dark:from-slate-950 dark:via-slate-900 dark:to-sky-950/30 p-6 md:p-8">
      <div className="w-full max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-sky-700 dark:text-sky-300 bg-white dark:bg-slate-800/90 border border-sky-200/60 dark:border-sky-800/50 rounded-xl shadow-sm hover:bg-sky-50 dark:hover:bg-slate-800 hover:border-sky-300 dark:hover:border-sky-700 hover:shadow transition-all"
          >
            <BackIcon />
            Back to Customer
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Customer Task Logs
            </h1>
            {customerName && (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{customerName}</p>
            )}
          </div>
        </div>

        {/* Table card */}
        <div className="bg-white dark:bg-slate-900/70 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center gap-4 text-slate-500 dark:text-slate-400">
              <div className="w-10 h-10 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium">Loading task logs...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="p-16 flex flex-col items-center justify-center gap-4 text-slate-500 dark:text-slate-400">
              <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-500/10">
                <ClockIcon className="w-10 h-10 text-sky-400 dark:text-sky-500" />
              </div>
              <p className="text-sm font-medium">No task logs for this customer</p>
              {tableCheck && !tableCheck.tableExists && tableCheck.message ? (
                <div className="max-w-md rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 text-left">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2">Task log table is missing</p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">{tableCheck.message}</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    In your project folder, open a terminal and run: <code className="block mt-2 p-2 rounded bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-mono text-xs">cd backend && npm run migration:run</code>
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm text-center">
                  Renew, Cash Received, Sync, Suspend, Mark Left, Edit, etc. create logs here. Do an action from the customer view, then click Refresh below.
                </p>
              )}
              <button
                type="button"
                onClick={() => loadData()}
                className="mt-2 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 dark:bg-teal-600 dark:hover:bg-teal-500 text-white text-sm font-medium transition-colors"
              >
                Refresh
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700/80 bg-sky-50/50 dark:bg-sky-950/20">
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Action Type
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Action Title
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Action Details
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Performed By
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {logs.map((log) => {
                    const config = getActionTypeConfig(log.actionType);
                    return (
                      <tr
                        key={log.logId}
                        className="hover:bg-sky-50/30 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {formatTime(log.createdAt)}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${config.bgClass} ${config.textClass}`}
                          >
                            {config.icon}
                            {config.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-sm font-medium text-slate-900 dark:text-slate-100">
                          {log.actionTitle}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-500 dark:text-slate-400 max-w-xs truncate">
                          {log.actionDetails || '—'}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-600 dark:text-slate-300">
                          {log.performedByName}
                          {log.performedByRole ? (
                            <span className="text-slate-400 dark:text-slate-500 font-normal ml-1">
                              ({log.performedByRole})
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
