import type { ActionId, FlightView, Locale } from './types'

export interface Fact {
  icon: 'radar' | 'weather' | 'crew' | 'runway'
  kind: 'present' | 'warn' | 'absent'
  text: string
}

export interface Described {
  badge: { tone: 'calm' | 'check' | 'alert' | 'ok'; text: string }
  headline: string
  detail: string
  facts: Fact[]
  rootBanner: { title: string; detail: string; rebutted: boolean } | null
}

const BADGES: Record<string, { tone: 'calm' | 'check' | 'alert' | 'ok'; en: string; hi: string }> = {
  scheduled: { tone: 'ok', en: 'On Schedule', hi: 'Time par' },
  inbound_delayed: { tone: 'check', en: 'Inbound Late', hi: 'Inbound late' },
  crew_hold: { tone: 'alert', en: 'Crew Timeout', hi: 'Crew timeout' },
  gate_hold: { tone: 'check', en: 'Gate Hold', hi: 'Gate hold' },
  tarmac_hold: { tone: 'alert', en: 'Tarmac Hold', hi: 'Tarmac hold' },
  boarding: { tone: 'ok', en: 'Boarding', hi: 'Boarding chalu' },
  pushback: { tone: 'calm', en: 'Pushed Back', hi: 'Pushback ho gaya' },
  airborne: { tone: 'ok', en: 'Airborne', hi: 'Flight ud chuki' },
  landed: { tone: 'ok', en: 'Landed', hi: 'Land ho gayi' },
  cancelled: { tone: 'alert', en: 'Cancelled', hi: 'Flight cancel' },
  excuse_disputed: { tone: 'alert', en: 'Excuse Rebutted', hi: 'Excuse rebut hua' },
}

export function describe(v: FlightView, locale: Locale): Described {
  const hi = locale === 'hi-Latn-IN'
  const b = BADGES[v.state] ?? BADGES.scheduled
  const delayLabel = v.delay_minutes > 0 ? `+${Math.floor(v.delay_minutes / 60)}h ${v.delay_minutes % 60}m delay` : 'On time'

  let headline = `${v.flight_code} · Tail ${v.tail_number} (${v.route})`
  let detail = v.eta.shown || delayLabel
  if (v.excuse_state === 'rebutted') {
    headline = hi ? 'Weather ka bahana galat saabit hua' : 'Airline Weather Excuse Rebutted'
    detail = v.root_cause.detail
  } else if (v.excuse_state === 'claimed') {
    headline = hi ? 'Airline ne Weather excuse lagaya hai' : 'Airline Invoked Weather Exemption'
    detail = v.excuse_claim?.message || v.root_cause.detail
  } else if (v.crew_duty && (v.crew_duty.duty_hours_logged >= v.crew_duty.max_fdtl_hours || !v.crew_duty.reserve_available)) {
    headline = `Crew FDTL Expiry · Tail ${v.tail_number}`
    detail = v.crew_duty.summary
  } else if (v.rotation_legs.length > 0) {
    headline = `${v.rotation_legs.length}-Leg Tail Chain Traced (${v.tail_number})`
    detail = v.root_cause.detail
  }

  const facts: Fact[] = []
  if (v.rotation_legs.length > 0) {
    facts.push({
      icon: 'radar',
      kind: v.rotation_legs.some((l) => l.delay_min >= 30) ? 'warn' : 'present',
      text: `${v.rotation_legs.length} prior tail legs traced`,
    })
  }
  if (v.metar) {
    facts.push({
      icon: 'weather',
      kind: v.metar.flyable ? 'present' : 'warn',
      text: `METAR ${v.metar.station}: ${v.metar.flyable ? 'Flyable VMC' : 'Low vis'}`,
    })
  }
  if (v.runway_ops) {
    facts.push({
      icon: 'runway',
      kind: v.runway_ops.other_departures_count >= 3 ? 'warn' : 'present',
      text: `${v.runway_ops.other_departures_count} flights took off ${v.runway_ops.runway}`,
    })
  }
  if (v.crew_duty) {
    facts.push({
      icon: 'crew',
      kind: v.crew_duty.duty_hours_logged >= v.crew_duty.max_fdtl_hours ? 'warn' : 'present',
      text: `FDTL ${v.crew_duty.duty_hours_logged.toFixed(1)}h/${v.crew_duty.max_fdtl_hours.toFixed(1)}h`,
    })
  }

  const rootBanner = (v.excuse_state === 'rebutted' || v.detectors.length > 0)
    ? { title: v.root_cause.title, detail: v.root_cause.detail, rebutted: v.excuse_state === 'rebutted' }
    : null

  return {
    badge: { tone: b.tone, text: hi ? b.hi : b.en },
    headline,
    detail,
    facts,
    rootBanner,
  }
}

export function ACTION_LABELS(v: FlightView, locale: Locale): Record<ActionId, string> {
  const hi = locale === 'hi-Latn-IN'
  return {
    airline_claims_weather: hi ? 'Airline Weather Claim Kare' : 'Airline claims weather',
    challenge_weather: hi ? 'Weather Jhooth Check Karein' : 'Verify & rebut weather',
    generate_packet: hi ? 'Signed Packet Banayein' : 'Generate claim packet',
    submit_claim: `${hi ? 'Claim File Karein' : 'File'} ${v.regime_label} Claim (${v.payout.currency}${v.payout.amount.toLocaleString()})`,
    escalate_regulator: hi ? 'Regulator ko Escalate Karein' : 'Escalate to regulator',
    copy_signature: hi ? 'ADS-B Signature Copy' : 'Copy ADS-B signature',
  }
}
