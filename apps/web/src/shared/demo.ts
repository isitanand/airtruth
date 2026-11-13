import { useEffect, useState } from 'react'
import type { FlightView } from '../widget/types'

export interface FlightSlot {
  key: string
  flight_ref: string
  flight_code: string
  airline: string
  tenant_id: string
  regime: string
  tail_number: string
  route: string
  title: string
  detector: string | null
  state: string
  excuse_state: string
  delay_minutes: number
  root_cause: string
  rebutted: boolean
  payout: number
  currency: string
  decision: string | null
}

export interface SessionSummary {
  id: string
  preset: string
  title: string
  now: string
  start: string
  end: string
  progress: number
  beats: { id: number; label: string; offset: string }[]
  flights: FlightSlot[]
}

export function useSession(): string | null {
  const [sid, setSid] = useState<string | null>(() => new URLSearchParams(location.search).get('session'))
  useEffect(() => {
    const sync = () => setSid(new URLSearchParams(location.search).get('session'))
    addEventListener('popstate', sync)
    return () => removeEventListener('popstate', sync)
  }, [])
  return sid
}

export function useFlight(session: string | null, flightKey: string, intervalMs = 2000): FlightView | null {
  const [view, setView] = useState<FlightView | null>(null)
  useEffect(() => {
    if (!session) return
    let stop = false
    const pull = async () => {
      try {
        const res = await fetch(`/v1/demo/sessions/${session}/flights/${flightKey}`)
        if (res.ok && !stop) {
          const data = await res.json()
          setView(data.view)
        }
      } catch {
        /* next tick retries */
      }
    }
    pull()
    const id = setInterval(() => { if (!document.hidden) pull() }, intervalMs)
    return () => { stop = true; clearInterval(id) }
  }, [session, flightKey, intervalMs])
  return view
}

export function minutesUntil(iso: string, nowIso: string): number {
  return Math.max(0, Math.round((new Date(iso).getTime() - new Date(nowIso).getTime()) / 60000))
}
