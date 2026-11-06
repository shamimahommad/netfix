import { useState, useEffect, useRef, useCallback } from 'react';
import { customersService } from '@/services/customers.service';

interface UseCustomerIdReservationOptions {
  autoReserve?: boolean;
}

export function useCustomerIdReservation(options: UseCustomerIdReservationOptions = { autoReserve: true }) {
  const [reservedCode, setReservedCode] = useState<string>('');
  const [leaseToken, setLeaseToken] = useState<string>('');
  const [expiresIn, setExpiresIn] = useState<number>(900); // 15 mins default
  const [isReserving, setIsReserving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Keep track of the active lease in a ref so event listeners and cleanup always read latest values
  const leaseRef = useRef<{
    code: string;
    token: string;
    isCommitted: boolean;
  }>({
    code: '',
    token: '',
    isCommitted: false,
  });

  // Unique session token per tab/flow instance to prevent collision or multiple reservations by same tab
  const sessionTokenRef = useRef<string>(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'tab_' + Math.random().toString(36).slice(2, 11) + '_' + Date.now()
  );

  /**
   * Release the reserved ID back to the free pool immediately
   */
  const releaseReservation = useCallback(() => {
    const { code, token, isCommitted } = leaseRef.current;
    if (isCommitted || !code || !token) return;

    // Immediately mark as committed locally so duplicate release calls don't fire
    leaseRef.current.isCommitted = true;

    const payload = JSON.stringify({
      customer_code: code,
      lease_token: token,
    });

    // 1. Try navigator.sendBeacon first (ideal for tab close / page navigation)
    let beaconSent = false;
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([payload], { type: 'application/json' });
        beaconSent = navigator.sendBeacon('/api/customers/release-id', blob);
      }
    } catch {
      beaconSent = false;
    }

    // 2. Fallback to keepalive fetch
    if (!beaconSent) {
      try {
        fetch('/api/customers/release-id', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      } catch {
        // Ignored in teardown
      }
    }

    setReservedCode('');
    setLeaseToken('');
  }, []);

  /**
   * Request a new reserved Customer ID from the backend
   */
  const reserve = useCallback(async () => {
    setIsReserving(true);
    setError(null);
    try {
      const res = await customersService.reserveCustomerCode(sessionTokenRef.current);
      if (res?.success && res.customer_code) {
        setReservedCode(res.customer_code);
        setLeaseToken(res.lease_token);
        setExpiresIn(res.expires_in || 900);

        leaseRef.current = {
          code: res.customer_code,
          token: res.lease_token,
          isCommitted: false,
        };
        return res;
      } else {
        throw new Error('Failed to reserve Customer ID');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Error reserving Customer ID';
      setError(msg);
      throw err;
    } finally {
      setIsReserving(false);
    }
  }, []);

  /**
   * Mark the reservation as successfully used/committed (so unmount won't release it)
   */
  const commit = useCallback(() => {
    leaseRef.current.isCommitted = true;
  }, []);

  // Auto-reserve on mount if enabled
  useEffect(() => {
    if (options.autoReserve) {
      reserve().catch(() => {});
    }

    const handleBeforeUnload = () => {
      releaseReservation();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      releaseReservation();
    };
  }, [options.autoReserve, reserve, releaseReservation]);

  return {
    reservedCode,
    leaseToken,
    expiresIn,
    isReserving,
    error,
    reserve,
    release: releaseReservation,
    commit,
  };
}

