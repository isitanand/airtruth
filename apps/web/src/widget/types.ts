export type Locale = 'en-IN' | 'hi-Latn-IN'

export type FlightState =
  | 'scheduled'
  | 'inbound_delayed'
  | 'crew_hold'
  | 'gate_hold'
  | 'tarmac_hold'
  | 'boarding'
  | 'pushback'
  | 'airborne'
  | 'landed'
  | 'cancelled'
  | 'excuse_disputed'

export type ExcuseState = 'none' | 'claimed' | 'rebutted' | 'verified'

export type ActionId =
  | 'airline_claims_weather'
  | 'challenge_weather'
  | 'generate_packet'
  | 'submit_claim'
  | 'escalate_regulator'
  | 'copy_signature'

export interface RotationLeg {
  leg_index: number
  flight_code: string
  route: string
  sched_dep: string
  act_dep: string
  delay_min: number
  cause: string | null
  summary: string | null
  coord_sig: string
}

export interface SignedAdsbCoord {
  at: string
  icao24: string
  tail: string
  callsign: string
  airport: string | null
  phase: string | null
  lat: number
  lon: number
  alt_ft: number
  coord_sig: string
}

export interface ClaimPacket {
  packet_id: string
  flight_ref: string
  flight_code: string
  airline: string
  tail_number: string
  route: string
  regime: string
  statute: string
  regulator: string
  regulator_url: string
  amount: number
  currency: string
  currency_code: string
  amount_display: string
  excuse_status: string
  airline_excuse: string
  true_root_cause_title: string
  true_root_cause: string
  contradictions: string[]
  signed_adsb_coordinates: SignedAdsbCoord[]
  issued_at: string
  signature_sha256: string
}

export interface Resolution {
  resolution_id: string
  version: number
  action: string
  decision: string
  remedy: {
    id: string | null
    kind: string
    amount: number
    currency: string
    eta: string | null
    reference: string | null
  }
  status: 'none' | 'proposed' | 'approved' | 'executed'
  steps: { at: string; who: string; text: string }[]
  passenger_message: Record<string, string>
  agent_summary: string
  case_id: string | null
  decided_at: string
  radar_flash?: boolean
}

export interface FlightView {
  object: 'flight'
  flight_ref: string
  flight_code: string
  tail_number: string
  icao24: string
  aircraft_type: string
  route: string
  origin_icao: string
  dest_icao: string
  distance_km: number
  regime: string
  regime_label: string
  statute: string
  brand: string
  title: string
  state: FlightState
  excuse_state: ExcuseState
  now: string
  scheduled_dep: string | null
  delay_minutes: number
  delay_hours: number
  eta: { due: string; shown: string; stated_reason: string | null; gate: string | null }
  root_cause: { title: string; detail: string; rebutted: boolean }
  detectors: string[]
  rotation_legs: RotationLeg[]
  metar: { station: string; raw: string; visibility_m: number; ceiling_ft: number; wind_kt: number; flyable: boolean } | null
  runway_ops: { airport: string; runway: string; window: string; other_departures_count: number; sample_flights: string[]; gdp_active: boolean } | null
  crew_duty: { base: string; duty_hours_logged: number; max_fdtl_hours: number; reserve_available: boolean; summary: string } | null
  excuse_claim: { excuse: string; station: string; window: string; message: string; at: string } | null
  payout: { amount: number; currency: string; currency_code: string; stage: string; packet_id: string | null; eligible_max: number }
  claim_packet: ClaimPacket | null
  radar_flash: boolean
  actions: { id: ActionId; label: string; primary?: boolean }[]
  resolution: Resolution | null
  timeline: { at: string; who: string; text: string; kind: string }[]
  key?: string
  detector?: string
  notes?: string
  beats?: { id: number; label: string; offset: string }[]
  timeline_bounds?: { start: string; end: string }
}

export interface FlightEnvelope {
  view: FlightView
  appearance?: { theme?: string; variables?: Record<string, string> }
}

export interface FlightSource {
  load(locale: Locale): Promise<FlightEnvelope>
  act(action: ActionId, locale: Locale): Promise<FlightEnvelope>
  intervalMs?: number
}

export interface Answer {
  answer: string
  intent: string
  excuse_state: ExcuseState
  root_cause: string
  grounded_at: string
  evidence: { label: string; value: string }[]
  sources: string[]
}
