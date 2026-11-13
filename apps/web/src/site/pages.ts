import type { ComponentType } from 'react'

export type PageKey = 'home' | 'lookup' | 'demos' | 'studies' | 'study' | 'method' | 'docs' | 'privacy' | 'built' | 'notFound'

export const PAGES: Record<PageKey, () => Promise<ComponentType<{ slug?: string }>>> = {
  home: () => import('./pages/Home').then((m) => m.Home),
  lookup: () => import('./pages/Lookup').then((m) => m.Lookup),
  demos: () => import('./pages/Demos').then((m) => m.Demos),
  studies: () => import('./pages/Pages').then((m) => m.CaseStudies),
  study: () => import('./pages/Pages').then((m) => m.CaseStudy),
  method: () => import('./pages/Pages').then((m) => m.Method),
  docs: () => import('./pages/Docs').then((m) => m.Docs),
  privacy: () => import('./pages/Privacy').then((m) => m.Privacy),
  built: () => import('./pages/Pages').then((m) => m.BuiltBy),
  notFound: () => import('./pages/NotFound').then((m) => m.NotFound),
}

export const STUDY_SLUGS = ['indigo', 'delta', 'ba'] as const

export const DOC_SLUGS = ['api-reference', 'config-reference', 'webhooks'] as const

export function normPath(p: string): string {
  const s = p.replace(/\/+$/, '') || '/'
  return s === '/index.html' ? '/' : s
}

export function match(path: string): { page: PageKey; slug?: string } {
  const p = normPath(path)
  if (p === '/') return { page: 'home' }
  if (p === '/lookup') return { page: 'lookup' }
  if (p === '/demos') return { page: 'demos' }
  if (p === '/case-studies') return { page: 'studies' }
  if (p === '/method') return { page: 'method' }
  if (p === '/privacy') return { page: 'privacy' }
  if (p === '/built-by') return { page: 'built' }
  if (p === '/docs') return { page: 'docs', slug: 'api-reference' }
  const doc = p.match(/^\/docs\/([a-z0-9-]+)$/)
  if (doc && (DOC_SLUGS as readonly string[]).includes(doc[1])) return { page: 'docs', slug: doc[1] }
  const cs = p.match(/^\/case-studies\/([a-z0-9-]+)$/)
  if (cs && (STUDY_SLUGS as readonly string[]).includes(cs[1])) return { page: 'study', slug: cs[1] }
  return { page: 'notFound' }
}
