import { useEffect, useMemo, useRef, useState } from 'react'
import { DOCS } from '../docs'
import { Cols } from '../parts/ShellChrome'
import { DitherShader } from '../parts/DitherShader'
import { CodeBlock, type Snippet } from '../parts/Code'

const GROUPS: [string, [string, string][]][] = [
  ['Passenger Rights & API', [
    ['api-reference', 'Public Audit API & SHA-256'],
    ['config-reference', 'Statutory Charters & Rules'],
    ['webhooks', 'Webhook Verification'],
  ]],
]

const ALL = GROUPS.flatMap(([, items]) => items)

interface Part { kind: 'md' | 'code'; text: string; lang?: string; file?: string; tabs?: Snippet[] }

function parse(src: string): { title: string; intro: string; sections: { heading: string; id: string; parts: Part[] }[] } {
  const lines = src.replace(/\r\n/g, '\n').split('\n')
  let title = ''
  const pre: string[] = []
  const sections: { heading: string; id: string; body: string[] }[] = []
  for (const line of lines) {
    if (!title && line.startsWith('# ')) { title = line.slice(2).trim(); continue }
    if (line.startsWith('## ')) {
      const h = line.slice(3).trim()
      sections.push({ heading: h, id: h.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), body: [] })
      continue
    }
    if (sections.length) sections[sections.length - 1].body.push(line)
    else pre.push(line)
  }

  const chunk = (raw: string[]): Part[] => {
    const out: Part[] = []
    let md: string[] = []
    let i = 0
    while (i < raw.length) {
      const l = raw[i]
      if (l.startsWith('```')) {
        if (md.length) { out.push({ kind: 'md', text: md.join('\n') }); md = [] }
        const info = l.slice(3).trim().split(/\s+/)
        const lang = info[0] || 'text'
        const file = info.slice(1).join(' ') || undefined
        const code: string[] = []
        i++
        while (i < raw.length && !raw[i].startsWith('```')) { code.push(raw[i]); i++ }
        const snip: Snippet = { label: file || lang.toUpperCase(), code: code.join('\n'), lang, file }
        const prev = out[out.length - 1]
        if (prev?.kind === 'code' && !md.length && prev.tabs && prev.tabs.length < 4) prev.tabs.push(snip)
        else out.push({ kind: 'code', text: code.join('\n'), lang, file, tabs: [snip] })
        i++
        continue
      }
      md.push(l)
      i++
    }
    if (md.length) out.push({ kind: 'md', text: md.join('\n') })
    return out
  }

  return {
    title,
    intro: pre.join('\n').trim(),
    sections: sections.map((s) => ({ heading: s.heading, id: s.id, parts: chunk(s.body) })),
  }
}

function Md({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/)
  return (
    <>
      {blocks.map((b, i) => {
        if (b.startsWith('- ')) {
          return <ul key={i}>{b.split('\n').map((li, k) => <li key={k}>{inline(li.replace(/^[-*]\s+/, ''))}</li>)}</ul>
        }
        return <p key={i}>{inline(b.replace(/\n/g, ' '))}</p>
      })}
    </>
  )
}

function inline(s: string) {
  return s.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
    return part
  })
}

export function Docs({ slug = 'api-reference' }: { slug?: string }) {
  const cur = DOCS[slug] ? slug : 'api-reference'
  const doc = useMemo(() => parse(DOCS[cur] ?? '# Passenger Rights & Public Audit API\n\nPublic flight audit and statutory charter reference.'), [cur])
  const idx = ALL.findIndex(([k]) => k === cur)
  const prev = idx > 0 ? ALL[idx - 1] : null
  const next = idx < ALL.length - 1 ? ALL[idx + 1] : null
  const [active, setActive] = useState(doc.sections[0]?.id ?? '')
  const navRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setActive(doc.sections[0]?.id ?? '') }, [cur, doc])

  return (
    <main id="main" className="docs-shell">
      <div className="page-head">
        <DitherShader cell={3} scale={180} bias={-.05} rise={.5} />
        <div className="frame"><Cols />
          <div className="page-head-in">
            <span className="label"><b>Reference</b> · Public Audit API &amp; Charters</span>
            <h1 className="display enter">{doc.title}</h1>
            {doc.intro && <p className="lead enter d2">{inline(doc.intro)}</p>}
          </div>
        </div>
      </div>

      <section className="sec"><div className="frame"><Cols />
        <div className="docs3">
          <aside className="dnav" ref={navRef}>
            {GROUPS.map(([group, items]) => (
              <div key={group} className="dnav-group">
                <span className="dnav-title">{group}</span>
                <ul>
                  {items.map(([k, lbl]) => (
                    <li key={k}><a href={`/docs/${k}`} aria-current={k === cur ? 'page' : undefined}>{lbl}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </aside>

          <article className="dmain">
            {doc.sections.map((s, si) => (
              <section key={s.id} id={s.id} className="dseg">
                <div className="dseg-head">
                  <span className="dseg-n num">{String(si + 1).padStart(2, '0')}</span>
                  <h2>{s.heading}</h2>
                </div>
                <div className="dseg-body doc-md">
                  {s.parts.map((part, pi) =>
                    part.kind === 'code' && part.tabs
                      ? <CodeBlock key={pi} tabs={part.tabs} />
                      : <Md key={pi} text={part.text} />,
                  )}
                </div>
              </section>
            ))}

            <div className="dpager">
              {prev ? <a href={`/docs/${prev[0]}`}><span>Previous</span><b>← {prev[1]}</b></a> : <span />}
              {next ? <a className="nx" href={`/docs/${next[0]}`}><span>Next</span><b>{next[1]} →</b></a> : <span />}
            </div>
          </article>

          {doc.sections.length > 0 && (
            <aside className="dtoc" aria-label="On this page">
              <span className="dnav-title">On this page</span>
              {doc.sections.map((s) => (
                <a key={s.id} href={`#${s.id}`} aria-current={active === s.id ? 'true' : undefined} onClick={() => setActive(s.id)}>{s.heading}</a>
              ))}
            </aside>
          )}
        </div>
      </div></section>
    </main>
  )
}
