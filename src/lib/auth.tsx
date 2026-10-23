import * as LocalAuthentication from 'expo-local-authentication';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { useData } from './store';

type Status = 'loading' | 'locked' | 'unlocked';

export interface DeviceSecurity {
  /** The device has a fingerprint/face enrolled. */
  biometrics: boolean;
  /** The device has any screen lock (biometrics or PIN/pattern/passcode). */
  secured: boolean;
  label: string;
}

interface AuthContextValue {
  status: Status;
  security: DeviceSecurity;
  unlock: () => Promise<boolean>;
  lock: () => void;
  /** Runs `fn` without auto-locking when the app is briefly backgrounded (file pickers, share sheets). */
  withoutAutoLock: <T>(fn: () => Promise<T>) => Promise<T>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function biometricLabel(types: LocalAuthentication.AuthenticationType[]) {
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'Fingerprint';
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'Face unlock';
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return 'Iris';
  return 'Biometrics';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data } = useData();
  const lockTimeout = data.settings.lockTimeout;

  const [status, setStatus] = useState<Status>('loading');
  const [security, setSecurity] = useState<DeviceSecurity>({ biometrics: false, secured: false, label: 'Fingerprint' });

  const backgroundedAt = useRef<number | null>(null);
  const suspended = useRef(0);

  useEffect(() => {
    (async () => {
      const [level, types] = await Promise.all([
        LocalAuthentication.getEnrolledLevelAsync(),
        LocalAuthentication.supportedAuthenticationTypesAsync(),
      ]);
      const secured = level !== LocalAuthentication.SecurityLevel.NONE;
      setSecurity({
        biometrics: level >= LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK,
        secured,
        label: biometricLabel(types),
      });
      // Without any screen lock there is nothing to verify against, so the app opens directly.
      setStatus(secured ? 'locked' : 'unlocked');
    })().catch((e) => {
      console.warn('Auth init failed', e);
      setStatus('locked');
    });
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        backgroundedAt.current = suspended.current > 0 ? null : Date.now();
      } else if (state === 'active' && backgroundedAt.current !== null) {
        const away = Date.now() - backgroundedAt.current;
        backgroundedAt.current = null;
        if (away >= lockTimeout * 1000 && security.secured) setStatus((s) => (s === 'unlocked' ? 'locked' : s));
      }
    });
    return () => sub.remove();
  }, [lockTimeout, security.secured]);

  const withoutAutoLock = useCallback(async <T,>(fn: () => Promise<T>) => {
    suspended.current += 1;
    try {
      return await fn();
    } finally {
      // Let the "active" AppState event land before re-arming the auto-lock.
      setTimeout(() => {
        suspended.current -= 1;
      }, 1000);
    }
  }, []);

  const unlock = useCallback(async () => {
    // The system prompt can background the app (e.g. the device PIN fallback screen); don't treat that as leaving.
    const result = await withoutAutoLock(() =>
      LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock SpendLite',
        promptSubtitle: 'Use your fingerprint',
        cancelLabel: 'Cancel',
      }),
    );
    if (result.success) setStatus('unlocked');
    return result.success;
  }, [withoutAutoLock]);

  const lock = useCallback(() => {
    if (security.secured) setStatus((s) => (s === 'unlocked' ? 'locked' : s));
  }, [security.secured]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, security, unlock, lock, withoutAutoLock }),
    [status, security, unlock, lock, withoutAutoLock],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
