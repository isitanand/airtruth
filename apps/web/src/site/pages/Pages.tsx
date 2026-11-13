import { ArrowRight } from 'lucide-react'
import { motion } from 'motion/react'
import { builtBy } from '../content'
import insights from '../data/insights.json'
import { STUDIES, type Slug } from '../data/studies'
import { HBars, Trend } from '../parts/AnalyticsCharts'
import { DitherShader } from '../parts/DitherShader'
import { Reveal } from '../parts/Motion'
import { PageHead } from '../parts/PageHead'
import { Cols, More } from '../parts/ShellChrome'

const EASE = [0.16, 1, 0.3, 1] as const

function StudyCard({ slug, i }: { slug: Slug; i: number }) {
  const s = STUDIES[slug]
  return (
    <motion.a
      className="case-card"
      href={`/case-studies/${slug}`}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 1, ease: EASE, delay: i * 0.1 }}
    >
      <DitherShader className="" cell={3} scale={140} bias={-0.1} rise={0.5} alpha={0.9} />
      <div className="top"><span className="label">Audit {String(i + 1).padStart(2, '0')}</span><span className="label">Read →</span></div>
      <h3>{s.name}</h3>
      <p className="kind">{s.regime}</p>
      <div className="meter">
        <span className="label"><span>Weather claims rebutted</span><span>{s.rebuttedShare}%</span></span>
        <div className="segs">{Array.from({ length: 10 }, (_, k) => <i key={k} className={k < Math.round(s.rebuttedShare / 10) ? 'on' : ''} />)}</div>
      </div>
      <ul>
        {s.claimCats.slice(0, 3).map(([cat, pct]) => (
          <li key={cat}><span>{cat}</span><span>{pct}%</span></li>
        ))}
      </ul>
    </motion.a>
  )
}

export function CaseStudies() {
  return (
    <main id="main">
      <PageHead
        title={<>Three airlines.<br />Three regimes of delay truth.</>}
        lead={`Audited ${insights.auditTotal.toLocaleString('en-IN')} multi-hour disrupted flights across IndiGo (DGCA CAR §3), Delta (US DOT 14 CFR §260), and British Airways (EU261 Art 7). Concept sandboxes — not airline partnerships.`}
      />
      <div className="night">
        <section className="sec">
          <div className="frame"><Cols />
            <div className="sec-in">
              <div className="deck" style={{ marginTop: 0 }}>
                {(['indigo', 'delta', 'ba'] as Slug[]).map((slug, i) => <StudyCard key={slug} slug={slug} i={i} />)}
              </div>
            </div>
          </div>
        </section>
      </div>
      <MethodSection />
    </main>
  )
}

function MethodSection() {
  return (
    <section className="sec">
      <div className="frame"><Cols />
        <div className="sec-in">
          <Reveal className="sec-head">
            <h2 className="h2">Measured on radar. Sealed with cryptography.</h2>
            <p className="lead">Every AirTruth claim packet cross-examines four independent telemetry logs and signs Mode-S coordinates with SHA-256 so airlines cannot dismiss passenger claims with generic boilerplate.</p>
          </Reveal>
          <Reveal className="chart" kind="wipe" style={{ marginBottom: 40 }}>
            <div className="chart-head"><div><h3>Verification accuracy across audited benchmarks</h3><p>Deterministic replay across 1,250 disrupted sectors</p></div></div>
            <HBars rows={insights.accuracy} max={100} />
          </Reveal>
          <div className="contract">
            <Reveal><b>Tail-Number Chaining</b><p>Walks 4 prior sectors of the assigned aircraft registration (<code>VT-IFU</code>, <code>N842DN</code>, <code>G-XWBA</code>) to surface upstream technical or crew slips.</p></Reveal>
            <Reveal delay={0.06}><b>Selective Weather Refutation</b><p>Counts parallel departures on the exact active runway under published METAR visibility ceilings during the disputed delay window.</p></Reveal>
            <Reveal delay={0.12}><b>Deterministic Charters</b><p>Encodes EU Regulation 261/2004, US DOT Part 260, and Indian DGCA CAR distance &amp; time brackets into replayable scenarios: <code>python -m airtruth_engine replay</code>.</p></Reveal>
          </div>
        </div>
      </div>
    </section>
  )
}

