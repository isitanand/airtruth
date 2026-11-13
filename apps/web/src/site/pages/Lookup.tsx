import { FlightLookup } from '../parts/FlightLookup'
import { PageHead } from '../parts/PageHead'

export function Lookup() {
  return (
    <main id="main">
      <PageHead
        back={{ href: '/', label: 'Product home' }}
        title={<>Audit Any Flight.<br />Expose the Excuse.</>}
        lead="Enter your flight number and date—or paste the delay message from your airline. Leave the reason on Not sure or pick what the airline blamed, and AIRTRUTH checks live airport weather, other flights taking off, and passenger compensation rules in plain English."
      />
      <FlightLookup initialQuery="" id="lookup-tool" />
    </main>
  )
}

