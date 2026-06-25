import { useEffect, useState } from 'react';
import { fetchComplaintCount } from '../services/complaints';

export function useComplaintCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadCount() {
      try {
        const nextCount = await fetchComplaintCount();
        if (active) setCount(nextCount);
      } catch {
        if (active) setCount(0);
      }
    }

    loadCount();
    const intervalId = window.setInterval(loadCount, 10000);
    const handleUpdate = () => loadCount();
    window.addEventListener('complaint-count-changed', handleUpdate);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('complaint-count-changed', handleUpdate);
    };
  }, []);

  return count;
}
