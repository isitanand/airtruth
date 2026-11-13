import ba from './themes/ba.tokens.json'
import delta from './themes/delta.tokens.json'
import indigo from './themes/indigo.tokens.json'
import neutral from './themes/neutral.tokens.json'

type TokenNode = { $value?: string; [key: string]: unknown }

export const THEMES: Record<string, TokenNode> = { neutral, indigo, delta, ba }
export type ThemeName = 'neutral' | 'indigo' | 'delta' | 'ba'

export const APPEARANCE_VARIABLES = [
  'colorInk', 'colorMuted', 'colorSurface', 'colorSurface2', 'colorLine', 'colorAction', 'colorActionInk',
  'colorActionStrong', 'colorOk', 'colorOkSoft', 'colorCheck', 'colorCheckSoft', 'colorAlert', 'colorAlertSoft',
  'colorFocus', 'fontBody', 'radiusSurface', 'radiusControl',
] as const

export type AppearanceVariable = (typeof APPEARANCE_VARIABLES)[number]
export type AppearanceVariables = Partial<Record<AppearanceVariable, string>>

function flatten(node: TokenNode, path: string[], out: Record<string, string>) {
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith('$') || typeof child !== 'object' || child === null) continue
    const token = child as TokenNode
    if (typeof token.$value === 'string') out[[...path, key].join('-')] = token.$value
    else flatten(token, [...path, key], out)
  }
  return out
}

export const tokenName = (variable: string) => variable.replace(/([A-Z]|\d+)/g, (m) => `-${m.toLowerCase()}`)

const SAFE = /^[^;{}<>\\]{1,120}$/
const warned = new Set<string>()

export function cleanVariables(variables: Record<string, string> | undefined): AppearanceVariables {
  const out: AppearanceVariables = {}
  for (const [name, value] of Object.entries(variables ?? {})) {
    if ((APPEARANCE_VARIABLES as readonly string[]).includes(name) && typeof value === 'string' && SAFE.test(value)) {
      out[name as AppearanceVariable] = value
    } else if (!warned.has(name)) {
      warned.add(name)
      console.warn(`[airtruth] ignored appearance.variables.${name}: unknown variable or unsafe value`)
    }
  }
  return out
}

export function themeCss(name: string, variables?: AppearanceVariables): string {
  const tokens = flatten(THEMES[name] ?? THEMES.neutral, [], {})
  for (const [variable, value] of Object.entries(variables ?? {})) {
    const token = tokenName(variable)
    if (token in tokens && value) tokens[token] = value
  }
  return `:host { ${Object.entries(tokens).map(([k, v]) => `--w-${k}: ${v};`).join(' ')} }`
}
