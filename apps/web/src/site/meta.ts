import builtByRaw from './content/built-by.md?raw'
import insights from './data/insights.json'
import { STUDIES, type Slug } from './data/studies'
import { FAQ } from './data/faq'
import { DOC_ORDER, DOCS } from './docs'
import { STUDY_SLUGS, type PageKey } from './pages'

export const SITE_NAME = 'AIRTRUTH'
export const TOKEN = '__SITE_URL__'

export interface Route {
  path: string
  page: PageKey
  slug?: string
  title: string
  description: string
  og: string
  robots?: string
  markdown?: string
}

const studyRoute = (slug: Slug): Route => {
  const s = STUDIES[slug]
  return {
    path: `/case-studies/${slug}`, page: 'study', slug,
    title: `${s.name} audit: ${s.rebuttedShare}% weather excuses rebutted — AIRTRUTH`,
    description: `${s.summary} (${s.statute})`,
    og: '/site/photo/tarmac-turnaround.jpg',
    markdown: studyMd(slug),
  }
}

export const routes: Route[] = [
    { path: '/', page: 'home',
      title: 'AIRTRUTH · The Airline Delay & Statutory Payout Engine',
      description: "Your flight wasn't delayed by 'Weather'. It was delayed because aircraft VT-IFU had a crew timeout in Mumbai 6 hours ago. Cross-examines ADS-B radar, METAR weather, runway logs, and crew FDTL.",
      og: '/site/photo/tarmac-turnaround.jpg' },
    { path: '/lookup', page: 'lookup',
      title: 'Check Any Flight Delay · Extract PNR & True Root Cause — AIRTRUTH',
      description: 'Enter any Flight Number & Date or paste an airline PNR/SMS to extract the real delay cause, live NOAA METAR weather, tail-number chain, and download a signed EU261 / US DOT / DGCA claim packet.',
      og: '/site/photo/tarmac-turnaround.jpg' },
    { path: '/demos', page: 'demos',
      title: 'Live Aviation Radar Demo · IndiGo, Delta & British Airways — AIRTRUTH',
      description: 'Scrub a live flight timeline, trigger Airline claims weather, watch ADS-B radar verification flash the true root cause, and download a signed EU261 / US DOT / DGCA claim packet.',
      og: '/site/photo/flight-deck-weather.jpg', robots: 'noindex, follow' },
    { path: '/case-studies', page: 'studies',
      title: 'Case studies · Airline delay excuse audits — AIRTRUTH',
      description: `Telemetry audits across ${insights.auditTotal} delayed flights in IndiGo, Delta, and British Airways.`,
      og: '/site/photo/tarmac-turnaround.jpg', markdown: studiesMd() },
    ...STUDY_SLUGS.map(studyRoute),
    { path: '/method', page: 'method',
      title: 'Method · Aviation telemetry fusion & statutory charter verification — AIRTRUTH',
      description: 'How AIRTRUTH joins Mode-S ADS-B tail rotations, METAR reports, runway departure counts, and FDTL crew limits into verifiable statutory claim packets.',
      og: '/site/photo/flight-deck-weather.jpg', markdown: methodMd() },
    { path: '/docs', page: 'docs', slug: 'api-reference',
      title: 'Passenger Rights & Public Audit API — AIRTRUTH',
      description: 'Verify flight delays via POST /v1/flights/lookup, audit EU261, US DOT, and DGCA statutory thresholds, and validate SHA-256 ADS-B claim packets.',
      og: '/site/photo/tarmac-turnaround.jpg', markdown: DOCS['api-reference'] },
    ...DOC_ORDER.map((slug) => ({
      path: `/docs/${slug}`, page: 'docs' as const, slug,
      title: `${docTitle(slug)} — AIRTRUTH`,
      description: docLead(DOCS[slug] ?? ''),
      og: '/site/photo/tarmac-turnaround.jpg',
      markdown: DOCS[slug],
    })),
    { path: '/privacy', page: 'privacy',
      title: 'Privacy & telemetry verification — AIRTRUTH',
      description: 'Cryptographic SHA-256 flight coordinate signing, stateless verification sessions, and passenger data minimization.',
      og: '/site/photo/tarmac-turnaround.jpg', markdown: privacyMd() },
    { path: '/built-by', page: 'built',
      title: 'Architecture & scope — AIRTRUTH',
      description: 'The complete AirTruth flight-truth web platform, statutory charter resolver, and real-time flight delay verification.',
      og: '/site/photo/tarmac-turnaround.jpg', markdown: builtByRaw },
]

