# Sentinel AI — unified 47-feature pipeline (S1-06)
# See GitHub Issue #11: SentinelFeaturePipeline from GDELT + ACLED + UCDP + World Bank + sentiment.

import json
import warnings
from pathlib import Path
from datetime import datetime, timezone

import pandas as pd

from backend.ml.data.fetch_gdelt import compute_gdelt_features
from backend.ml.data.fetch_acled import compute_acled_features
from backend.ml.data.fetch_ucdp import compute_ucdp_features
from backend.ml.data.fetch_world_bank import fetch_world_bank_features

# --- Exact 47 feature keys (ML Guide Section 3.2) ---
FEATURE_COLUMNS = [
    # GDELT (10)
    "gdelt_goldstein_mean",
    "gdelt_goldstein_std",
    "gdelt_goldstein_min",
    "gdelt_event_count",
    "gdelt_avg_tone",
    "gdelt_conflict_pct",
    "gdelt_goldstein_mean_90d",
    "gdelt_event_acceleration",
    "gdelt_mention_weighted_tone",
    "gdelt_volatility",
    # ACLED (10)
    "acled_fatalities_30d",
    "acled_battle_count",
    "acled_civilian_violence",
    "acled_explosion_count",
    "acled_protest_count",
    "acled_fatality_rate",
    "acled_event_count_90d",
    "acled_event_acceleration",
    "acled_unique_actors",
    "acled_geographic_spread",
    # UCDP (5)
    "ucdp_total_deaths",
    "ucdp_state_conflict_years",
    "ucdp_civilian_deaths",
    "ucdp_conflict_intensity",
    "ucdp_recurrence_rate",
    # World Bank (10)
    "wb_gdp_growth_latest",
    "wb_gdp_growth_trend",
    "wb_inflation_latest",
    "wb_inflation_trend",
    "wb_unemployment_latest",
    "wb_debt_pct_gdp",
    "wb_fdi_latest",
    "wb_fdi_trend",
    "wb_military_spend",
    "econ_composite_score",
    # Sentiment (7)
    "finbert_negative_score",
    "finbert_positive_score",
    "finbert_neutral_score",
    "headline_volume",
    "headline_escalatory_pct",
    "media_negativity_index",
    "sentiment_trend_7d",
    # Derived (5)
    "anomaly_score",
    "conflict_composite",
    "political_risk_score",
    "humanitarian_score",
    "economic_stress_score",
]

# Common English names overriding formal ISO 3166-1 names
COMMON_NAMES: dict[str, str] = {
    "IR": "Iran", "SY": "Syria", "VE": "Venezuela", "KR": "South Korea",
    "KP": "North Korea", "RU": "Russia", "BO": "Bolivia", "MD": "Moldova",
    "TZ": "Tanzania", "CD": "DR Congo", "LA": "Laos", "FM": "Micronesia",
    "TR": "Turkey", "VN": "Vietnam", "BN": "Brunei", "TW": "Taiwan",
    "CI": "Ivory Coast", "PS": "Palestine", "HK": "Hong Kong", "MO": "Macau",
    "SZ": "Eswatini", "VI": "US Virgin Islands", "VG": "British Virgin Islands",
    "BQ": "Caribbean Netherlands", "SX": "Sint Maarten", "MF": "Saint Martin",
    "SH": "Saint Helena",
}


def _region_from_coords(lat: float, lng: float) -> str:
    """Assign a region based on latitude/longitude when region is missing."""
    if lat == 0 and lng == 0:
        return "Other"
    # Europe: roughly lat 35-72, lng -25-40
    if 35 <= lat <= 72 and -25 <= lng <= 40:
        return "Europe"
    # Middle East: lat 12-42, lng 25-63
    if 12 <= lat <= 42 and 25 <= lng <= 63:
        return "Middle East"
    # Central/South Asia: lat 5-45, lng 63-100
    if 5 <= lat <= 45 and 63 <= lng <= 100:
        return "Asia"
    # East/Southeast Asia: lat -10-55, lng 100-150
    if -10 <= lat <= 55 and 100 <= lng <= 150:
        return "Asia"
    # Africa: lat -35-37, lng -20-52 (exclude Middle East overlap)
    if -35 <= lat <= 37 and -20 <= lng <= 52 and not (lat >= 35 and lng >= 25):
        return "Africa"
    # Americas: lng < -30
    if lng < -30:
        return "Americas"
    # Oceania
    if lat < 0 and lng > 100:
        return "Oceania"
    if lat < 25 and lng > 150:
        return "Oceania"
    return "Other"


