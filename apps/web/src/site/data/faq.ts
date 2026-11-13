export const FAQ: [string, string][] = [
  ['How does AirTruth prove a weather excuse is false?',
   'It fuses four live aviation streams on every flight: the specific tail number’s prior 4 rotation legs from ADS-B, airport METAR visibility/ceiling observations, parallel runway departures showing how many jets took off cleanly in the same window, and FAA/DGCA Ground Delay Program logs.'],
  ['What makes Tail-Number Chaining legally decisive?',
   'Your flight wasn’t delayed by afternoon rain if the assigned airframe—such as VT-IFU—already slipped 3 hours earlier due to a Mumbai crew timeout or turnaround defect. Prior cascading operational delays remain airline-attributable under EU261, UK261, US DOT, and Indian DGCA charters.'],
  ['What is inside the statutory payout claim packet?',
   'A deterministic JSON/docket bundle containing the contradicted excuse, 4-leg rotation timestamps, simultaneous runway departures, raw METAR string, crew FDTL exhaustion log, exact statute calculation (€600 / $650 / ₹10,000), and cryptographically SHA-256 signed ADS-B coordinates.'],
  ['Can airlines or claims platforms embed this or use it directly on the site?',
   'Both. Passengers can enter any flight number directly on this site for instant claim verification, and engineering teams can call the verification API or embed the AirTruth Flight Widget in travel portals to emit signed claim packets automatically.'],
  ['Which passenger compensation laws are supported?',
   'Three complete statutory profiles ship out of the box: EU Regulation 261/2004 (and UK261), US DOT 14 CFR Part 259/260 automatic cash refund & tarmac rules, and India’s DGCA CAR Section 3, Series M Part IV charter.'],
  ['Does AirTruth ever fabricate weather or telemetry facts?',
   'Never. Every claim packet and passenger explanation is deterministically derived from timestamped Mode-S pings, NOAA/IMD METAR reports, and airport slot logs. Any optional language phrasing is strictly checked against the verified record.'],
]
