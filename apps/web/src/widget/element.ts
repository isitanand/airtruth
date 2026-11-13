import { Check, CloudRain, Copy, Plane, Radar, ShieldAlert, Users, type IconNode } from 'lucide'
import { createElement } from 'lucide'
import { ACTION_LABELS, describe } from './copy'
import { styles } from './styles'
import { cleanVariables, themeCss, type AppearanceVariables } from './tokens'
import type { ActionId, FlightEnvelope, FlightSource, FlightView, Locale } from './types'

const icon = (node: IconNode, size = 14) => {
  const el = createElement(node)
  el.setAttribute('width', String(size))
  el.setAttribute('height', String(size))
  el.setAttribute('stroke-width', '2')
  el.setAttribute('aria-hidden', 'true')
  return el.outerHTML
}
const FACT_ICONS = { radar: Radar, weather: CloudRain, crew: Users, runway: Plane }
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

export type Variant = 'flight-row' | 'flight-card' | 'claim-screen'
export interface Appearance { theme?: string; variables?: Record<string, string> }

export class AirTruthFlight extends HTMLElement {
  static observedAttributes = ['session', 'flight', 'variant', 'theme', 'api', 'locale']
  #root: ShadowRoot | null = null
  #timer: number | undefined
  #json = ''
  #resolutionJson = 'null'
  #view: FlightView | null = null
  #busy = false
  #copied = false
  #lastError = ''
  #source: FlightSource | null = null
  #vars: AppearanceVariables = {}