def _load_countries() -> dict:
    """Load MONITORED_COUNTRIES from data/countries.json; fallback to original 8 if missing."""
    path = Path(__file__).resolve().parents[2] / "data" / "countries.json"
    if path.exists():
        with open(path, encoding="utf-8") as f:
            entries = json.load(f)
        return {
            e["iso2"]: {
                "name": COMMON_NAMES.get(e["iso2"], e["name"]),
                "iso3": e["iso3"],
                "acled_name": e.get("acled_name", e["name"]),
                "lat": e.get("lat", 0),
                "lng": e.get("lng", 0),
                "region": e.get("region", "") or _region_from_coords(e.get("lat", 0), e.get("lng", 0)),
            }
            for e in entries
            if e.get("iso2")
        }
    return {
        "UA": {"name": "Ukraine", "iso3": "UKR", "acled_name": "Ukraine", "lat": 48.38, "lng": 31.17, "region": "Europe"},
        "TW": {"name": "Taiwan", "iso3": "TWN", "acled_name": "Taiwan", "lat": 23.70, "lng": 120.96, "region": "Asia"},
        "IR": {"name": "Iran", "iso3": "IRN", "acled_name": "Iran", "lat": 32.43, "lng": 53.69, "region": "Middle East"},
        "VE": {"name": "Venezuela", "iso3": "VEN", "acled_name": "Venezuela", "lat": 6.42, "lng": -66.59, "region": "Americas"},
        "PK": {"name": "Pakistan", "iso3": "PAK", "acled_name": "Pakistan", "lat": 30.38, "lng": 69.35, "region": "Asia"},
        "ET": {"name": "Ethiopia", "iso3": "ETH", "acled_name": "Ethiopia", "lat": 9.15, "lng": 40.49, "region": "Africa"},
        "RS": {"name": "Serbia", "iso3": "SRB", "acled_name": "Serbia", "lat": 44.02, "lng": 21.01, "region": "Europe"},
        "BR": {"name": "Brazil", "iso3": "BRA", "acled_name": "Brazil", "lat": -14.24, "lng": -51.93, "region": "Americas"},
    }


MONITORED_COUNTRIES = _load_countries()

EMPTY_SENTIMENT = {
    "finbert_negative_score": 0.0,
    "finbert_positive_score": 0.0,
    "finbert_neutral_score": 1.0,
    "headline_volume": 0,
    "headline_escalatory_pct": 0.0,
    "media_negativity_index": 0.0,
    "sentiment_trend_7d": 0.0,
}


def _repo_root() -> Path:
    """Repo root (backend/ml/pipeline.py -> parents[2])."""
    return Path(__file__).resolve().parents[2]


def _safe_float(x) -> float:
    """Coerce to float; None or invalid -> 0.0."""
    if x is None:
        return 0.0
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0.0


def _safe_int(x) -> int:
    """Coerce to int; None or invalid -> 0."""
    if x is None:
        return 0
    try:
        return int(float(x))
    except (TypeError, ValueError):
        return 0


