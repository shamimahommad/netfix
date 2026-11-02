import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { customerPortalService } from '@/services/customer-portal.service';
import { Loader2 } from 'lucide-react';

export default function CustomerPaymentCallbackPage() {
  const [searchParams] = useSearchParams();
  const status = searchParams.get('status') || '';
  // bKash may send paymentID or payment_id
  const paymentID = searchParams.get('paymentID') || searchParams.get('payment_id') || '';
  const [confirming, setConfirming] = useState(false);
  const [confirmDone, setConfirmDone] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const hasAttempted = useRef(false);
  const retryCountRef = useRef(0);

  const isSuccess = status === 'success';
  const isCancel = status === 'cancel';

  const confirmPayment = useCallback(async () => {
    setConfirming(true);
    setConfirmError(null);
    try {
      await customerPortalService.confirmPayment(paymentID);
      setConfirmDone(true);
    } catch (err: any) {
      const data = err?.response?.data ?? err;
      const msg =
        typeof data?.message === 'string'
          ? data.message
          : Array.isArray(data?.message)
            ? data.message[0]
            : data?.message;
      const displayMsg = msg || data?.error || 'Could not confirm payment. Please contact support.';
      const isSigV4 =
        /Credential|Signature|SignedHeaders|X-Amz-Date/i.test(displayMsg);
      if (isSigV4 && retryCountRef.current < 3) {
        retryCountRef.current += 1;
        setConfirmError('Payment is being verified. Please wait…');
        setTimeout(() => {
          confirmPayment();
        }, 4000);
      } else {
        setConfirmError(displayMsg);
        console.error('[confirm-payment]', data?.statusCode, displayMsg, data);
      }
    } finally {
      setConfirming(false);
    }
  }, [paymentID]);

  useEffect(() => {
    if (!isSuccess || !paymentID || confirmDone || hasAttempted.current) return;
    hasAttempted.current = true;
    confirmPayment();
  }, [isSuccess, paymentID, confirmDone, confirmPayment]);

  const customerPortalUrl = '/customer/dashboard';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8 max-w-md w-full text-center">
        {confirming && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Confirming payment…</h1>
            <p className="text-slate-600 dark:text-slate-400 mb-6">Please wait while we update your balance.</p>
          </>
        )}
        {!confirming && isSuccess && (confirmDone || !paymentID) && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Payment successful</h1>
            <p className="text-slate-600 dark:text-slate-400 mb-6">Your payment has been processed and your balance has been updated.</p>
          </>
        )}
        {!confirming && confirmError && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Confirmation issue</h1>
            <p className="text-slate-600 dark:text-slate-400 mb-6">{confirmError}</p>
          </>
        )}
        {isCancel && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Payment cancelled</h1>
            <p className="text-slate-600 dark:text-slate-400 mb-6">You cancelled the payment.</p>
          </>
        )}
        {!isSuccess && !isCancel && !confirming && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Payment failed</h1>
            <p className="text-slate-600 dark:text-slate-400 mb-6">The payment could not be completed.</p>
          </>
        )}
        {!confirming && (
          <Link
            to={customerPortalUrl}
            className="inline-flex items-center px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-all shadow-sm hover:shadow"
          >
            {(isSuccess && (confirmDone || !paymentID)) ? 'Go to Customer Portal' : 'Try again'}
          </Link>
        )}
      </div>
    </div>
  );
}
