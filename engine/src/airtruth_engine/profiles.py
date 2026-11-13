"""Regulatory compensation profiles: Indian DGCA CAR, US DOT 14 CFR §260, and EU261/UK261."""
from dataclasses import dataclass
from datetime import datetime, timedelta


@dataclass(frozen=True)
class Profile:
    name: str
    regime_label: str
    statute: str
    currency: str
    currency_code: str
    delay_threshold: timedelta
    tarmac_threshold: timedelta
    carrier_ack: timedelta
    settlement_working_days: int
    late_telemetry_grace: timedelta
    payout_short: int
    payout_mid: int
    payout_long: int
    regulator_name: str
    regulator_url: str


DGCA = Profile(
    name="dgca",
    regime_label="India · DGCA CAR",
    statute="DGCA CAR Section 3, Series M Part IV",
    currency="₹",
    currency_code="INR",
    delay_threshold=timedelta(hours=2),
    tarmac_threshold=timedelta(minutes=90),
    carrier_ack=timedelta(hours=24),
    settlement_working_days=7,
    late_telemetry_grace=timedelta(minutes=5),
    payout_short=5000,
    payout_mid=7500,
    payout_long=10000,
    regulator_name="DGCA AirSewa",
    regulator_url="https://airsewa.gov.in",
)

US_DOT = Profile(
    name="us_dot",
    regime_label="USA · US DOT 14 CFR §260",
    statute="US DOT 14 CFR Part 259 & Part 260 Automatic Refund Rule",
    currency="$",
    currency_code="USD",
    delay_threshold=timedelta(hours=3),
    tarmac_threshold=timedelta(minutes=180),
    carrier_ack=timedelta(hours=24),
    settlement_working_days=7,
    late_telemetry_grace=timedelta(minutes=5),
    payout_short=400,
    payout_mid=550,
    payout_long=650,
    regulator_name="US DOT Aviation Consumer Protection",
    regulator_url="https://secure.dot.gov/air-travel-complaint",
)

EU261 = Profile(
    name="eu261",
    regime_label="EU/UK · EC Regulation 261/2004",
    statute="Regulation (EC) No 261/2004 & UK261 Article 5/7",
    currency="€",
    currency_code="EUR",
    delay_threshold=timedelta(hours=3),
    tarmac_threshold=timedelta(minutes=120),
    carrier_ack=timedelta(hours=24),
    settlement_working_days=7,
    late_telemetry_grace=timedelta(minutes=5),
    payout_short=250,
    payout_mid=400,
    payout_long=600,
    regulator_name="UK CAA / EU NEB",
    regulator_url="https://www.caa.co.uk/passengers",
)

PROFILES: dict[str, Profile] = {"dgca": DGCA, "us_dot": US_DOT, "eu261": EU261}


def statutory_amount(profile: Profile, distance_km: int, delay_minutes: int, cancelled: bool = False) -> int:
    """Compute statutory payout entitlement under the regime for the flight distance & delay."""
    threshold_min = int(profile.delay_threshold.total_seconds() // 60)
    if not cancelled and delay_minutes < threshold_min:
        return 0
    if distance_km <= 1500:
        return profile.payout_short
    if distance_km <= 3500:
        return profile.payout_mid
    return profile.payout_long


def add_working_days(start: datetime, days: int) -> datetime:
    """Mon–Fri settlement calendar."""
    cur, added = start, 0
    while added < days:
        cur += timedelta(days=1)
        if cur.weekday() < 5:
            added += 1
    return cur

