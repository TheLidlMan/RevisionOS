import {
  BookOpen,
  CalendarDots,
  GearSix,
  Graph,
  SquaresFour,
  TrendDown,
  Trophy,
} from '@phosphor-icons/react';
import { matchPath } from 'react-router-dom';

type RouteParams = Record<string, string | undefined>;

interface AppPageConfig {
  pattern: string;
  title: string;
  backLabel?: string;
  getBackTo?: (params: RouteParams) => string;
}

export interface ResolvedAppPage {
  title: string;
  backLabel?: string;
  backTo?: string;
}

export const primaryNavItems = [
  { to: '/', label: 'Dashboard', icon: SquaresFour },
  { to: '/quiz', label: 'Quiz', icon: BookOpen },
  { to: '/achievements', label: 'Trophies', icon: Trophy },
  { to: '/knowledge-graph', label: 'Graph', icon: Graph },
  { to: '/curriculum', label: 'Plan', icon: CalendarDots },
  { to: '/forgetting-curve', label: 'Curve', icon: TrendDown },
  { to: '/settings', label: 'Settings', icon: GearSix },
] as const;

const appPageConfigs: AppPageConfig[] = [
  {
    pattern: '/modules/:id/flashcards',
    title: 'Flashcards',
    backLabel: 'Module',
    getBackTo: ({ id }) => `/modules/${id}`,
  },
  {
    pattern: '/flashcards/:moduleId',
    title: 'Review',
    backLabel: 'Module',
    getBackTo: ({ moduleId }) => `/modules/${moduleId}`,
  },
  {
    pattern: '/forgetting-curve/:cardId',
    title: 'Curve Detail',
    backLabel: 'Cards',
    getBackTo: () => '/forgetting-curve',
  },
  {
    pattern: '/modules/:id',
    title: 'Module',
    backLabel: 'Dashboard',
    getBackTo: () => '/',
  },
  { pattern: '/knowledge-graph', title: 'Knowledge Graph' },
  { pattern: '/forgetting-curve', title: 'Forgetting Curve' },
  { pattern: '/achievements', title: 'Achievements' },
  { pattern: '/curriculum', title: 'Study Plan' },
  { pattern: '/settings', title: 'Settings' },
  { pattern: '/quiz', title: 'Quiz' },
  { pattern: '/', title: 'Dashboard' },
];

export function isPrimaryNavActive(pathname: string, to: string): boolean {
  if (to === '/') {
    return pathname === '/';
  }

  return Boolean(matchPath({ path: `${to}/*` }, pathname) || matchPath({ path: to, end: true }, pathname));
}

export function getResolvedAppPage(pathname: string): ResolvedAppPage {
  for (const config of appPageConfigs) {
    const match = matchPath({ path: config.pattern, end: true }, pathname);
    if (!match) {
      continue;
    }

    return {
      title: config.title,
      backLabel: config.backLabel,
      backTo: config.getBackTo ? config.getBackTo(match.params) : undefined,
    };
  }

  return { title: 'ReviseOS' };
}