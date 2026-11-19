import { useEffect, useRef } from 'react';
import { networkService } from '@/services/network.service';
import { usePingStatusStore } from '@/stores/pingStatusStore';

export function usePingStatus(
  deviceIds: string[], 
  enabled: boolean = true,
  intervalSeconds: number = 10
) {
  const { setPingStatuses } = usePingStatusStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled || deviceIds.length === 0) {
      return;
    }

    const pollMs = Math.max(5000, (intervalSeconds || 10) * 1000);

    // Initial fetch
    const fetchPingStatuses = async () => {
      try {
        const response = await networkService.getPingStatuses();
        if (response.success && response.data) {
          setPingStatuses(response.data);
        }
      } catch (error) {
        // Silently handle errors during background refresh
        console.debug('Failed to fetch ping statuses:', error);
      }
    };

    fetchPingStatuses();

    // Set up polling dynamically based on intervalSeconds
    intervalRef.current = setInterval(() => {
      fetchPingStatuses();
    }, pollMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [deviceIds.join(','), enabled, intervalSeconds, setPingStatuses]);
}
