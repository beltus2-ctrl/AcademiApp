import 'firebase/auth';

declare module 'firebase/auth' {
  import type { Persistence } from 'firebase/auth';

  type ReactNativeAsyncStorage = {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  };

  export function getReactNativePersistence(storage: ReactNativeAsyncStorage): Persistence;
}
