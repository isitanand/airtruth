import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Cols } from './ShellChrome'
import { DitherShader } from './DitherShader'

// The head of every inner page. Its entrance is CSS (.enter), so it paints with the HTML, before any script runs.
export function PageHead({ back, label, title, lead, children }: {
  back?: { href: string; label: string }
  label?: ReactNode
  title: ReactNode
  lead?: ReactNode
  children?: ReactNode
}) {
  return (
    <section className="page-head">
      <DitherShader cell={3} scale={170} bias={-.1} rise={.55} />
      <div className="frame"><Cols />
        <div className="page-head-in">
          {back && <a className="back" href={back.href}><ArrowLeft size={14} aria-hidden="true" />{back.label}</a>}
          {!back && label && <p className="label enter">{label}</p>}
          <h1 className="display enter">{title}</h1>
          {lead && <p className="lead enter d2">{lead}</p>}
          {children}
        </div>
      </div>
    </section>
  )
}
