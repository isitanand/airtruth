# Decision Log · AIRTRUTH

- **Deterministic Charter Amounts & Coordinate Signing**: Legal compensation amounts (`€250/€400/€600`, `$400/$650`, `₹5,000–₹10,000`) and SHA-256 coordinate signatures are never chosen by an LLM. Code computes eligibility and crypto seals first; optional language models only phrase explanations grounded strictly in `FlightSituation`.
- **Forward & Backward Timeline Scrubbing**: Demo sessions use pure projection replay over scenario event lists so `/demos` sliders can move instantaneously to any point between T-6h inbound rotation and final claim packet sealing.
- **Shadow DOM Isolation for Carrier Embeds**: `<airtruth-flight>` encapsulates styles using CSS Custom Properties derived from design tokens (`neutral`, `indigo`, `delta`, `ba`) so carrier host CSS never collides with AirTruth cards.
