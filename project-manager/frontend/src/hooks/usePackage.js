import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api.js';

export function usePackage(packageId) {
  const [pkg, setPkg] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!packageId) return;
    setLoading(true);
    try {
      const data = await apiFetch(`/packages/${packageId}`);
      setPkg(data);
    } catch (e) {
      console.error('usePackage error:', e.message);
    } finally {
      setLoading(false);
    }
  }, [packageId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { pkg, loading, refresh };
}
