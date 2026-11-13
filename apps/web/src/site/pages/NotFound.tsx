import { ArrowRight } from 'lucide-react'
import { Cols } from '../parts/ShellChrome'
import { DitherShader } from '../parts/DitherShader'

export function NotFound() {
  return (
    <main id="main" className="nf">
      <DitherShader cell={3} scale={180} bias={-.05} rise={.5} />
      <div className="frame"><Cols />
        <div className="nf-in">
          <p className="label"><b>404</b> · vector off course</p>
          <h1 className="display enter">No transponder.<br />Not here.</h1>
          <p className="lead enter d2">No flight audit or documentation route exists at this URL. Choose a live station below.</p>
          <ul className="nf-links enter d3">
            {[['Home', '/'], ['Check Flight / PNR', '/lookup'], ['Live radar demo', '/demos'], ['Airline audits', '/case-studies']].map(([l, h]) => (
              <li key={h}><a href={h}><span>{l}</span><ArrowRight size={16} aria-hidden="true" /></a></li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  )
}
