import { createSignal } from 'solid-js';
import { Network } from '@capacitor/network';

const [isOnline, setIsOnline] = createSignal<boolean>(
  typeof navigator !== 'undefined' ? navigator.onLine : true
);

type NetworkCallback = (online: boolean) => void;
const listeners: NetworkCallback[] = [];

export function onNetworkChange(callback: NetworkCallback): () => void {
  listeners.push(callback);
  return () => {
    const index = listeners.indexOf(callback);
    if (index > -1) listeners.splice(index, 1);
  };
}

export async function initNetworkListener(): Promise<void> {
  try {
    const status = await Network.getStatus();
    setIsOnline(status.connected);

    await Network.addListener('networkStatusChange', (status) => {
      setIsOnline(status.connected);
      listeners.forEach((fn) => fn(status.connected));
    });
  } catch {
    // Fallback untuk browser web standar jika plugin native belum siap
    window.addEventListener('online', () => {
      setIsOnline(true);
      listeners.forEach((fn) => fn(true));
    });

    window.addEventListener('offline', () => {
      setIsOnline(false);
      listeners.forEach((fn) => fn(false));
    });
  }
}

export { isOnline };
