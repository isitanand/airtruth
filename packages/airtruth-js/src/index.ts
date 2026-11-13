import { AirTruthFlight, defineElements, type Appearance, type Variant } from '../../../apps/web/src/widget/element'
import type { ActionId, Answer, ClaimPacket, FlightEnvelope, FlightSource, FlightView, Locale, Resolution } from '../../../apps/web/src/widget/types'

export { AirTruthFlight, defineElements }
export type { ActionId, Answer, Appearance, ClaimPacket, FlightEnvelope, FlightView, Locale, Resolution, Variant }

export interface AirTruthOptions {
  apiBase?: string
  locale?: Locale
  appearance?: Appearance
  clientSecret?: string
  pollIntervalMs?: number
}

export class AirTruthError extends Error {
  readonly code: string
  readonly status: number
  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'AirTruthError'
    this.status = status
    this.code = code
  }
}

export interface EventMap {
  change: FlightView
  resolution: { flightId: string; resolution: Resolution }
  action: { flightId: string | null; action: ActionId }
  error: { flightId: string | null; message: string }
}

export interface MountOptions {
  variant?: Variant
  theme?: string
  locale?: Locale
  appearance?: Appearance
}

export class HeadlessFlight {
  readonly #client: AirTruthClient
  readonly id: string
  readonly #source: FlightSource

  constructor(client: AirTruthClient, id: string) {
    this.#client = client
    this.id = id
    this.#source = {
      intervalMs: client.pollIntervalMs,
      load: () => client.get(id),
      act: (action, loc) => client.act(id, action, loc),
    }
  }

  get(): Promise<FlightEnvelope> { return this.#client.get(this.id) }
  act(action: ActionId, locale?: Locale): Promise<FlightEnvelope> { return this.#client.act(this.id, action, locale) }
  ask(question: string, locale?: Locale): Promise<Answer> { return this.#client.ask(this.id, question, locale) }

  mount(target: string | HTMLElement, options: MountOptions = {}): AirTruthFlight {
    defineElements()
    const host = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target
    if (!host) throw new Error(`AirTruth: mount target not found (${String(target)})`)
    const el = document.createElement('airtruth-flight') as AirTruthFlight
    el.setAttribute('flight', this.id)
    if (options.variant) el.setAttribute('variant', options.variant)
    el.setAttribute('locale', options.locale ?? this.#client.locale)
    const app = options.appearance ?? (options.theme ? { ...this.#client.appearance, theme: options.theme } : this.#client.appearance)
    if (app) el.appearance = app
    el.source = this.#source
    host.replaceChildren(el)
    return el
  }
}

export class AirTruthClient {
  readonly apiBase: string
  readonly #key: string
  readonly #clientSecret: string | undefined
  readonly locale: Locale
  readonly appearance: Appearance | undefined
  readonly pollIntervalMs: number

  constructor(publishableKey: string, options: AirTruthOptions = {}) {
    if (!publishableKey) throw new Error('AirTruth.init(publishableKey): publishableKey is required')
    this.#key = publishableKey
    this.apiBase = (options.apiBase ?? '').replace(/\/$/, '')
    this.locale = options.locale ?? 'en-IN'
    this.appearance = options.appearance
    this.#clientSecret = options.clientSecret
    this.pollIntervalMs = options.pollIntervalMs ?? 3000
  }

  flight(id: string): HeadlessFlight { return new HeadlessFlight(this, id) }

  get(flightId: string): Promise<FlightEnvelope> {
    return this.#req('GET', `/v1/flights/${encodeURIComponent(flightId)}`)
  }

  act(flightId: string, action: ActionId, locale: Locale = this.locale): Promise<FlightEnvelope> {
    return this.#req('POST', `/v1/flights/${encodeURIComponent(flightId)}/actions`, { action, locale })
  }

  ask(flightId: string, question: string, locale: Locale = this.locale): Promise<Answer> {
    return this.#req('POST', `/v1/flights/${encodeURIComponent(flightId)}/ask`, { question, locale })
  }

  async #req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { authorization: `Bearer ${this.#key}` }
    if (this.#clientSecret) headers['x-airtruth-client-secret'] = this.#clientSecret
    if (body !== undefined) headers['content-type'] = 'application/json'
    const res = await fetch(`${this.apiBase}${path}`, {
      method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      const err = payload?.error ?? {}
      throw new AirTruthError(res.status, err.code ?? 'request_failed', err.message ?? res.statusText)
    }
    return payload as T
  }
}

export const AirTruth = {
  init: (publishableKey: string, options?: AirTruthOptions) => new AirTruthClient(publishableKey, options),
}

export default AirTruth
