import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, Loader2, FileText, CheckCircle } from 'lucide-react';
import { useToastContext } from '@/contexts/ToastContext';
import { smsService } from '@/services/sms.service';
import { PageHeader } from '@/components/common';

type TabId = 'general' | 'ppp' | 'hotspot' | 'alert';

const TABS: { id: TabId; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'ppp', label: 'PPP Template' },
  { id: 'hotspot', label: 'Hotspot Template' },
  { id: 'alert', label: 'Alert Template' },
];

const PLACEHOLDERS = {
  generalOnline: ['ClientName', 'ClientUsername', 'Sender', 'Amount', 'Fee', 'TxnNo', 'BillRef', 'ACNumber', 'ISPNickName', 'ISPFullName', 'ISPSupportNumber'],
  generalCash: ['ClientName', 'ClientUsername', 'Balance', 'Amount', 'BillRef', 'ACNumber', 'ISPNickName', 'ISPFullName', 'ISPSupportNumber'],
  generalReseller: ['FromUser', 'ToUser', 'Amount', 'Description'],
  ppp: ['ClientName', 'ClientUsername', 'ClientPassword', 'MobileNumber', 'ClientExpireDate', 'PlanPrice', 'PlanName', 'BillAmount', 'Balance', 'InvoiceNumber', 'ACNumber', 'ISPNickName', 'ISPFullName', 'ISPSupportNumber'],
  hotspot: ['ClientName', 'ClientUsername', 'ClientPassword', 'MobileNumber', 'ClientExpireDate', 'BillAmount', 'Balance', 'InvoiceNumber', 'ACNumber', 'ISPNickName', 'ISPFullName', 'ISPSupportNumber'],
  alert: ['ClientName', 'ClientUsername', 'ClientPassword', 'MobileNumber', 'ClientExpireDate', 'BillAmount', 'MonthlyBillAmount', 'PlanName', 'RemainDays', 'Balance', 'DueBalance', 'InvoiceNumber', 'ACNumber', 'ISPNickName', 'ISPFullName', 'ISPSupportNumber'],
};

const defaultResellerBody = 'Dear {ToUser}, Your balance has been successfully refilled by {Amount} Tk. Sender: {FromUser}';
const defaultPppCreate = `Dear {ClientName},
Welcome to {ISPNickName} Wi-Fi Your username: {ClientUsername} and password: {ClientPassword}
Expire: {ClientExpireDate}`;
const defaultPppRenew = `Dear {ClientName},
Your internet connection has been activated. Thanks for being with us.
Expire: {ClientExpireDate}
- {ISPFullName}`;
const defaultExpireAlert = `Dear {ClientName},
Your Internet validity will be expired on {ClientExpireDate}. Please renew it to stay connected.
Thanks`;