export const notFound: Route = {
  path: '/404', page: 'notFound',
  title: 'Flight path not found (404) — AIRTRUTH',
  description: 'No page at this address.',
  og: '/site/photo/tarmac-turnaround.jpg',
  robots: 'noindex, nofollow',
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const ld = (o: unknown) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`

export function headTags(r: Route): string {
  const url = `${TOKEN}${r.path === '/' ? '/' : r.path}`
  const img = `${TOKEN}${r.og}`
  const tags = [
    `<title>${esc(r.title)}</title>`,
    `<meta name="description" content="${esc(r.description)}" />`,
    `<link rel="canonical" href="${url}">`,
    `<meta property="og:site_name" content="${SITE_NAME}">`,
    `<meta property="og:title" content="${esc(r.title)}">`,
    `<meta property="og:description" content="${esc(r.description)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${img}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    r.robots ? `<meta name="robots" content="${r.robots}">` : '',
  ]
  if (r.page === 'home') {
    tags.push(ld({ '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: SITE_NAME,
      applicationCategory: 'AviationApplication', operatingSystem: 'Web', url: TOKEN, description: r.description }))
    tags.push(ld({ '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }))
  }
  return tags.filter(Boolean).join('\n    ')
}

function docTitle(slug: string): string {
  const m = (DOCS[slug] ?? '').match(/^#\s+(.+)$/m)
  return m ? m[1] : slug
}
function docLead(md: string): string {
  const line = md.split('\n').find((l) => l.trim() && !l.startsWith('#') && !l.startsWith('>'))
  return (line ?? 'AIRTRUTH developer documentation.').trim().slice(0, 155)
}

function studiesMd(): string {
  return ['# Case Studies — AIRTRUTH', '', `Audited ${insights.auditTotal} disrupted flights across IndiGo, Delta, and British Airways.`, '',
    ...STUDY_SLUGS.map((k) => `- **${STUDIES[k].name}** (${STUDIES[k].statute}): ${STUDIES[k].rebuttedShare}% weather claims rebutted`)].join('\n')
}
function studyMd(slug: Slug): string {
  const s = STUDIES[slug]
  return [`# ${s.name} — ${s.statute}`, '', `> ${s.line}`, '', s.summary, '', ...s.takeaways.map((t) => `- ${t}`)].join('\n')
}
function methodMd(): string {
  return ['# Method — AIRTRUTH', '', 'Cross-examines Mode-S ADS-B tail rotations, METAR reports, runway departure counts, and FDTL crew limits.', '',
    ...insights.detectors.map((d) => `- **${d.label}**: ${d.share}%`)].join('\n')
}
function privacyMd(): string {
  return ['# Privacy & Verification — AIRTRUTH', '', 'Public aviation ADS-B telemetry and METAR logs are signed locally with SHA-256 coordinate seals.'].join('\n')
}

export const sitemap = (rs: Route[] = routes) =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${
    rs.filter((r) => !r.robots?.includes('noindex')).map((r) => `  <url><loc>${TOKEN}${r.path}</loc></url>`).join('\n')
  }\n</urlset>`

export const robots = () => `User-agent: *\nAllow: /\nSitemap: ${TOKEN}/sitemap.xml\n`

export const llms = (rs: Route[] = routes) => [
  `# ${SITE_NAME}`,
  '',
  "> The Airline Delay & Statutory Payout Engine: proves the true cause of airline delays from live ADS-B flight radar, METAR weather, runway departure logs, and tail-number rotations, and issues signed EU261 / US DOT / DGCA claim packets.",
  '',
  ...rs.filter((r) => r.markdown).map((r) => `- [${r.title}](${TOKEN}${r.path}.md)`),
].join('\n')

export const llmsFull = (rs: Route[] = routes) => rs.filter((r) => r.markdown).map((r) => r.markdown).join('\n\n---\n\n')
export const markdownTwins = (rs: Route[] = routes) =>
  Object.fromEntries(rs.filter((r) => r.markdown).map((r) => [`${r.path.slice(1) || 'index'}.md`, r.markdown!]))