export function Method() {
  return (
    <main id="main">
      <PageHead
        back={{ href: '/', label: 'Product home' }}
        title={<>Audit Method &amp;<br />Telemetry Fusion</>}
        lead="How AIRTRUTH joins ADS-B Mode-S flight trajectories, METAR weather reports, runway departure counts, and FDTL crew limits into tamper-evident statutory claim packets."
      />
      <MethodSection />
    </main>
  )
}

export function CaseStudy({ slug }: { slug?: string }) {
  const safeSlug: Slug = slug === 'delta' || slug === 'ba' ? slug : 'indigo'
  const s = STUDIES[safeSlug]
  const others = (['indigo', 'delta', 'ba'] as Slug[]).filter((x) => x !== safeSlug)

  return (
    <main id="main">
      <PageHead back={{ href: '/case-studies', label: 'All carrier audits' }} title={s.name} lead={s.line}>
        <p className="page-note">{s.regime} · {s.statute} · {s.kicker}</p>
      </PageHead>

      <section className="sec">
        <div className="frame"><Cols />
          <div className="sec-in">
            <Reveal className="chart focal" kind="wipe">
              <div className="focal-head">
                <p className="focal-num num">{s.rebuttedShare}<small>%</small></p>
                <div>
                  <h2 className="h3">of {s.name} “bad weather” excuses rebutted on telemetry</h2>
                  <p>{s.claims} audited flights · {s.excuseRate}% originally blamed weather/ATC · Flagship trace: <b>{s.sampleRoute}</b></p>
                </div>
              </div>
              <HBars rows={s.claimCats.map(([label, value]) => ({ label, value }))} max={60} />
              <p className="chart-foot">{s.summary}</p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="frame"><Cols />
          <div className="sec-in">
            <Reveal className="sec-head"><h2 className="h2">Radar findings &amp; monthly rebuttal share</h2></Reveal>
            <Reveal className="chart focal" kind="wipe">
              <div className="chart-head"><div><h3>Rebutted weather exemptions across audited sectors</h3><p>Verified against METAR VMC &amp; parallel runway departures</p></div></div>
              <Trend points={insights.trend} height={280} annotate />
            </Reveal>
            <div className={`contract ${s.takeaways.length === 4 ? 'four' : ''}`} style={{ marginTop: 40 }}>
              {s.takeaways.map((t, i) => <Reveal key={i} delay={i * 0.08}><p>{t}</p></Reveal>)}
            </div>
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="frame"><Cols />
          <div className="sec-in">
            <Reveal className="sec-head"><h2 className="h2">How the statutory contradiction unfolds</h2></Reveal>
            <div className="plays">
              <div className="play play-head"><span className="label">Timeline</span><span className="label">Detector</span><span className="label">Verified Record</span></div>
              {s.plays.map((p, i) => (
                <Reveal className="play" kind="wipe" key={p.rule} delay={i * 0.1}>
                  <b>{p.when}</b>
                  <span>{p.rule}</span>
                  <span className="fix">{p.detail}</span>
                </Reveal>
              ))}
            </div>
            <div className="next">
              <a className="btn" href={`/demos?app=${safeSlug}`}>Open {s.name} live radar demo <ArrowRight size={16} aria-hidden="true" /></a>
              {others.map((o) => <More key={o} href={`/case-studies/${o}`} label={`${STUDIES[o].name} audit`} />)}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export function BuiltBy() {
  return (
    <main id="main">
      <PageHead title="Architecture &amp; Scope" lead={builtBy.meta.summary} />
      <section className="sec">
        <div className="frame"><Cols />
          <div className="sec-in" style={{ paddingTop: 56 }}>
            <article className="prose" dangerouslySetInnerHTML={{ __html: builtBy.html }} />
          </div>
        </div>
      </section>
    </main>
  )
}
