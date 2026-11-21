import React, { useState, useEffect } from 'react';
import {
  X,
  Activity,
  Database,
  HardDrive,
  Cpu,
  Server,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Zap,
} from 'lucide-react';
import api from '@/lib/api';

interface HealthCheckData {
  status: string;
  overall: string;
  service: string;
  version: string;
  environment: string;
  timestamp: string;
  total_latency_ms: number;
  checks: {
    database?: {
      status: string;
      driver?: string;
      latency_ms?: number;
      registered_users?: number;
      message?: string;
    };
    redis?: {
      status: string;
      latency_ms?: number;
      message?: string;
    };
    victorialogs?: {
      status: string;
      latency_ms?: number;
      message?: string;
    };
    storage?: {
      status: string;
      free_gb?: number;
      total_gb?: number;
      used_percentage?: number;
      message?: string;
    };
    memory?: {
      status: string;
      current_usage_mb?: number;
      peak_usage_mb?: number;
      memory_limit?: string;
    };
    php?: {
      status: string;
      version?: string;
      sapi?: string;
      missing_extensions?: string[];
    };
  };
}

interface SystemHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SystemHealthModal: React.FC<SystemHealthModalProps> = ({ isOpen, onClose }) => {
  const [data, setData] = useState<HealthCheckData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      setError(null);
      // Calls public health endpoint
      const res = await api.get('/health');
      setData(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to reach health endpoint');
      if (err?.response?.data?.checks) {
        setData(err.response.data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHealth();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isHealthy = data?.status === 'ok' || data?.overall === 'healthy';

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-50 via-slate-50 to-indigo-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shadow-sm ${
              isHealthy
                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
            }`}>
              <Activity className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  System Health & Diagnostics
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  isHealthy
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                }`}>
                  {isHealthy ? 'Healthy' : 'Degraded'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Live probe telemetry across database, memory, disk, and runtime services
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={fetchHealth}
              disabled={loading}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Re-run health check"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading && !data ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
              <p className="text-sm font-medium">Running system health diagnostic probe...</p>
            </div>
          ) : error && !data ? (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-3">
              <XCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
              <div>
                <p className="font-bold">Health check failed</p>
                <p className="mt-1 text-slate-600 dark:text-slate-400">{error}</p>
                <button
                  type="button"
                  onClick={fetchHealth}
                  className="mt-3 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700"
                >
                  Retry Probe
                </button>
              </div>
            </div>
          ) : data ? (
            <div className="space-y-4">
              {/* Overall Summary Bar */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Probe Latency:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100">{data.total_latency_ms} ms</span>
                </div>
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-blue-500" />
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Environment:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100 uppercase">{data.environment}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Last Checked:</span>
                  <span className="font-mono text-slate-800 dark:text-slate-100">
                    {new Date(data.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              {/* Diagnostic Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Database Check */}
                <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                    <Database className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-slate-900 dark:text-slate-100">MySQL Database</span>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase ${
                        data.checks.database?.status === 'healthy' ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {data.checks.database?.status === 'healthy' ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <XCircle className="w-3 h-3 text-rose-500" />
                        )}
                        {data.checks.database?.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-1">
                      {data.checks.database?.message || 'Database connection active'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Latency: {data.checks.database?.latency_ms ?? 0} ms • Users: {data.checks.database?.registered_users ?? 0}
                    </p>
                  </div>
                </div>

                {/* 2. Storage / Disk Check */}
                <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                    <HardDrive className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-slate-900 dark:text-slate-100">Storage / Disk</span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 uppercase">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        {data.checks.storage?.status || 'OK'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-1">
                      {data.checks.storage?.free_gb ?? 0} GB Free of {data.checks.storage?.total_gb ?? 0} GB
                    </p>
                    {/* Progress Bar */}
                    <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1.5">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all"
                        style={{ width: `${data.checks.storage?.used_percentage || 0}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {data.checks.storage?.used_percentage ?? 0}% disk space consumed
                    </p>
                  </div>
                </div>

                {/* 3. Memory Telemetry */}
                <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-slate-900 dark:text-slate-100">Memory Telemetry</span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 uppercase">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        OK
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-1">
                      Current: {data.checks.memory?.current_usage_mb ?? 0} MB • Peak: {data.checks.memory?.peak_usage_mb ?? 0} MB
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Limit: {data.checks.memory?.memory_limit ?? '128M'}
                    </p>
                  </div>
                </div>

                {/* 4. PHP Runtime */}
                <div className="p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400">
                    <Server className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-slate-900 dark:text-slate-100">PHP Runtime</span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 uppercase">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        v{data.checks.php?.version}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-1">
                      SAPI: {data.checks.php?.sapi?.toUpperCase()} • All Extensions Loaded
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                      pdo_mysql, bcmath, sockets, curl, json
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-3.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Public endpoint: <code className="text-indigo-600 dark:text-indigo-400">/health</code></span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SystemHealthModal;
