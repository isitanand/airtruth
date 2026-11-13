# Policy & Statutory Charters

Configure deterministic charter rules per carrier tenant via PUT /v1/config.

## Supported Statutory Regimes

- **EU261 / UK261 (eu261)**: Regulation (EC) No 261/2004 & UK261 (€250 ≤1500km, €400 1500–3500km, €600 >3500km at ≥3h arrival delay or unexcused cancellation).
- **US DOT (us_dot)**: US DOT 14 CFR Part 259 & Part 260 Automatic Cash Refund & 3h Tarmac Protection ($400–$650 tiers).
- **India DGCA (dgca)**: Indian DGCA CAR Section 3, Series M Part IV (₹5,000–₹10,000 tiers, 90m tarmac alert, AirSewa escalation).

## Tenant Configuration Payload

```json JSON
{
  "policy": {
    "auto_issue_packet_on_rebuttal": true,
    "instant_rebuttal_min_departures": 3,
    "min_prior_leg_delay_minutes": 30,
    "auto_escalate_overdue_days": 7
  },
  "webhook_url": "https://claims.example.com/webhooks/airtruth"
}
```
