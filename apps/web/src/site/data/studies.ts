export type Slug = 'indigo' | 'delta' | 'ba'

export interface Study {
  name: string
  regime: string
  statute: string
  kicker: string
  line: string
  sampleRoute: string
  summary: string
  claims: number
  excuseRate: number
  rebuttedShare: number
  takeaways: string[]
  plays: { when: string; rule: string; detail: string }[]
  claimCats: [string, number][]
}

export const STUDIES: Record<Slug, Study> = {
  indigo: {
    name: 'IndiGo',
    regime: 'India · Domestic Trunk',
    statute: 'DGCA CAR Section 3, Series M Part IV',
    kicker: 'Tail-Number Chaining + Crew FDTL Audit',
    line: 'VT-IFU slipped 6 hours earlier on a Mumbai crew FDTL timeout — masked behind a "Delhi weather" SMS.',
    sampleRoute: '6E-214 · DEL → BLR',
    summary: 'In high-frequency domestic A320neo rotations, single-airframe crew timeout cascades account for the majority of multi-hour delays labeled "bad weather" or "ATC restriction". AirTruth traces the exact aircraft tail across 4 prior sectors before departure.',
    claims: 420,
    excuseRate: 71.4,
    rebuttedShare: 64.8,
    takeaways: [
      '64.8% of "Bad Weather" exemptions on audited evening trunk routes occurred while ≥8 flights departed the same runway within 45 minutes.',
      'Tail-Number Chaining exposed prior Mumbai/Bengaluru crew timeout delays up to 6 hours before destination weather even started.',
      'Automated DGCA AirSewa packets raised carrier settlement speed and eliminated generic template rejections.',
    ],
    plays: [
      { when: '6h prior (Leg 2)', rule: 'Crew FDTL Limit', detail: 'VT-IFU crew hit 12.2h/12.0h FDTL ceiling at BOM with no standby captain.' },
      { when: '17:35 IST (ETD+2h)', rule: 'Selective Weather', detail: '8 aircraft departed VIDP RWY 28 cleanly under METAR 6000m VMC visibility.' },
      { when: '18:20 IST', rule: 'Weather Claim Rebutted', detail: 'Airline weather SMS contradicted; signed DGCA CAR ₹7,500–₹10,000 packet issued.' },
    ],
    claimCats: [
      ['Tail-Number Chain Masking', 41.2],
      ['Selective Weather (VMC Open)', 23.6],
      ['Crew FDTL Timeout', 18.4],
      ['Unannounced Cancellation', 9.8],
      ['Gate / Tarmac Hold', 7.0],
    ],
  },
  delta: {
    name: 'Delta',
    regime: 'USA · Transcontinental Hub',
    statute: 'US DOT 14 CFR Part 259 & Part 260',
    kicker: 'FAA NAS Ground Delay Cross-Check + FAR 117',
    line: 'N842DN lagged across BOS→ATL→ORD→DTW before JFK even saw clouds — with zero FAA GDP active.',
    sampleRoute: 'DL-418 · JFK → LAX',
    summary: 'US legacy hub-and-spoke fleets frequently cite ambiguous "ATC flow / en-route weather" despite clear local METARs and unthrottled FAA National Airspace System departures. AirTruth audits FAA GDP notices, FAR 117 reserve rosters, and 4 prior sectors.',
    claims: 380,
    excuseRate: 63.0,
    rebuttedShare: 58.2,
    takeaways: [
      'Zero active FAA Ground Delay Program on 58% of transcontinental departures labeled "ATC weather restriction".',
      'FAR 117 reserve crew shortages triggered 3+ hour US DOT Part 260 automatic cash-refund eligibility windows.',
      'Signed Mode-S transponder logs eliminated disputed pushback vs scheduled block timestamps.',
    ],
    plays: [
      { when: '06:35 EST (Leg 1)', rule: 'Inbound Tech Delay', detail: 'N842DN deferred APU valve swap in Boston; +80m slip propagated 4 legs.' },
      { when: '12:15 EST', rule: 'FAA NAS Audit', detail: 'Zero FAA GDP active at KJFK; 8 departures off RWY 22R under FEW045 VMC.' },
      { when: '13:15 EST', rule: 'US DOT Packet Sealed', detail: 'Full 14 CFR §260 cash refund / $650 claim packet sealed with 5 ADS-B fixes.' },
    ],
    claimCats: [
      ['False ATC / Flow Claim', 35.8],
      ['4-Leg Hub Cascade', 29.4],
      ['FAR 117 Crew Expiry', 19.2],
      ['Tarmac Hold > 3h', 9.1],
      ['Denied Boarding / Downgrade', 6.5],
    ],
  },
  ba: {
    name: 'British Airways',
    regime: 'UK/EU · Long-Haul & Short-Haul',
    statute: 'EU Regulation 261/2004 & UK261 Article 5/7',
    kicker: 'Heathrow RWY 27R Slot Proof + €600 Enforcement',
    line: 'BA cited Heathrow fog on BA-117 — while 8 widebodies took off on RWY 27R under 8,000m visibility.',
    sampleRoute: 'BA-117 · LHR → JFK',
    summary: 'European airlines regularly reject initial €250–€600 EC261 claims by invoking "extraordinary weather". Under Wallentin-Hermann and settled CJEU precedent, carriers must prove external impossibility—easily disproved when peer jets take off on the identical runway.',
    claims: 450,
    excuseRate: 74.2,
    rebuttedShare: 68.5,
    takeaways: [
      'Peer-runway comparison at EGLL RWY 27R disproved 68.5% of rejected "fog/wind" EU261 denials.',
      'Cross-referencing OMDB→LHR inbound rotation logs exposed pre-existing technical seals swapped hours prior.',
      'UK CAA / EU NEB escalation rate doubled recovery on previously abandoned €600 long-haul claims.',
    ],
    plays: [
      { when: '04:10 GST (Inbound)', rule: 'Tail Rotation Fault', detail: 'G-XWBA cargo door seal replacement in Dubai left BA-117 160m behind.' },
      { when: '10:20 GMT', rule: 'Selective Weather', detail: 'EGLL METAR 8000m VMC; 8 widebodies (VS-45, AA-107, UA-17...) cleared off 27R.' },
      { when: '11:30 GMT', rule: 'EU261 €600 Sealed', detail: 'Wallentin-Hermann rebuttal packet signed with Heathrow ADS-B coordinates.' },
    ],
    claimCats: [
      ['Selective Weather (RWY Open)', 44.0],
      ['Inbound Long-Haul Knock-On', 26.5],
      ['Tarmac Tow / Gate Tug Hold', 14.3],
      ['Reserve Crew Missing', 9.7],
      ['Connecting Flight Missed', 5.5],
    ],
  },
}
