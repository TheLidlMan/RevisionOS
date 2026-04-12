const MARKETING_URL = (import.meta.env.VITE_MARKETING_URL as string | undefined)?.trim() || 'https://reviseos.co.uk';

export const normalizeNextPath = (nextPath: string | null | undefined) => {
  if (!nextPath || !nextPath.startsWith('/')) {
    return '/';
  }
  return nextPath;
};

export const buildLoginRedirectPath = (nextPath: string) =>
  nextPath && nextPath !== '/' ? `/login?next=${encodeURIComponent(nextPath)}` : '/login';

export const getMarketingUrl = () => MARKETING_URL.replace(/\/$/, '');
