import type { CSSProperties } from 'react'

export function Photo({ base, alt, className = '', style }: {
  base: 'tarmac-turnaround' | 'flight-deck-weather'
  sizes?: string
  alt: string
  className?: string
  style?: CSSProperties
  eager?: boolean
}) {
  return (
    <picture>
      <img src={`/site/photo/${base}.jpg`} alt={alt} className={className} style={style} loading="lazy" decoding="async" />
    </picture>
  )
}
