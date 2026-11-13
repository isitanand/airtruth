import { AlertTriangle, Check, Copy, Download, FileCheck2, MessageSquare, Radar, RotateCcw, Send, Webhook, Wrench } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { FlightSlot, SessionSummary } from '../../shared/demo'
import type { Answer, FlightView } from '../../widget/types'
import { fmtDay, fmtTime, fmtWhen } from '../../widget/format'
import { CodeBlock } from '../parts/Code'

type Host = 'indigo' | 'delta' | 'ba'

const APPS: Record<Host, {
  brand: string
  kind: string
  src: string
  slot: string
  variant: string
  mode: string
  defaultPrompt: string
  lang: string
  code: string
}> = {
  indigo: {
    brand: 'IndiGo',
    kind: 'India · DGCA CAR §3',
    src: '/hosts/indigo.html',
    slot: 'Embedded flight rights card inside booking tracker',
    variant: 'flight-card',
    mode: 'Drop-in Web Component',
    defaultPrompt: 'Why was 6E-214 delayed and was it really weather?',
    lang: 'html',
    code: '<airtruth-flight\n  flight="indigo-crew-timeout"\n  variant="flight-card"\n  theme="indigo">\n</airtruth-flight>',
  },
  delta: {
    brand: 'Delta',
    kind: 'USA · US DOT 14 CFR §260',
    src: '/hosts/delta.html',
    slot: 'Live Fly Delta Flight Status disruption module',
    variant: 'flight-card',
    mode: 'Headless telemetry client',
    defaultPrompt: 'Did the FAA issue a Ground Delay Program for JFK?',
    lang: 'ts',
    code: "const view = await airtruth.headless\n  .flight('delta-tail-chain').get()\n\n// view.root_cause.title\n// view.claim_packet.signed_adsb_coordinates",
  },
  ba: {
    brand: 'British Airways',
    kind: 'UK/EU · EU261 Art 7',
    src: '/hosts/ba.html',
    slot: 'Manage My Booking EU261 rebuttal & claim drawer',
    variant: 'flight-card',
    mode: 'Drop-in Web Component',
    defaultPrompt: 'Did other flights take off from Heathrow RWY 27R?',
    lang: 'html',
    code: '<airtruth-flight\n  flight="ba-selective-weather"\n  variant="flight-card"\n  theme="ba">\n</airtruth-flight>',
  },
}

const QUESTIONS = [
  'Why was this flight delayed — was it really weather?',
  'Did other planes take off from the same runway?',
  'Show the 4-leg tail-number rotation chain',
  'Am I owed statutory compensation?',
  'Export signed ADS-B coordinates',
]

function useDemoSession() {
  const [summary, setSummary] = useState<SessionSummary | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const start = useCallback(async () => {
    setSummary(null)
    setFailed(false)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await fetch('/v1/demo/sessions', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ preset: 'signature' }),
        })
        if (r.ok) {
          setSummary(await r.json())
          return
        }
      } catch {
        /* retry once */
      }
    }
    setFailed(true)
  }, [])

  useEffect(() => {
    start().catch(() => {})
  }, [start])

  useEffect(() => {
    if (!summary) return
    const t = window.setInterval(() => {
      if (document.hidden) return
      fetch(`/v1/demo/sessions/${summary.id}`)
        .then((r) => {
          if (r.status === 404) { start().catch(() => {}); return }
          if (r.ok) r.json().then(setSummary)
        })
        .catch(() => {})
    }, 3000)
    return () => window.clearInterval(t)
  }, [summary?.id, start])

  const advance = async (payload: { beat?: number; progress?: number }) => {
    if (!summary) return
    setBusy(true)
    try {
      const r = await fetch(`/v1/demo/sessions/${summary.id}/advance`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (r.status === 404) await start()
      else if (r.ok) setSummary(await r.json())
    } finally {
      setBusy(false)
    }
  }

  return { summary, busy, failed, advance, restart: start }
}

