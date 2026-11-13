"""Grounded flight QA: answers passenger questions strictly from ADS-B, METAR, Crew FDTL & Runway logs."""
import re

from .projection import ExcuseState
from .resolver import build_claim_packet, fmt_time

INTENTS = ("why_delayed", "weather_check", "tail_history", "crew_fdtl", "compensation", "claim_packet", "escalate", "status")

_RULES = [
    ("weather_check", re.compile(r"\b(weather|mausam|fog|rain|storm|metar|visibility|runway|rwy|take\s?off|departed|departures|unflyable|barish|baadal|atc)\b", re.I)),
    ("tail_history", re.compile(r"\b(tail|rotation|previous|prior|4 leg|legs|vt-|n\d|g-|aircraft|mumbai|inbound|chain)\b", re.I)),
    ("crew_fdtl", re.compile(r"\b(crew|pilot|captain|fdtl|duty|timeout|reserve|standby|rest)\b", re.I)),
    ("claim_packet", re.compile(r"\b(packet|ads-b|adsb|coord|signature|signed|hash|proof|pdf|export|docket)\b", re.I)),
    ("compensation", re.compile(r"\b(payout|compensation|eu261|dgca|dot|money|refund|paise|kab|claim|amount)\b", re.I)),
    ("escalate", re.compile(r"\b(escalate|regulator|airsewa|complaint|caa|neb|sue|legal)\b", re.I)),
    ("why_delayed", re.compile(r"\b(why|reason|kyu|kyon|late|delay|actual|truth|सच|jhoot|lie)\b", re.I)),
]


def classify(question: str) -> str:
    for intent, rx in _RULES:
        if rx.search(question):
            return intent
    return "status"


def answer(s, question: str, resolution: dict | None = None, locale: str = "en-IN") -> dict:
    intent = classify(question)
    p = s.p
    pkt = build_claim_packet(s)
    hi = locale == "hi-Latn-IN"
    tail = p.tail_number or "aircraft"
    metar = p.latest_metar
    rw = p.latest_runway

    if intent == "weather_check":
        if metar and rw and rw.other_departures_count >= 3:
            text = (
                f"{rw.airport} {rw.runway} par {rw.other_departures_count} flights clear take off hui ({', '.join(rw.sample_flights[:3])}). METAR {metar.raw_metar} flyable hai — weather excuse jhootha hai."
                if hi else
                f"Selective Weather refuted: {rw.other_departures_count} other aircraft departed {rw.airport} {rw.runway} during that exact window ({', '.join(rw.sample_flights[:3])}). METAR {metar.raw_metar} confirms {metar.visibility_m}m visibility (flyable)."
            )
        elif metar:
            text = f"Latest METAR at {metar.station}: {metar.raw_metar} (visibility {metar.visibility_m}m, ceiling {metar.ceiling_ft}ft)."
        else:
            text = "Awaiting airport METAR/runway log snapshot for this window."
    elif intent == "tail_history":
        if p.rotation_legs:
            legs = " -> ".join(f"{l.flight_code} ({l.route}, +{l.delay_min}m)" for l in p.rotation_legs[-4:])
            text = (
                f"Tail {tail} ke pichhle {len(p.rotation_legs)} legs: {legs}. Root cause: {s.root_cause_detail}"
                if hi else
                f"Traced {len(p.rotation_legs)} inbound legs for tail {tail}: {legs}. {s.root_cause_detail}"
            )
        else:
            text = f"Tail {tail} rotation history has not logged an inbound slip yet."
    elif intent == "crew_fdtl":
        if p.crew_duty:
            cd = p.crew_duty
            text = (
                f"{cd.summary} Duty logged {cd.duty_hours_logged:.1f}h / max {cd.max_fdtl_hours:.1f}h at {cd.base}."
            )
        else:
            text = f"No FDTL crew timeout recorded on tail {tail} yet."
    elif intent in ("claim_packet", "compensation"):
        if pkt:
            text = (
                f"{pkt['regime'].upper()} ke tahat {pkt['amount_display']} milne chahiye. Packet {pkt['packet_id']} ({len(pkt['signed_adsb_coordinates'])} signed ADS-B coordinates, {pkt['signature_sha256'][:18]}…) ready hai."
                if hi else
                f"{s.profile.statute} entitles passengers to {pkt['amount_display']}. Packet {pkt['packet_id']} is sealed with {len(pkt['signed_adsb_coordinates'])} signed ADS-B coordinates ({pkt['signature_sha256'][:18]}…) rebutting {p.excuse_claim.excuse if p.excuse_claim else 'carrier fault'}."
            )
        else:
            text = f"Statutory compensation unlocks once delay crosses {int(s.profile.delay_threshold.total_seconds() // 60)} minutes with airline-attributable fault."
    elif intent == "escalate":
        text = f"You can escalate directly to {s.profile.regulator_name} ({s.profile.regulator_url}) using packet {pkt['packet_id'] if pkt else p.flight_ref}."
    else:
        delay_str = f"{p.delay_minutes}m late" if p.delay_minutes else "monitoring schedule"
        text = (
            f"{p.flight_code} ({tail}) abhi {delay_str}. Asli wajah: {s.root_cause_detail}"
            if hi else
            f"{p.flight_code} ({tail}) is {delay_str}. Proven root cause ({s.root_cause_title}): {s.root_cause_detail}"
        )

    evidence = []
    if p.rotation_legs:
        evidence.append({"label": f"Tail {tail} rotation", "value": f"{len(p.rotation_legs)} legs traced"})
    if rw:
        evidence.append({"label": f"{rw.airport} {rw.runway}", "value": f"{rw.other_departures_count} departures in window"})
    if metar:
        evidence.append({"label": "METAR", "value": metar.raw_metar})
    if pkt:
        evidence.append({"label": "Statutory Packet", "value": f"{pkt['amount_display']} · {pkt['packet_id']}"})

    return {
        "answer": text,
        "intent": intent,
        "excuse_state": p.excuse_state.value,
        "root_cause": s.root_cause_title,
        "grounded_at": fmt_time(s.now),
        "evidence": evidence,
        "sources": sorted({e.source_adapter for e in s.events}),
    }
