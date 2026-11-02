import { create } from 'zustand';

export interface PingStatus {
  deviceId: string;
  pingStatus: 'online' | 'auth_failed' | 'offline' | null;
  latencyMs: number | null;
  lastCheckedAt: string | null;
}

interface PingStatusState {
  pingStatuses: Map<string, PingStatus>;
  setPingStatus: (deviceId: string, status: PingStatus) => void;
  setPingStatuses: (statuses: PingStatus[]) => void;
  getPingStatus: (deviceId: string) => PingStatus | null;
  clearPingStatuses: () => void;
}

export const usePingStatusStore = create<PingStatusState>((set, get) => ({
  pingStatuses: new Map(),

  setPingStatus: (deviceId: string, status: PingStatus) => {
    set((state) => {
      const newMap = new Map(state.pingStatuses);
      newMap.set(deviceId, status);
      return { pingStatuses: newMap };
    });
  },

  setPingStatuses: (statuses: PingStatus[]) => {
    set((state) => {
      const newMap = new Map(state.pingStatuses);
      statuses.forEach((status) => {
        newMap.set(status.deviceId, status);
      });
      return { pingStatuses: newMap };
    });
  },

  getPingStatus: (deviceId: string) => {
    return get().pingStatuses.get(deviceId) || null;
  },

  clearPingStatuses: () => {
    set({ pingStatuses: new Map() });
  },
}));