class SentinelFeaturePipeline:
    """
    Builds a single 47-feature vector per country from GDELT, ACLED, UCDP, World Bank, and sentiment.
    """

    def __init__(self, country_code: str, country_name: str):
        self.country_code = country_code
        self.country_name = country_name
        info = MONITORED_COUNTRIES.get(
            country_code.upper(),
            {"name": country_name, "iso3": country_code, "acled_name": country_name},
        )
        self.iso3 = info.get("iso3", country_code)
        self.acled_name = info.get("acled_name", country_name)

    def compute(
        self,
        gdelt_df: pd.DataFrame,
        acled_df: pd.DataFrame,
        ucdp_df: pd.DataFrame,
        wb_features: dict,
        headlines: list | None = None,
        finbert_results: dict | None = None,
    ) -> dict:
        """
        Merge all data source features into one dict with exactly 47 feature keys.
        Replaces None with 0/0.0. Includes country_code and computed_at.
        """
        # GDELT (10) — 90 days captures recent trends and acceleration
        gdelt_features = compute_gdelt_features(gdelt_df, window_days=90)
        # ACLED (10) — full history for full conflict picture
        acled_features = compute_acled_features(acled_df, window_days=99999)
        # UCDP (5)
        ucdp_features = compute_ucdp_features(ucdp_df, window_years=5)
        # World Bank (10) — already wb_-prefixed from fetch_world_bank_features
        wb = dict(wb_features) if wb_features else {}
        # Sentiment (7)
        sentiment = dict(finbert_results) if finbert_results else EMPTY_SENTIMENT.copy()
        for k in EMPTY_SENTIMENT:
            if k not in sentiment or sentiment[k] is None:
                sentiment[k] = EMPTY_SENTIMENT[k]

        # Merge; only keys in FEATURE_COLUMNS
        f = {}
        f.update(gdelt_features)
        f.update(acled_features)
        f.update(ucdp_features)
        f.update({k: wb.get(k) for k in FEATURE_COLUMNS if k.startswith("wb_") or k == "econ_composite_score"})
        f.update({k: sentiment.get(k, EMPTY_SENTIMENT[k]) for k in EMPTY_SENTIMENT})

        # Derived (5)
        derived = self._derived_features(f)
        f.update(derived)

        # Ensure exactly FEATURE_COLUMNS; no None; types int or float
        int_keys = {
            "gdelt_event_count", "acled_battle_count", "acled_civilian_violence",
            "acled_explosion_count", "acled_protest_count", "acled_event_count_90d",
            "acled_unique_actors", "acled_geographic_spread", "ucdp_state_conflict_years",
            "headline_volume",
        }
        out = {}
        for k in FEATURE_COLUMNS:
            v = f.get(k)
            if v is None:
                v = 0 if k in int_keys else 0.0
            out[k] = _safe_int(v) if k in int_keys else _safe_float(v)

        # Validation: exactly 47 keys
        missing = set(FEATURE_COLUMNS) - set(out.keys())
        if missing:
            raise ValueError(f"Missing feature keys: {missing}")

        out["country_code"] = self.country_code
        out["computed_at"] = datetime.now(tz=timezone.utc).isoformat()
        return out

    def _derived_features(self, f: dict) -> dict:
        """Five derived/composite features (ML Guide Section 4)."""
        conflict_composite = min(
            100,
            (
                _safe_float(f.get("acled_fatalities_30d", 0)) / 200 * 40
                + _safe_int(f.get("acled_battle_count", 0)) / 50 * 30
                + max(0, -_safe_float(f.get("gdelt_goldstein_mean", 0))) / 10 * 30
            ),
        )
        humanitarian = min(100, _safe_float(f.get("ucdp_civilian_deaths", 0)) / 100 * 50)
        econ = _safe_float(f.get("econ_composite_score", 0))
        return {
            "anomaly_score": 0.0,
            "conflict_composite": round(conflict_composite, 2),
            "political_risk_score": round(conflict_composite, 2),
            "humanitarian_score": round(humanitarian, 2),
            "economic_stress_score": round(econ, 2),
        }

    @classmethod
    def compute_all_countries(cls, limit: int | None = None, priority_codes: list[str] | None = None) -> dict[str, dict]:
        """
        Load data from disk for monitored countries and return {country_code: feature_dict}.
        If limit is set, only that many countries are processed.
        If priority_codes is set, those countries are processed first.
        Graceful fallbacks: missing CSVs/JSON yield empty DataFrames or zero-filled dicts.
        """
        root = _repo_root()
        data_gdelt = root / "data" / "gdelt"
        data_acled = root / "data" / "acled"
        data_ucdp = root / "data" / "ucdp"
        data_wb = root / "data" / "world_bank"
        results = {}
        all_items = list(MONITORED_COUNTRIES.items())
        if priority_codes:
            priority = [(c, MONITORED_COUNTRIES[c]) for c in priority_codes if c in MONITORED_COUNTRIES]
            priority_set = set(priority_codes)
            rest = [(c, info) for c, info in all_items if c not in priority_set]
            items = priority + rest
        else:
            items = all_items
        if limit is not None:
            items = items[:limit]

        for code, info in items:
            name = info["name"]
            iso3 = info["iso3"]
            acled_name = info["acled_name"]

            # Load GDELT
            gdelt_path = data_gdelt / f"{code}_events.csv"
            if gdelt_path.exists():
                try:
                    gdelt_df = pd.read_csv(gdelt_path)
                except Exception as e:
                    warnings.warn(f"GDELT {code}: {e}")
                    gdelt_df = pd.DataFrame()
            else:
                gdelt_df = pd.DataFrame()

            # Load ACLED (same safe name as fetch_acled_all_countries)
            _acled_safe = acled_name.lower().replace(" ", "_").replace("(", "").replace(")", "").replace("'", "").replace("-", "_").replace("__", "_")
            acled_path = data_acled / f"{_acled_safe}.csv"
            if acled_path.exists():
                try:
                    acled_df = pd.read_csv(acled_path)
                except Exception as e:
                    warnings.warn(f"ACLED {code}: {e}")
                    acled_df = pd.DataFrame()
            else:
                acled_df = pd.DataFrame()

            # Load UCDP GED
            safe = acled_name.lower().replace(" ", "_").replace("(", "").replace(")", "").replace("__", "_") + "_ged.csv"
            ucdp_path = data_ucdp / safe
            if not ucdp_path.exists():
                # Try alternate (e.g. ukraine vs Ukraine)
                alt = list(data_ucdp.glob(f"*{name.split()[0].lower()}*ged*.csv"))
                ucdp_path = Path(alt[0]) if alt else None
            if ucdp_path and Path(ucdp_path).exists():
                try:
                    ucdp_df = pd.read_csv(ucdp_path)
                except Exception as e:
                    warnings.warn(f"UCDP {code}: {e}")
                    ucdp_df = pd.DataFrame()
            else:
                ucdp_df = pd.DataFrame()

            # Load World Bank
            wb_path = data_wb / f"{iso3}.json"
            if wb_path.exists():
                try:
                    with open(wb_path, encoding="utf-8") as f:
                        payload = json.load(f)
                    wb_features = payload.get("features", {})
                except Exception as e:
                    warnings.warn(f"World Bank {code}: {e}")
                    wb_features = {}
            else:
                try:
                    wb_features = fetch_world_bank_features(iso3)
                except Exception as e:
                    warnings.warn(f"World Bank {code}: {e}")
                    wb_features = {}

            pipeline = cls(code, name)
            try:
                results[code] = pipeline.compute(gdelt_df, acled_df, ucdp_df, wb_features)
            except Exception as e:
                warnings.warn(f"Pipeline {code}: {e}")
                zero_feat = {k: (0 if k in ("gdelt_event_count", "acled_battle_count", "acled_civilian_violence", "acled_explosion_count", "acled_protest_count", "acled_event_count_90d", "acled_unique_actors", "acled_geographic_spread", "ucdp_state_conflict_years", "headline_volume") else 0.0) for k in FEATURE_COLUMNS}
                zero_feat["country_code"] = code
                zero_feat["computed_at"] = datetime.now(tz=timezone.utc).isoformat()
                results[code] = zero_feat

        return results


