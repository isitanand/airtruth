import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  AirTruthClient, AirTruthFlight, type ActionId, type Appearance, type FlightView, type Locale, type Resolution, type Variant,
} from './index'

const Ctx = createContext<AirTruthClient | null>(null)

export function AirTruthProvider({ client, children }: { client: AirTruthClient; children: ReactNode }) {
  return <Ctx.Provider value={client}>{children}</Ctx.Provider>
}

export function useAirTruth(): AirTruthClient {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAirTruth: wrap the tree in <AirTruthProvider client={airtruth}>')
  return c
}

export interface FlightWidgetProps {
  flight: string
  variant?: Variant
  appearance?: Appearance
  locale?: Locale
  className?: string
  style?: CSSProperties
  onViewChange?: (view: FlightView) => void
  onResolution?: (event: { flightId: string; resolution: Resolution }) => void
  onAction?: (event: CustomEvent<{ flightId: string | null; action: ActionId }>) => void
  onError?: (error: { flightId: string | null; message: string }) => void
}

export function AirTruthWidget({ flight, variant, appearance, locale, className, style,
  onViewChange, onResolution, onAction, onError }: FlightWidgetProps) {
  const client = useAirTruth()
  const hostRef = useRef<HTMLDivElement>(null)
  const elRef = useRef<AirTruthFlight | null>(null)
  const appKey = JSON.stringify(appearance ?? null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const app: Appearance | undefined = appKey === 'null' ? undefined : JSON.parse(appKey)
    elRef.current = client.flight(flight).mount(host, { variant, appearance: app, locale })
    return () => { elRef.current = null; host.replaceChildren() }
  }, [client, flight, variant, locale, appKey])

  useEffect(() => {
    const el = elRef.current
    if (!el) return
    const listen = <T,>(name: string, fn?: (arg: T) => void, raw = false) => {
      if (!fn) return () => {}
      const h = (e: Event) => fn((raw ? e : (e as CustomEvent<T>).detail) as T)
      el.addEventListener(name, h)
      return () => el.removeEventListener(name, h)
    }
    const offs = [
      listen<FlightView>('airtruth:change', onViewChange),
      listen<{ flightId: string; resolution: Resolution }>('airtruth:resolution', onResolution),
      listen<CustomEvent<{ flightId: string | null; action: ActionId }>>('airtruth:action', onAction, true),
      listen<{ flightId: string | null; message: string }>('airtruth:error', onError),
    ]
    return () => offs.forEach((off) => off())
  }, [onViewChange, onResolution, onAction, onError, client, flight, variant, locale, appKey])

  return <div ref={hostRef} className={className} style={style} />
}

export function useAirTruthFlight(flightId: string) {
  const client = useAirTruth()
  const [view, setView] = useState<FlightView | null>(null)
  const [error, setError] = useState<Error | null>(null)
  useEffect(() => {
    let stop = false
    const pull = () => client.get(flightId).then((e) => !stop && (setView(e.view), setError(null)))
      .catch((err) => !stop && setError(err instanceof Error ? err : new Error(String(err))))
    pull()
    const id = setInterval(() => { if (!document.hidden) pull() }, client.pollIntervalMs)
    return () => { stop = true; clearInterval(id) }
  }, [client, flightId])
  return {
    view,
    error,
    act: (action: ActionId, locale?: Locale) => client.act(flightId, action, locale).then((e) => { setView(e.view); return e.view }),
    ask: (question: string, locale?: Locale) => client.ask(flightId, question, locale),
  }
}
