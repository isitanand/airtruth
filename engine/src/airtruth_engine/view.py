"""Projection-to-view serializer consumed by the web showcase, demos, hosts, and <airtruth-flight> widget."""
from .commitments import State, derive
from .events import EventType
from .profiles import statutory_amount
from .projection import ExcuseState
from .resolver import build_claim_packet, detect_root_cause, fmt_day


def _label(e) -> tuple[str, str]:
    d = e.data
    if e.type is EventType.FLIGHT_SCHEDULED:
        return "airline", f"Scheduled {d.get('flight_code', e.flight_ref)} ({d.get('route', '')}) · Tail {d.get('tail_number', e.tail_number)}"
    if e.type is EventType.ROTATION_LEG:
        return "adsb", f"Leg {d.get('leg_index')}: {d.get('flight_code')} {d.get('route')} (+{d.get('delay_min', 0)}m){' · ' + d['summary'] if d.get('summary') else ''}"
    if e.type is EventType.CREW_DUTY:
        return "crew", d.get("summary") or f"Crew FDTL {d.get('duty_hours_logged')}h/{d.get('max_fdtl_hours')}h at {d.get('base')}"
    if e.type is EventType.METAR_REPORT:
        return "metar", f"METAR {d.get('station')}: {d.get('raw_metar')} ({'flyable' if d.get('flyable', True) else 'IMC hold'})"
    if e.type is EventType.RUNWAY_LOG:
        return "atc", f"{d.get('airport')} {d.get('runway')}: {d.get('other_departures_count', 0)} departures in window · GDP {'active' if d.get('gdp_active') else 'NONE'}"
    if e.type is EventType.EXCUSE_CLAIMED:
        return "airline", f"Airline invoked {d.get('excuse', 'weather').upper()} exemption: {d.get('message', '')}"
    if e.type is EventType.ADSB_POSITION and e.location:
        return "adsb", f"ADS-B {e.location.tail or e.tail_number} @ ({e.location.lat:.4f}, {e.location.lon:.4f}) · {d.get('phase', 'ping')}"
    if e.type is EventType.DELAY_POSTED:
        return "airline", f"Departure pushed: {d.get('shown', 'Delayed')} (stated: {d.get('stated_reason', 'ops')})"
    if e.type is EventType.PAYOUT_PACKET:
        return "engine", f"Sealed claim packet {d.get('packet_id')} · {d.get('signature_sha256', '')[:20]}…"
    if e.type is EventType.ENGINE_FINDING:
        return "engine", f"▲ {d.get('rule')}: {d.get('message')}"
    if e.status:
        return e.asserted_by.value, f"Status -> {e.status.value.replace('_', ' ')}"
    return e.asserted_by.value, e.type.value


