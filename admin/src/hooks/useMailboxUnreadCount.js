import { useEffect, useState } from 'react';
import { fetchMailboxUnreadCount } from '../services/mailbox';

export function useMailboxUnreadCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadCount() {
      try {
        const nextCount = await fetchMailboxUnreadCount();
        if (active) setCount(nextCount);
      } catch {
        if (active) setCount(0);
      }
    }

    loadCount();
    const intervalId = window.setInterval(loadCount, 10000);
    const handleUpdate = () => loadCount();
    window.addEventListener('mailbox-count-changed', handleUpdate);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('mailbox-count-changed', handleUpdate);
    };
  }, []);

  return count;
}
