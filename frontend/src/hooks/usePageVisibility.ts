import { useEffect, useState } from 'react';
import { isBrowser } from '../utils/browser';

export function usePageVisibility() {
  const [visible, setVisible] = useState(() => (isBrowser() ? !document.hidden : true));

  useEffect(() => {
    if (!isBrowser()) {
      return undefined;
    }

    const handleVisibilityChange = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return visible;
}