def build_view(s, title: str, resolution: dict | None = None, radar_flash: bool = False) -> dict:
    p = s.p
    cs = derive(p, s.profile, s.now)
    packet = build_claim_packet(s)

    actions: list[dict] = []
    if p.excuse_state is ExcuseState.NONE:
        actions.append({"id": "airline_claims_weather", "label": "Airline claims weather", "primary": True})
    elif p.excuse_state is ExcuseState.CLAIMED:
        actions.append({"id": "challenge_weather", "label": "Verify & rebut weather excuse", "primary": True})
    elif p.excuse_state is ExcuseState.REBUTTED and p.payout.stage != "submitted":
        actions.append({"id": "submit_claim", "label": f"File {s.profile.regime_label} claim", "primary": True})
    if packet and p.excuse_state is not ExcuseState.NONE:
        actions.append({"id": "escalate_regulator", "label": f"Escalate to {s.profile.regulator_name}", "primary": False})

    timeline = []
    for e in s.events:
        if e.type is EventType.ENGINE_RESOLUTION:
            continue
        who, text = _label(e)
        timeline.append({"at": e.occurred_at.isoformat(), "who": who, "text": text, "kind": e.type.value})

    metar = p.latest_metar
    rw = p.latest_runway
    eta_due = p.latest_eta.due_by.isoformat() if p.latest_eta else (p.scheduled_dep.isoformat() if p.scheduled_dep else s.now.isoformat())
    delay_hours = round(p.delay_minutes / 60, 1)

    return {
        "object": "flight",
        "flight_ref": p.flight_ref,
        "flight_code": p.flight_code or p.flight_ref,
        "tail_number": p.tail_number,
        "icao24": p.icao24,
        "aircraft_type": p.aircraft_type,
        "route": p.route,
        "origin_icao": p.origin_icao,
        "dest_icao": p.dest_icao,
        "distance_km": p.distance_km,
        "regime": s.profile.name,
        "regime_label": s.profile.regime_label,
        "statute": s.profile.statute,
        "brand": s.brand,
        "title": title,
        "state": p.reconciled_state.value,
        "excuse_state": p.excuse_state.value,
        "now": s.now.isoformat(),
        "scheduled_dep": p.scheduled_dep.isoformat() if p.scheduled_dep else None,
        "delay_minutes": p.delay_minutes,
        "delay_hours": delay_hours,
        "eta": {
            "due": eta_due,
            "shown": p.latest_eta.shown if p.latest_eta else "On schedule",
            "stated_reason": p.latest_eta.stated_reason if p.latest_eta else None,
            "gate": p.latest_eta.gate if p.latest_eta else "B42",
        },
        "root_cause": {
            "title": s.root_cause_title,
            "detail": s.root_cause_detail,
            "rebutted": p.excuse_state is ExcuseState.REBUTTED,
        },
        "detectors": sorted(s.live),
        "rotation_legs": [
            {
                "leg_index": l.leg_index,
                "flight_code": l.flight_code,
                "route": l.route,
                "sched_dep": l.sched_dep,
                "act_dep": l.act_dep,
                "delay_min": l.delay_min,
                "cause": l.cause,
                "summary": l.summary,
                "coord_sig": l.coord_sig,
            }
            for l in p.rotation_legs
        ],
        "metar": {
            "station": metar.station,
            "raw": metar.raw_metar,
            "visibility_m": metar.visibility_m,
            "ceiling_ft": metar.ceiling_ft,
            "wind_kt": metar.wind_kt,
            "flyable": metar.flyable,
        } if metar else None,
        "runway_ops": {
            "airport": rw.airport,
            "runway": rw.runway,
            "window": rw.window,
            "other_departures_count": rw.other_departures_count,
            "sample_flights": list(rw.sample_flights),
            "gdp_active": rw.gdp_active,
            "gdp_program": rw.gdp_program,
        } if rw else None,
        "crew_duty": {
            "base": p.crew_duty.base,
            "duty_hours_logged": p.crew_duty.duty_hours_logged,
            "max_fdtl_hours": p.crew_duty.max_fdtl_hours,
            "reserve_available": p.crew_duty.reserve_available,
            "summary": p.crew_duty.summary,
        } if p.crew_duty else None,
        "excuse_claim": {
            "excuse": p.excuse_claim.excuse,
            "station": p.excuse_claim.station,
            "window": p.excuse_claim.claimed_window,
            "message": p.excuse_claim.message,
            "at": fmt_day(p.excuse_claim.at),
        } if p.excuse_claim else None,
        "payout": {
            "amount": packet["amount"] if packet else p.payout.amount,
            "currency": s.profile.currency,
            "currency_code": s.profile.currency_code,
            "stage": p.payout.stage or ("ready" if packet else "pending"),
            "packet_id": packet["packet_id"] if packet else None,
            "eligible_max": statutory_amount(s.profile, p.distance_km, max(p.delay_minutes, 180), cancelled=True),
        },
        "claim_packet": packet,
        "radar_flash": radar_flash or (bool(resolution and resolution.get("radar_flash"))),
        "actions": actions,
        "resolution": resolution,
        "timeline": timeline,
        "commitments": [
            {"kind": c.kind, "state": c.state.value, "due_at": c.due_at.isoformat(), "detail": c.detail}
            for c in cs
        ],
    }

