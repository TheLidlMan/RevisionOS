import { useEffect, useState } from 'react';
import { isBrowser } from '../utils/browser';

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => (isBrowser() ? window.matchMedia(query).matches : false));

  useEffect(() => {
    if (!isBrowser()) {
      return undefined;
    }

    const mediaQuery = window.matchMedia(query);
    const handleChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [query]);

  return matches;
}
