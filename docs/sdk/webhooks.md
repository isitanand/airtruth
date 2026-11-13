# Webhooks & Radar Alerts

AirTruth signs every outbound webhook using Standard Webhooks HMAC-SHA256 headers (webhook-id, webhook-timestamp, webhook-signature).

## Emitted Events

- `excuse.rebutted`: Fired the instant AirTruth proves an airline weather/ATC claim is contradicted by tail rotation, METAR, or peer runway departures.
- `flight.audit.updated`: Fired when claim packets are sealed, submitted, or escalated to DGCA AirSewa / US DOT / CAA-NEB.

```python Python
from airtruth_engine.webhooks import verify

verify(webhook_secret, request.headers, await request.body())
```