if __name__ == "__main__":
    root = _repo_root()
    data_gdelt = root / "data" / "gdelt"
    data_acled = root / "data" / "acled"
    data_ucdp = root / "data" / "ucdp"
    data_wb = root / "data" / "world_bank"

    # Ukraine
    gdelt_df = pd.read_csv(data_gdelt / "UA_events.csv") if (data_gdelt / "UA_events.csv").exists() else pd.DataFrame()
    acled_df = pd.read_csv(data_acled / "ukraine.csv") if (data_acled / "ukraine.csv").exists() else pd.DataFrame()
    ucdp_path = data_ucdp / "ukraine_ged.csv"
    if not ucdp_path.exists():
        alt = list(data_ucdp.glob("*ukraine*ged*.csv"))
        ucdp_path = alt[0] if alt else None
    ucdp_df = pd.read_csv(ucdp_path) if ucdp_path and Path(ucdp_path).exists() else pd.DataFrame()
    wb_path = data_wb / "UKR.json"
    if wb_path.exists():
        with open(wb_path, encoding="utf-8") as f:
            wb_features = json.load(f).get("features", {})
    else:
        wb_features = fetch_world_bank_features("UKR")

    pipeline = SentinelFeaturePipeline("UA", "Ukraine")
    features = pipeline.compute(gdelt_df, acled_df, ucdp_df, wb_features)

    # Print only the 47 feature keys (exclude metadata for count)
    feature_only = {k: v for k, v in features.items() if k in FEATURE_COLUMNS}
    print(f"Feature count: {len(feature_only)} (expected 47)")
    for k in FEATURE_COLUMNS:
        v = features.get(k)
        if v is None:
            print(f"  {k}: None  <-- INVALID")
        else:
            print(f"  {k}: {v}")
    print(f"country_code: {features.get('country_code')}")
    print(f"computed_at: {features.get('computed_at')}")
