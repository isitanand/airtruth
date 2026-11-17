import { PageHead } from '../parts/PageHead'
import { Cols } from '../parts/ShellChrome'

const FACTS: [string, string][] = [
  ['SHA-256 coords', 'Every Mode-S ADS-B coordinate fix and rotation leg is cryptographically sealed into the claim packet.'],
  ['Zero carrier lock-in', 'Operates purely on public transponder feeds, NOAA/IMD METAR reports, and airport slot logs — even without carrier API cooperation.'],
  ['Stateless verification', 'Demo and claim verification logs expire automatically and keep no passenger PII beyond ticket route & claim ID.'],
  ['Deterministic charters', 'Statutory remedies (EU261 €250–€600 cash compensation, US DOT 14 CFR Part 260 mandatory cash refunds, and DGCA ₹5k–₹10k rules) follow exact statutory statute text without LLM hallucination.'],
]

const SECTIONS: [string, string, string][] = [
  ['Public telemetry ingestion', 'ADS-B, METAR & runway logs',
   'AirTruth cross-references aircraft hex ICAO24 broadcasts against airport meteorological reports (METAR/TAF) and runway movement logs. Because airframe position and runway departures are public safety broadcasts, airlines cannot retroactively scrub prior delays.'],
  ['Tamper-evident claim packets', 'Signed ADS-B flight coordinates',
   'Each generated statutory claim packet includes raw Mode-S coordinates (lat, lon, altitude, UTC timestamp), ICAO24 transponder hex, 4-leg rotation delays, and deterministic SHA-256 coordinate seals verified by AirTruth.'],
  ['Regulated passenger data', 'Minimization by default',
   'Optional PNR / booking references entered during escalation never train external models and can be cleared immediately after exporting your signed JSON / claim filing packet.'],
]

export function Privacy() {
  return (
    <main id="main">
      <PageHead label={<><b>Privacy &amp; Signing</b> · verification standard</>} title="Zero blind trust."
        lead="How AIRTRUTH collects public aviation telemetry, signs ADS-B coordinates, and keeps statutory claim verification tamper-evident." />
      <section className="sec"><div className="frame"><Cols />
        <div className="sec-in priv">
          <ul className="priv-facts">
            {FACTS.map(([k, v]) => <li key={k}><b>{k}</b><span>{v}</span></li>)}
          </ul>
          <div className="priv-body">
            {SECTIONS.map(([label, title, body], i) => (
              <section key={title} className="dseg">
                <div className="dseg-head">
                  <span className="dseg-n num">{String(i + 1).padStart(2, '0')}</span>
                  <div className="dseg-title">
                    <span className="label">{label}</span>
                    <h2>{title}</h2>
                  </div>
                </div>
                <div className="dseg-body doc-md"><p>{body}</p></div>
              </section>
            ))}
          </div>
        </div>
      </div></section>
    </main>
  )
}
