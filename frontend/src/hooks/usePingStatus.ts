import { useEffect, useRef } from 'react';
import { networkService } from '@/services/network.service';
import { usePingStatusStore } from '@/stores/pingStatusStore';

export function usePingStatus(deviceIds: string[], enabled: boolean = true) {
  const { setPingStatuses } = usePingStatusStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled || deviceIds.length === 0) {
      return;
    }

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

    // Set up polling every 30 seconds
    intervalRef.current = setInterval(() => {
      fetchPingStatuses();
    }, 30000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [deviceIds.join(','), enabled, setPingStatuses]);
}