  set source(source: FlightSource | null) { this.#source = source; this.#restart() }
  get source() { return this.#source }

  set appearance(a: Appearance | null) {
    if (a?.theme) this.setAttribute('theme', a.theme)
    this.#vars = cleanVariables(a?.variables)
    this.#render(false)
  }

  get view(): FlightView | null { return this.#view }

  connectedCallback() {
    if (!this.#root) {
      this.#root = this.attachShadow({ mode: 'open' })
      this.#root.addEventListener('click', (e) => this.#onClick(e))
    }
    this.#restart()
  }

  disconnectedCallback() { window.clearInterval(this.#timer) }
  attributeChangedCallback() { if (this.#root) { this.#json = ''; this.#refresh() } }

  #restart() {
    window.clearInterval(this.#timer)
    if (!this.isConnected || !this.#root) return
    this.#json = ''
    this.#refresh()
    this.#timer = window.setInterval(() => { if (!document.hidden) this.#refresh() }, this.#source?.intervalMs ?? 2500)
  }

  get #locale(): Locale { return this.getAttribute('locale') === 'hi-Latn-IN' ? 'hi-Latn-IN' : 'en-IN' }
  get #flightKey() { return this.getAttribute('flight') ?? '' }

  get #demoUrl() {
    const base = this.getAttribute('api') ?? ''
    return `${base}/v1/demo/sessions/${this.getAttribute('session')}/flights/${this.#flightKey}`
  }

  async #load(): Promise<FlightEnvelope | null> {
    if (this.#source) return this.#source.load(this.#locale)
    if (!this.getAttribute('session') || !this.#flightKey) return null
    const res = await fetch(this.#demoUrl)
    return res.ok ? res.json() : null
  }

  async #act(action: ActionId): Promise<FlightEnvelope | null> {
    if (this.#source) return this.#source.act(action, this.#locale)
    const res = await fetch(`${this.#demoUrl}/actions`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, locale: this.#locale }),
    })
    return res.ok ? res.json() : null
  }

  async #refresh() {
    try {
      const env = await this.#load()
      this.#lastError = ''
      if (env) this.#accept(env)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message !== this.#lastError) {
        this.#lastError = message
        this.#emit('airtruth:error', { flightId: this.#view?.flight_ref ?? null, message })
      }
    }
  }

  #accept(env: FlightEnvelope) {
    const json = JSON.stringify(env.view)
    if (json === this.#json) return
    this.#json = json
    const flash = Boolean(env.view?.radar_flash)
    this.#view = env.view
    this.#render(flash)
    if (!env.view) return
    this.#emit('airtruth:change', env.view)
    const resolution = JSON.stringify(env.view.resolution ?? null)
    if (resolution !== this.#resolutionJson) {
      this.#resolutionJson = resolution
      if (env.view.resolution) this.#emit('airtruth:resolution', { flightId: env.view.flight_ref, resolution: env.view.resolution })
    }
  }

  #emit(type: string, detail: unknown, cancelable = false): boolean {
    return this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true, cancelable }))
  }

  async #onClick(e: Event) {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]')
    if (!btn || this.#busy) return
    const action = btn.dataset.action as ActionId
    if (action === 'copy_signature') {
      await navigator.clipboard?.writeText(this.#view?.claim_packet?.signature_sha256 ?? '').catch(() => {})
      this.#copied = true
      this.#render(false)
      window.setTimeout(() => { this.#copied = false; this.#render(false) }, 1600)
      return
    }
    if (!this.#emit('airtruth:action', { flightId: this.#view?.flight_ref ?? null, action }, true)) return
    this.#busy = true
    this.#render(false)
    try {
      const env = await this.#act(action)
      if (env) { this.#json = ''; this.#accept(env) }
    } catch (err) {
      this.#emit('airtruth:error', { flightId: this.#view?.flight_ref ?? null, message: err instanceof Error ? err.message : String(err) })
    } finally {
      this.#busy = false
      this.#render(false)
    }
  }

  #render(flash: boolean) {
    if (!this.#root) return
    const v = this.#view
    const theme = this.getAttribute('theme') ?? 'neutral'
    const body = v ? this.#body(v) : `<p class="detail">Synchronizing ADS-B &amp; METAR telemetry…</p>`
    this.#root.innerHTML = `<style>${themeCss(theme, this.#vars)}${styles}</style>${body}`
    if (flash || v?.radar_flash) {
      this.#root.querySelector('.w')?.classList.add('radar-flash')
    }
  }

  #body(v: FlightView): string {
    const d = describe(v, this.#locale)
    const labels = ACTION_LABELS(v, this.#locale)
    const disabled = this.#busy ? ' disabled' : ''

    const payoutText = v.payout.amount > 0
      ? `${v.payout.currency}${v.payout.amount.toLocaleString()} Statutory Payout`
      : `Max ${v.payout.currency}${v.payout.eligible_max.toLocaleString()} Eligible`

    const top = `<div class="top"><span class="badge ${d.badge.tone}">${esc(d.badge.text)}</span><span class="payout-pill">${esc(payoutText)}</span></div>`
    const banner = d.rootBanner
      ? `<div class="radar-banner ${d.rootBanner.rebutted ? 'rebutted' : ''}">
          <span class="radar-kicker">${icon(ShieldAlert, 13)} ${d.rootBanner.rebutted ? 'Truth Engine · Weather Excuse Refuted' : 'Truth Engine Root Cause'}</span>
          <p class="radar-title">${esc(d.rootBanner.title)}</p>
          <p class="radar-body">${esc(d.rootBanner.detail)}</p>
        </div>`
      : ''

    const facts = d.facts.length
      ? `<ul class="facts">${d.facts.map((f) => `<li class="${f.kind}">${icon(FACT_ICONS[f.icon], 14)}<span>${esc(f.text)}</span></li>`).join('')}</ul>`
      : ''

    const actions = v.actions.length
      ? `<div class="actions">${v.actions.map((a) => `<button type="button" class="btn ${a.primary ? 'primary' : 'secondary'}" data-action="${a.id}"${disabled}>${esc(labels[a.id] ?? a.label)}</button>`).join('')}</div>`
      : ''

    const pkt = v.claim_packet
    const packetHtml = pkt && (v.excuse_state === 'rebutted' || v.payout.stage === 'packet_issued' || v.payout.stage === 'submitted')
      ? `<section class="packet">
          <div class="packet-head"><span>${esc(pkt.statute)}</span><code>${esc(pkt.packet_id)}</code></div>
          <div class="packet-amount">${esc(pkt.amount_display)} Statutory Packet</div>
          <p class="packet-meta">Tail ${esc(pkt.tail_number)} · ${pkt.signed_adsb_coordinates.length} signed ADS-B fixes anchored</p>
          <div class="packet-sig">${esc(pkt.signature_sha256)}</div>
          <button type="button" class="copy-btn" data-action="copy_signature">${icon(this.#copied ? Check : Copy, 13)} ${this.#copied ? 'Copied SHA-256' : 'Copy Signed Packet Hash'}</button>
        </section>`
      : ''

    return `<div class="w${v.radar_flash ? ' radar-flash' : ''}" role="group" aria-label="AirTruth audit for ${esc(v.flight_code)}">
      ${top}
      <p class="headline">${esc(d.headline)}</p>
      <p class="detail">${esc(d.detail)}</p>
      ${banner}
      ${facts}
      ${actions}
      ${packetHtml}
    </div>`
  }
}

export function defineElements(): void {
  if (!customElements.get('airtruth-flight')) customElements.define('airtruth-flight', AirTruthFlight)
}

defineElements()

declare global {
  interface HTMLElementTagNameMap { 'airtruth-flight': AirTruthFlight }
}
