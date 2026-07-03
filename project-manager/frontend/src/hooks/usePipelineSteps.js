import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../lib/api.js';

export function usePipelineSteps(packageId, pollIntervalMs = 3000) {
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState(false);
  const intervalRef = useRef(null);
  const failCountRef = useRef(0);

  useEffect(() => {
    if (!packageId) return;

    const fetchSteps = async () => {
      try {
        const data = await apiFetch(`/pipeline/${packageId}/steps`);
        setSteps(data);
        setDbError(false);
        failCountRef.current = 0;
      } catch (e) {
        failCountRef.current++;
        // Only log first failure to avoid console spam
        if (failCountRef.current === 1) {
          console.warn('usePipelineSteps: backend unreachable, will retry...');
        }
        setDbError(true);
        // Exponential backoff: increase interval after failures
        if (failCountRef.current > 3 && intervalRef.current) {
          clearInterval(intervalRef.current);
          const backoff = Math.min(pollIntervalMs * Math.pow(2, failCountRef.current - 3), 30000);
          intervalRef.current = setInterval(fetchSteps, backoff);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchSteps();
    intervalRef.current = setInterval(fetchSteps, pollIntervalMs);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [packageId, pollIntervalMs]);

  return { steps, loading, dbError };
}
