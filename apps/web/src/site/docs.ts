const files = import.meta.glob('../../../../docs/sdk/*.md', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>

export const DOC_ORDER = [
  'api-reference',
  'config-reference',
  'webhooks',
]

export const DOCS: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, raw]) => [path.split('/').pop()!.replace(/\.md$/, ''), raw]),
)
