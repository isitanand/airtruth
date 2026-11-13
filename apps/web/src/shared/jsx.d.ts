import type { DetailedHTMLProps, HTMLAttributes } from 'react'

type AirTruthFlightProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  session?: string
  flight?: string
  variant?: 'flight-row' | 'flight-card' | 'claim-screen'
  theme?: string
  api?: string
  locale?: 'en-IN' | 'hi-Latn-IN'
}

declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'airtruth-flight': AirTruthFlightProps
    }
  }
}
