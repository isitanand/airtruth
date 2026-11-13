import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'

interface Scene {
  id: string
  tab: string
  header: string
  excuse: string
  verdict: string
  sub: string
  nodes: [string, string, string]
  stat1Label: string
  stat1Val: string
  stat2Label: string
  stat2Val: string
  stat3Label: string
  stat3Val: string
  source: string
}

const SCENES: Scene[] = [
  {
    id: 'chain',
    tab: 'Plane History · VT-IFU',
    header: '6E-214 · DEL → BLR',
    excuse: '"Why was our flight delayed? IndiGo texted it’s bad weather in Delhi."',
    verdict: 'Not weather. This plane had a crew duty timeout in Mumbai 6 hours earlier.',
    sub: 'Its earlier Pune→Mumbai flight hit the 12-hour pilot limit with no standby crew—long before any weather.',
    nodes: ['BOM · Crew Limit', 'AMD · +160m late', 'DEL Gate B42'],
    stat1Label: 'EARLIER LEGS LATE',
    stat1Val: '4 flights',
    stat2Label: 'SAME RUNWAY',
    stat2Val: '8 takeoffs',
    stat3Label: 'INDIA PAYOUT',
    stat3Val: '₹10,000',
    source: 'Live Flight Radar · Delhi Weather (6 km clear) · Pilot Duty Log',
  },
  {
    id: 'weather',
    tab: 'Weather Check · Heathrow',
    header: 'BA-117 · LHR → JFK',
    excuse: '"British Airways refused €600 claiming Heathrow weather was too bad to fly."',
    verdict: 'Weather excuse disproven. 8 other jets took off from Heathrow at that same hour.',
    sub: 'Official airport weather showed 8 km clear visibility while the plane waited for a late seal repair in Dubai.',
    nodes: ['DXB · Repair +160m', 'Clear Skies · 8 km', '8 Jets Took Off'],
    stat1Label: 'SAME RUNWAY',
    stat1Val: '8 flights',
    stat2Label: 'VISIBILITY',
    stat2Val: '8,000 m',
    stat3Label: 'UK / EU PAYOUT',
    stat3Val: '€600',
    source: 'UK Airport Weather (Clear) · Runway Log · Radar Track',
  },
  {
    id: 'crew',
    tab: 'Crew & Air Traffic · JFK',
    header: 'DL-418 · JFK → LAX',
    excuse: '"Delta listed Air Traffic Control delay — are passengers eligible for a payout?"',
    verdict: 'No FAA Air Traffic hold was active. This plane already ran late out of Boston.',
    sub: 'An earlier starter repair in Boston + pilot rest limit pushed arrival over the 3-hour US cash rule.',
    nodes: ['BOS · +80m Repair', 'ORD→DTW +165m', 'No Air Traffic Hold'],
    stat1Label: 'AIR TRAFFIC HOLD',
    stat1Val: 'None active',
    stat2Label: 'PRIOR CHAIN',
    stat2Val: '3h 20m late',
    stat3Label: 'US PAYOUT',
    stat3Val: '$650',
    source: 'US Air Traffic Log · JFK Runway Departures · Live Radar',
  },
]

const EASE = [0.22, 1, 0.36, 1] as const

export function FlightPreview() {
  const [idx, setIdx] = useState(0)
  const reduce = useReducedMotion()

  useEffect(() => {
    const t = window.setInterval(() => setIdx((i) => (i + 1) % SCENES.length), 6000)
    return () => window.clearInterval(t)
  }, [])

  const s = SCENES[idx]

  return (
    <div className="card-stack">
      <div className="answer" role="region" aria-label="Live aviation delay truth preview">
        <div className="a-head">
          <span className="label"><b>{s.header}</b> · LIVE DELAY CHECK</span>
          <span className="label">VERIFIED PROOF</span>
        </div>

        <div className="a-q">
          <p>{s.excuse}</p>
        </div>

        <motion.div
          key={s.id}
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="a-body"
        >
          <span className="who"><i aria-hidden="true" />AIRTRUTH FINDING</span>
          <p><b>{s.verdict}</b> {s.sub}</p>
        </motion.div>

        <div className="route">
          <svg viewBox="0 0 460 104" aria-hidden="true">
            <line x1="46" y1="56" x2="414" y2="56" stroke="#c8cdd6" strokeWidth="2" strokeDasharray="5 5" />
            <circle cx="46" cy="56" r="6" fill="#0b0f17" />
            <circle cx="230" cy="56" r="6" fill="#3a2bff" />
            <circle cx="414" cy="56" r="7" fill="#b3243f" />
            <text x="20" y="34" textAnchor="start" fontSize="12" fontWeight="600" fill="#252b36" style={{ fontFamily: 'var(--sans)', letterSpacing: '-0.01em' }}>{s.nodes[0]}</text>
            <text x="230" y="34" textAnchor="middle" fontSize="12" fontWeight="600" fill="#3a2bff" style={{ fontFamily: 'var(--sans)', letterSpacing: '-0.01em' }}>{s.nodes[1]}</text>
            <text x="440" y="34" textAnchor="end" fontSize="12" fontWeight="700" fill="#b3243f" style={{ fontFamily: 'var(--sans)', letterSpacing: '-0.01em' }}>{s.nodes[2]}</text>
            <text x="20" y="86" fontSize="10" fontWeight="500" fill="#555c6a" style={{ fontFamily: 'var(--mono)', letterSpacing: '0.12em' }}>FLIGHT RADAR + AIRPORT WEATHER + TAKEOFF LOGS</text>
          </svg>
        </div>

        <div className="eta">
          <div><span className="label">{s.stat1Label}</span><b>{s.stat1Val}</b></div>
          <div><span className="label">{s.stat2Label}</span><b>{s.stat2Val}</b></div>
          <div><span className="label">{s.stat3Label}</span><b className="acc">{s.stat3Val}</b></div>
        </div>

        <div className="a-src">
          <span className="label">PROVEN FROM: <b>{s.source}</b></span>
        </div>
      </div>

      <div className="causes" role="tablist" aria-label="Switch aviation lie detector scenario">
        {SCENES.map((item, k) => (
          <button key={item.id} role="tab" aria-selected={k === idx} onClick={() => setIdx(k)}>
            {item.tab}
          </button>
        ))}
      </div>
    </div>
  )
}