export function Demos() {
  const [host, setHost] = useState<Host>('indigo')
  useEffect(() => {
    const app = new URLSearchParams(location.search).get('app')
    if (app === 'indigo' || app === 'delta' || app === 'ba') setHost(app)
  }, [])

  const { summary, busy, failed, advance, restart } = useDemoSession()
  const flights = (summary?.flights ?? []).filter((f) => f.tenant_id === host) as FlightSlot[]
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const activeSlot = flights.find((f) => f.key === selectedKey) ?? flights[0]

  const [view, setView] = useState<FlightView | null>(null)
  const [tab, setTab] = useState<'audit' | 'ask' | 'hooks' | 'wiring'>('audit')
  const [radarFlashKey, setRadarFlashKey] = useState(0)
  const [actionBusy, setActionBusy] = useState(false)
  const [scrubVal, setScrubVal] = useState(0)

  const a = APPS[host]

  useEffect(() => {
    if (summary) setScrubVal(Math.round((summary.progress ?? 0) * 1000))
  }, [summary?.progress])

  const loadView = useCallback(async () => {
    if (!summary || !activeSlot) return
    try {
      const r = await fetch(`/v1/demo/sessions/${summary.id}/flights/${activeSlot.key}`)
      if (r.ok) {
        const d = await r.json()
        setView(d.view)
      }
    } catch {
      /* polled on interval */
    }
  }, [summary?.id, activeSlot?.key])

  useEffect(() => {
    loadView()
    if (!summary || !activeSlot) return
    const t = window.setInterval(() => {
      if (!document.hidden) loadView()
    }, 1800)
    return () => window.clearInterval(t)
  }, [loadView, summary?.id, activeSlot?.key, summary?.now])

  const chooseHost = (h: Host) => {
    setHost(h)
    setSelectedKey(null)
    const u = new URL(location.href)
    u.searchParams.set('app', h)
    history.replaceState(null, '', u)
  }

  const triggerAction = async (action: 'airline_claims_weather' | 'generate_packet' | 'submit_claim' | 'escalate_regulator') => {
    if (!summary || !activeSlot) return
    setActionBusy(true)
    try {
      const r = await fetch(`/v1/demo/sessions/${summary.id}/flights/${activeSlot.key}/actions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, locale: 'en-IN' }),
      })
      if (r.ok) {
        const data = await r.json()
        setView(data.view)
        if (action === 'airline_claims_weather' || data.view?.radar_flash) {
          setRadarFlashKey((k) => k + 1)
          setTab('audit')
        }
      }
    } finally {
      setActionBusy(false)
    }
  }

  const timerRef = useRef<number | null>(null)
  const onScrub = (nextMilli: number) => {
    setScrubVal(nextMilli)
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      advance({ progress: nextMilli / 1000 })
    }, 90)
  }

  const currentBeatIdx = Math.min(
    (summary?.beats.length ?? 1) - 1,
    Math.round(((scrubVal / 1000) * Math.max(1, (summary?.beats.length ?? 1) - 1))),
  )

  return (
    <main id="main" className="demos">
      <header className="demos-head frame">
        <div>
          <h1 className="display">Live Radar &amp; Statutory Payout Demo</h1>
          <p className="lead">
            Inspect IndiGo, Delta, and British Airways concept replicas. Scrub the flight timeline from inbound rotation to pushback,
            then click <b>Airline claims weather</b> to flash ADS-B radar, expose the true root cause, and seal the payout packet.
          </p>
        </div>
        <div className="app-switch" role="tablist" aria-label="Airline replica">
          {(Object.keys(APPS) as Host[]).map((k) => (
            <button key={k} role="tab" aria-selected={host === k} onClick={() => chooseHost(k)}>
              <span className="app-name">{APPS[k].brand}</span>
              <span className="app-kind">{APPS[k].kind}</span>
            </button>
          ))}
        </div>
      </header>

      <div className="frame demo2">
        <figure className="d2-phone">
          <AnimatePresence mode="wait">
            <motion.div
              key={host}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <Screen
                src={summary && activeSlot ? `${a.src}?session=${summary.id}&flight=${activeSlot.key}` : null}
                title={`${a.brand} passenger app replica with AIRTRUTH`}
                empty={failed ? (
                  <>
                    <p>Demo API did not respond.</p>
                    <button className="btn sm" onClick={() => restart()}><RotateCcw size={14} aria-hidden="true" />Retry session</button>
                  </>
                ) : (
                  <>
                    <span className="who think"><i />AIRTRUTH</span>
                    <p>Booting live ADS-B telemetry for {a.brand}…</p>
                  </>
                )}
              />
            </motion.div>
          </AnimatePresence>
          <figcaption>Concept airline app replica · not affiliated with {a.brand}</figcaption>
        </figure>

        <div className="d2-side">
          <div className="d2-block">
            <p className="d2-label">1 · Select disrupted flight &amp; tail number</p>
            <div className="d2-causes" role="tablist" aria-label="Flight scenario">
              {summary ? flights.map((f) => (
                <button key={f.key} role="tab" aria-selected={activeSlot?.key === f.key} onClick={() => setSelectedKey(f.key)}>
                  {f.flight_code} · {f.tail_number} ({f.detector ?? f.title})
                </button>
              )) : [150, 175].map((w, i) => <span key={i} className="d2-skel" style={{ width: w }} aria-hidden="true" />)}
            </div>
          </div>

          <div className="d2-block">
            <div className="d2-clockrow">
              <p className="d2-label">2 · Scrub live flight timeline</p>
              <span className="d2-now num">{summary ? `${fmtDay(summary.now)}, ${fmtTime(summary.now)}` : '…'}</span>
            </div>
            <div className="d2-scrub">
              <input
                type="range"
                className="d2-range"
                min={0}
                max={1000}
                value={scrubVal}
                disabled={!summary}
                aria-label="Scrub flight timeline from scheduled inbound leg to gate pushback"
                onChange={(e) => onScrub(Number(e.target.value))}
              />
              {summary && (
                <div className="d2-beats">
                  {summary.beats.map((b, idx) => (
                    <button
                      key={b.id}
                      aria-current={idx === currentBeatIdx ? 'step' : undefined}
                      disabled={busy}
                      onClick={() => advance({ beat: idx })}
                    >
                      {b.label} ({b.offset})
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="d2-actions">
              <button
                className="btn sm"
                disabled={!summary || !activeSlot || actionBusy}
                onClick={() => triggerAction('airline_claims_weather')}
              >
                <Radar size={15} aria-hidden="true" />
                Airline claims weather
              </button>
              {view?.claim_packet && (
                <button
                  className="btn sm ghost"
                  disabled={actionBusy}
                  onClick={() => triggerAction('submit_claim')}
                >
                  <FileCheck2 size={15} aria-hidden="true" />
                  File {view.claim_packet.amount_display} claim
                </button>
              )}
              <button className="text-btn" onClick={() => { setSelectedKey(null); restart() }}>
                <RotateCcw size={13} aria-hidden="true" />Reset timeline
              </button>
            </div>
          </div>

          {(view?.radar_flash || view?.excuse_state === 'rebutted' || view?.excuse_state === 'verified') && (
            <div key={radarFlashKey} className={`radar-banner ${radarFlashKey > 0 || view?.radar_flash ? 'flash' : ''}`} role="status">
              <div className="radar-banner-top">
                <span>RADAR LOG FLASHED · EXCUSE REBUTTED ({view.excuse_state.toUpperCase()})</span>
                <span>{view.tail_number} · {view.flight_code}</span>
              </div>
              <p>
                <b>True root cause: {view.root_cause.title}.</b> {view.root_cause.detail}
                {view.runway_ops ? ` · ${view.runway_ops.other_departures_count} other flights departed ${view.runway_ops.airport} ${view.runway_ops.runway}.` : ''}
              </p>
            </div>
          )}

          <section className="d2-panel" aria-label="AIRTRUTH radar and packet inspector">
            <div className="panel-tabs" role="tablist">
              <button role="tab" aria-selected={tab === 'audit'} onClick={() => setTab('audit')}><Radar size={14} aria-hidden="true" />Audit &amp; Signed Packet</button>
              <button role="tab" aria-selected={tab === 'ask'} onClick={() => setTab('ask')}><MessageSquare size={14} aria-hidden="true" />Ask Truth Engine</button>
              <button role="tab" aria-selected={tab === 'hooks'} onClick={() => setTab('hooks')}><Webhook size={14} aria-hidden="true" />Webhooks</button>
              <button role="tab" aria-selected={tab === 'wiring'} onClick={() => setTab('wiring')}><Wrench size={14} aria-hidden="true" />API &amp; Payload</button>
            </div>
            <div className="d2-body">
              {tab === 'audit' && summary && activeSlot && (
                <AuditAndPacket
                  view={view}
                  onClaimsWeather={() => triggerAction('airline_claims_weather')}
                  onEscalate={() => triggerAction('escalate_regulator')}
                />
              )}
              {tab === 'ask' && summary && activeSlot && (
                <Ask session={summary.id} flight={activeSlot} now={summary.now} defaultPrompt={a.defaultPrompt} />
              )}
              {tab === 'hooks' && summary && <Hooks session={summary.id} />}
              {tab === 'wiring' && (
                <div className="wiring">
                  <dl>
                    <div><dt>Slot</dt><dd>{a.slot}</dd></div>
                    <div><dt>Variant</dt><dd><code>{a.variant}</code> · theme <code>{host}</code></dd></div>
                    <div><dt>Mode</dt><dd>{a.mode}</dd></div>
                    <div><dt>Events</dt><dd>Emits <code>airtruth:action</code>, <code>airtruth:packet</code> &amp; <code>airtruth:update</code></dd></div>
                  </dl>
                  <CodeBlock tabs={[{ label: a.mode, file: `${host}.tsx`, lang: a.lang, code: a.code }]} />
                </div>
              )}
              {!summary && (
                <p className="d2-muted">{failed ? 'Start engine locally or retry session above.' : 'Connecting to AIRTRUTH engine…'}</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

function AuditAndPacket({
  view,
  onClaimsWeather,
  onEscalate,
}: {
  view: FlightView | null
  onClaimsWeather: () => void
  onEscalate: () => void
}) {
  const [copiedSig, setCopiedSig] = useState(false)
  if (!view) return <p className="d2-muted">Loading telemetry bundle…</p>

  const copyPacket = () => {
    if (!view.claim_packet) return
    navigator.clipboard?.writeText(JSON.stringify(view.claim_packet, null, 2)).then(() => {
      setCopiedSig(true)
      window.setTimeout(() => setCopiedSig(false), 1600)
    })
  }

  const downloadPacket = () => {
    if (!view.claim_packet) return
    const blob = new Blob([JSON.stringify(view.claim_packet, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${view.claim_packet.packet_id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="case3">
      <div className="ev-grid">
        <div className="ev-card">
          <span>METAR Weather</span>
          <b>{view.metar ? `${view.metar.visibility_m}m · ${view.metar.flyable ? 'VMC FLYABLE' : 'IMC'}` : 'Nominal'}</b>
          <small>{view.metar?.raw ?? 'Awaiting station report'}</small>
        </div>
        <div className="ev-card">
          <span>Runway Peer Traffic</span>
          <b>{view.runway_ops ? `${view.runway_ops.other_departures_count} departures` : 'Open'}</b>
          <small>{view.runway_ops ? `${view.runway_ops.runway} · GDP ${view.runway_ops.gdp_active ? 'Active' : 'None'}` : 'No slot closures'}</small>
        </div>
        <div className="ev-card">
          <span>Crew FDTL / Status</span>
          <b>{view.crew_duty ? `${view.crew_duty.duty_hours_logged}h / ${view.crew_duty.max_fdtl_hours}h` : `+${view.delay_minutes} min`}</b>
          <small>{view.crew_duty?.summary ?? view.statute}</small>
        </div>
      </div>

      {view.rotation_legs.length > 0 && (
        <div>
          <p className="d2-label" style={{ marginBottom: 8 }}>Tail-Number Chaining · {view.tail_number} prior rotation legs</p>
          <table className="legs-tbl">
            <thead>
              <tr><th>Leg</th><th>Sector</th><th>Slip</th><th>ADS-B Cause</th></tr>
            </thead>
            <tbody>
              {view.rotation_legs.map((leg) => (
                <tr key={leg.leg_index} className={leg.delay_min >= 30 ? 'late' : ''}>
                  <td className="num">#{leg.leg_index} {leg.flight_code}</td>
                  <td>{leg.route}</td>
                  <td className="num">+{leg.delay_min}m</td>
                  <td>{leg.summary ?? leg.cause ?? 'On schedule'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view.claim_packet ? (
        <div className="packet-box">
          <div className="packet-head">
            <div>
              <span className="label" style={{ color: '#b9b5ff' }}>{view.claim_packet.statute}</span>
              <div><b>Packet {view.claim_packet.packet_id}</b></div>
            </div>
            <div className="packet-amt num">{view.claim_packet.amount_display}</div>
          </div>
          <p style={{ fontSize: 13.5, color: '#d7dbe4', lineHeight: 1.5 }}>
            <b>Contradiction:</b> {view.claim_packet.airline_excuse}<br />
            <b>Verified Cause:</b> {view.claim_packet.true_root_cause}
          </p>
          <div className="packet-sig">SHA-256: {view.claim_packet.signature_sha256}</div>
          <div className="packet-coords">
            {view.claim_packet.signed_adsb_coordinates.map((c, idx) => (
              <div className="packet-coord" key={`${c.at}-${idx}`}>
                <span>{c.airport ?? 'ENR'} · {c.alt_ft}ft</span>
                <span>{c.lat.toFixed(4)}, {c.lon.toFixed(4)} · {c.phase ?? 'adsb'}</span>
                <em>{c.coord_sig.slice(0, 22)}…</em>
              </div>
            ))}
          </div>
          <div className="packet-btns">
            <button className="btn sm" onClick={downloadPacket}><Download size={14} aria-hidden="true" />Download Claim Packet (.json)</button>
            <button className="btn sm ghost" style={{ color: '#fff', borderColor: 'rgb(255 255 255 / .3)' }} onClick={copyPacket}>
              {copiedSig ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              {copiedSig ? 'Copied JSON' : 'Copy Signed JSON'}
            </button>
            <button className="btn sm ghost" style={{ color: '#c9c4ff', borderColor: 'rgb(201 196 255 / .3)' }} onClick={onEscalate}>
              Escalate to {view.claim_packet.regulator.split(' ')[0]}
            </button>
          </div>
        </div>
      ) : (
        <div className="case3-res">
          <div className="case3-top">
            <b>Claim Packet Ready on Weather Claim</b>
            <span className="chip human">Await excuse trigger</span>
          </div>
          <p className="d2-muted">Scrub forward or click <b>Airline claims weather</b> to flash radar, contradict the exemption, and seal signed ADS-B coordinates.</p>
          <button className="btn sm" onClick={onClaimsWeather}>
            <AlertTriangle size={14} aria-hidden="true" />Trigger “Airline claims weather”
          </button>
        </div>
      )}

      {view.timeline.length > 0 && (
        <ol className="case3-tl">
          {view.timeline.slice(-5).reverse().map((ev, idx) => (
            <li key={`${ev.at}-${idx}`}>
              <time className="num">{fmtWhen(ev.at, view.now)}</time>
              <span>{ev.text}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function Ask({ session, flight, defaultPrompt }: { session: string; flight: FlightSlot; now: string; defaultPrompt: string }) {
  const [turns, setTurns] = useState<{ q: string; reply: Answer | null; error?: string }[]>([])
  const [text, setText] = useState(defaultPrompt)
  const [busy, setBusy] = useState(false)
  useEffect(() => { setTurns([]); setText(defaultPrompt) }, [flight.key, session, defaultPrompt])

  const send = async (q: string) => {
    const prompt = q.trim()
    if (!prompt || busy) return
    setText('')
    setBusy(true)
    setTurns((t) => [...t, { q: prompt, reply: null }])
    try {
      const r = await fetch(`/v1/demo/sessions/${session}/flights/${flight.key}/ask`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: prompt, locale: 'en-IN' }),
      })
      const reply = r.ok ? (await r.json() as Answer) : null
      setTurns((t) => t.map((x, idx) => (idx === t.length - 1 ? { ...x, reply, error: r.ok ? undefined : 'Engine unavailable' } : x)))
    } catch {
      setTurns((t) => t.map((x, idx) => (idx === t.length - 1 ? { ...x, error: 'Network error' } : x)))
    } finally {
      setBusy(false)
    }
  }

  const last = turns[turns.length - 1]
  return (
    <div className="ask2">
      <div className="ask-chips">
        {QUESTIONS.map((q) => (
          <button key={q} disabled={busy} onClick={() => send(q)}>{q}</button>
        ))}
      </div>
      <div className="ans-slot">
        {busy && <span className="ans-progress" aria-hidden="true"><i /></span>}
        {last ? (
          <div className="ans">
            <span className="ans-q">Q: {last.q}</span>
            {last.reply ? (
              <>
                <span className="who"><i aria-hidden="true" />AIRTRUTH <em className="ai">· {last.reply.intent}</em></span>
                <p className="ans-head">{last.reply.answer}</p>
                <div className="ans-promise">
                  {last.reply.evidence.map((e) => (
                    <div key={e.label}><dt>{e.label}</dt><dd>{e.value}</dd></div>
                  ))}
                </div>
                <div className="ans-foot">
                  {last.reply.sources.map((s) => <span className="src" key={s}>{s}</span>)}
                </div>
              </>
            ) : (
              <p className="d2-muted">{last.error ?? 'Querying live radar and METAR feeds…'}</p>
            )}
          </div>
        ) : (
          <div className="ans"><p className="d2-muted">Ask anything about <b>{flight.flight_code} ({flight.tail_number})</b> — replies are grounded strictly in live telemetry.</p></div>
        )}
      </div>
      <form className="ask-input" onSubmit={(e) => { e.preventDefault(); send(text) }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={`Ask about ${flight.flight_code}…`} />
        <button type="submit" disabled={busy || !text.trim()} aria-label="Ask truth engine"><Send size={16} aria-hidden="true" /></button>
      </form>
    </div>
  )
}

function Hooks({ session }: { session: string }) {
  const [rows, setRows] = useState<{ type?: string; event?: string; at?: string; data?: unknown }[] | null>(null)
  const [open, setOpen] = useState(0)
  useEffect(() => {
    const load = () => fetch(`/v1/demo/sessions/${session}/webhooks`).then((r) => (r.ok ? r.json() : [])).then((x) => setRows(Array.isArray(x) ? x : x.events ?? [])).catch(() => setRows([]))
    load()
    const t = window.setInterval(load, 2000)
    return () => window.clearInterval(t)
  }, [session])

  if (!rows) return <p className="d2-muted">Loading webhook feed…</p>
  if (!rows.length) return <p className="d2-muted">No webhooks fired yet. Click <b>Airline claims weather</b> or scrub timeline events.</p>
  const list = rows.slice(0, 6)
  return (
    <div className="hooks2">
      <ul>
        {list.map((h, i) => (
          <li key={i}>
            <button aria-pressed={open === i} onClick={() => setOpen(i)}>
              <code>{h.type ?? h.event}</code>
              {h.at && <time>{fmtTime(h.at)}</time>}
            </button>
          </li>
        ))}
      </ul>
      {list[open] && <CodeBlock tabs={[{ label: 'payload', file: 'POST /your/webhook', lang: 'json', code: JSON.stringify(list[open].data ?? list[open], null, 2).slice(0, 1400) }]} />}
    </div>
  )
}

function Screen({ src, title, empty }: { src: string | null; title: string; empty?: React.ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.86)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / 390))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div className="device">
      <div className="screen" ref={box} style={{ height: 844 * scale }}>
        {src ? <iframe key={src} title={title} src={src} style={{ transform: `scale(${scale})` }} /> : <div className="screen-empty" role="status">{empty}</div>}
      </div>
    </div>
  )
}