export default function SmsTemplatePage() {
  const navigate = useNavigate();
  const toast = useToastContext();
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [general, setGeneral] = useState({
    onlineDeposit: { enabled: false, body: '' },
    cashDeposit: { enabled: false, body: '' },
    resellerCashDeposit: { enabled: true, body: defaultResellerBody },
  });
  const [ppp, setPpp] = useState({
    create: { enabled: true, body: defaultPppCreate },
    renew: { enabled: true, body: defaultPppRenew },
  });
  const [hotspot, setHotspot] = useState({
    create: { enabled: true, body: defaultPppCreate },
    renew: { enabled: true, body: defaultPppCreate },
  });
  const [alert, setAlert] = useState({
    hotspotAlert: false,
    pppAlert: true,
    alert1Days: 1,
    alert2Days: 3,
    expireAlert1: { enabled: true, body: defaultExpireAlert },
    expireAlert2: { enabled: true, body: defaultExpireAlert },
    afterExpire: { enabled: true, body: 'Dear {ClientName}.\nYour Internet validity will be expired. Please renew it to stay connected.\nThanks' },
  });

  useEffect(() => {
    let cancelled = false;
    smsService.getTemplates().then((t) => {
      if (cancelled) return;
      if (t.general_online_deposit) {
        setGeneral((g) => ({ ...g, onlineDeposit: { enabled: t.general_online_deposit.enabled, body: t.general_online_deposit.body || g.onlineDeposit.body } }));
      }
      if (t.general_cash_deposit) {
        setGeneral((g) => ({ ...g, cashDeposit: { enabled: t.general_cash_deposit.enabled, body: t.general_cash_deposit.body || g.cashDeposit.body } }));
      }
      if (t.general_reseller_cash_deposit) {
        setGeneral((g) => ({ ...g, resellerCashDeposit: { enabled: t.general_reseller_cash_deposit.enabled, body: t.general_reseller_cash_deposit.body || g.resellerCashDeposit.body } }));
      }
      if (t.ppp_create) setPpp((p) => ({ ...p, create: { enabled: t.ppp_create!.enabled, body: t.ppp_create!.body || p.create.body } }));
      if (t.ppp_renew) setPpp((p) => ({ ...p, renew: { enabled: t.ppp_renew!.enabled, body: t.ppp_renew!.body || p.renew.body } }));
      if (t.hotspot_create) setHotspot((h) => ({ ...h, create: { enabled: t.hotspot_create!.enabled, body: t.hotspot_create!.body || h.create.body } }));
      if (t.hotspot_renew) setHotspot((h) => ({ ...h, renew: { enabled: t.hotspot_renew!.enabled, body: t.hotspot_renew!.body || h.renew.body } }));
      if (t.alert_expire_1) setAlert((a) => ({ ...a, expireAlert1: { enabled: t.alert_expire_1!.enabled, body: t.alert_expire_1!.body || a.expireAlert1.body } }));
      if (t.alert_expire_2) setAlert((a) => ({ ...a, expireAlert2: { enabled: t.alert_expire_2!.enabled, body: t.alert_expire_2!.body || a.expireAlert2.body } }));
      if (t.alert_after_expire) setAlert((a) => ({ ...a, afterExpire: { enabled: t.alert_after_expire!.enabled, body: t.alert_after_expire!.body || a.afterExpire.body } }));
    }).catch(() => toast.error('Failed to load templates.')).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [toast]);

  const buildTemplatesPayload = () => ({
    general_online_deposit: general.onlineDeposit,
    general_cash_deposit: general.cashDeposit,
    general_reseller_cash_deposit: general.resellerCashDeposit,
    ppp_create: ppp.create,
    ppp_renew: ppp.renew,
    hotspot_create: hotspot.create,
    hotspot_renew: hotspot.renew,
    alert_expire_1: alert.expireAlert1,
    alert_expire_2: alert.expireAlert2,
    alert_after_expire: alert.afterExpire,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await smsService.saveTemplates(buildTemplatesPayload());
      toast.success('Templates saved successfully. Placeholders will be replaced automatically on dispatch.');
    } catch {
      toast.error('Failed to save templates.');
    } finally {
      setSaving(false);
    }
  };

  const renderPlaceholders = (list: string[], onInsert?: (p: string) => void) => (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {list.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onInsert?.(`{${p}}`)}
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium bg-slate-100 hover:bg-blue-50 dark:bg-slate-800 dark:hover:bg-blue-900/40 text-slate-700 hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-300 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
          title={`Click to copy or insert {${p}}`}
        >
          {`{${p}}`}
        </button>
      ))}
    </div>
  );

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
        checked ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );

  const SectionBlock = ({
    title,
    placeholders,
    enabled,
    onEnabledChange,
    body,
    onBodyChange,
    placeholder = 'Enter template message...',
    rows = 3,
  }: {
    title: string;
    placeholders: string[];
    enabled: boolean;
    onEnabledChange: (v: boolean) => void;
    body: string;
    onBodyChange: (v: string) => void;
    placeholder?: string;
    rows?: number;
  }) => (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">Enabled</span>
            <Toggle checked={enabled} onChange={onEnabledChange} />
          </div>
        </div>
        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-2 uppercase tracking-wider">
          Available Placeholders (Click to insert):
        </p>
        {renderPlaceholders(placeholders, (tag) => onBodyChange(body ? `${body} ${tag}` : tag))}
      </div>
      <div className="p-4 sm:p-5">
        <textarea
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className="w-full px-3.5 py-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-y"
        />
      </div>
    </div>
  );

  return (
    <div className="w-full min-w-0 max-w-5xl space-y-6">
      {/* Page Header */}
      <PageHeader
        icon={<FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        title="SMS Templates"
        subtitle="Manage automated SMS notifications for deposits, customer creations, renewals, and expiration alerts."
        onBack={() => navigate('/dashboard')}
        actions={
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold shadow-sm transition-all"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save All Changes
          </button>
        }
      />

      {loading ? (
        <div className="p-16 text-center bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading templates...</p>
        </div>
      ) : (
        <>
          {/* Tabs bar */}
          <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 w-fit">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Contents */}
          <div className="space-y-4">
            {activeTab === 'general' && (
              <>
                <SectionBlock
                  title="Online Deposit SMS"
                  placeholders={PLACEHOLDERS.generalOnline}
                  enabled={general.onlineDeposit.enabled}
                  onEnabledChange={(v) => setGeneral((g) => ({ ...g, onlineDeposit: { ...g.onlineDeposit, enabled: v } }))}
                  body={general.onlineDeposit.body}
                  onBodyChange={(b) => setGeneral((g) => ({ ...g, onlineDeposit: { ...g.onlineDeposit, body: b } }))}
                  placeholder="Dear {ClientName}, your online payment of {Amount} Tk has been received. Txn: {TxnNo}."
                />
                <SectionBlock
                  title="Cash Deposit SMS"
                  placeholders={PLACEHOLDERS.generalCash}
                  enabled={general.cashDeposit.enabled}
                  onEnabledChange={(v) => setGeneral((g) => ({ ...g, cashDeposit: { ...g.cashDeposit, enabled: v } }))}
                  body={general.cashDeposit.body}
                  onBodyChange={(b) => setGeneral((g) => ({ ...g, cashDeposit: { ...g.cashDeposit, body: b } }))}
                  placeholder="Dear {ClientName}, cash deposit of {Amount} Tk received. Current balance: {Balance} Tk."
                />
                <SectionBlock
                  title="Reseller Cash Deposit SMS"
                  placeholders={PLACEHOLDERS.generalReseller}
                  enabled={general.resellerCashDeposit.enabled}
                  onEnabledChange={(v) => setGeneral((g) => ({ ...g, resellerCashDeposit: { ...g.resellerCashDeposit, enabled: v } }))}
                  body={general.resellerCashDeposit.body}
                  onBodyChange={(b) => setGeneral((g) => ({ ...g, resellerCashDeposit: { ...g.resellerCashDeposit, body: b } }))}
                />
              </>
            )}

            {activeTab === 'ppp' && (
              <>
                <SectionBlock
                  title="PPP Account Creation SMS"
                  placeholders={PLACEHOLDERS.ppp}
                  enabled={ppp.create.enabled}
                  onEnabledChange={(v) => setPpp((p) => ({ ...p, create: { ...p.create, enabled: v } }))}
                  body={ppp.create.body}
                  onBodyChange={(b) => setPpp((p) => ({ ...p, create: { ...p.create, body: b } }))}
                  rows={4}
                />
                <SectionBlock
                  title="PPP Account Renewal SMS"
                  placeholders={PLACEHOLDERS.ppp}
                  enabled={ppp.renew.enabled}
                  onEnabledChange={(v) => setPpp((p) => ({ ...p, renew: { ...p.renew, enabled: v } }))}
                  body={ppp.renew.body}
                  onBodyChange={(b) => setPpp((p) => ({ ...p, renew: { ...p.renew, body: b } }))}
                  rows={4}
                />
              </>
            )}

            {activeTab === 'hotspot' && (
              <>
                <SectionBlock
                  title="Hotspot Account Creation SMS"
                  placeholders={PLACEHOLDERS.hotspot}
                  enabled={hotspot.create.enabled}
                  onEnabledChange={(v) => setHotspot((h) => ({ ...h, create: { ...h.create, enabled: v } }))}
                  body={hotspot.create.body}
                  onBodyChange={(b) => setHotspot((h) => ({ ...h, create: { ...h.create, body: b } }))}
                  rows={4}
                />
                <SectionBlock
                  title="Hotspot Account Renewal SMS"
                  placeholders={PLACEHOLDERS.hotspot}
                  enabled={hotspot.renew.enabled}
                  onEnabledChange={(v) => setHotspot((h) => ({ ...h, renew: { ...h.renew, enabled: v } }))}
                  body={hotspot.renew.body}
                  onBodyChange={(b) => setHotspot((h) => ({ ...h, renew: { ...h.renew, body: b } }))}
                  rows={4}
                />
              </>
            )}

            {activeTab === 'alert' && (
              <>
                <SectionBlock
                  title="Expiration Alert 1 (Prior Notice)"
                  placeholders={PLACEHOLDERS.alert}
                  enabled={alert.expireAlert1.enabled}
                  onEnabledChange={(v) => setAlert((a) => ({ ...a, expireAlert1: { ...a.expireAlert1, enabled: v } }))}
                  body={alert.expireAlert1.body}
                  onBodyChange={(b) => setAlert((a) => ({ ...a, expireAlert1: { ...a.expireAlert1, body: b } }))}
                  rows={4}
                />
                <SectionBlock
                  title="Expiration Alert 2 (Final Notice)"
                  placeholders={PLACEHOLDERS.alert}
                  enabled={alert.expireAlert2.enabled}
                  onEnabledChange={(v) => setAlert((a) => ({ ...a, expireAlert2: { ...a.expireAlert2, enabled: v } }))}
                  body={alert.expireAlert2.body}
                  onBodyChange={(b) => setAlert((a) => ({ ...a, expireAlert2: { ...a.expireAlert2, body: b } }))}
                  rows={4}
                />
                <SectionBlock
                  title="After Expiration Notice"
                  placeholders={PLACEHOLDERS.alert}
                  enabled={alert.afterExpire.enabled}
                  onEnabledChange={(v) => setAlert((a) => ({ ...a, afterExpire: { ...a.afterExpire, enabled: v } }))}
                  body={alert.afterExpire.body}
                  onBodyChange={(b) => setAlert((a) => ({ ...a, afterExpire: { ...a.afterExpire, body: b } }))}
                  rows={4}
                />
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
