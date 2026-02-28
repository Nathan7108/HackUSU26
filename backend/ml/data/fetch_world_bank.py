# Sentinel AI — fetch World Bank economic indicators (S1-05)
# Fetches 6 indicators × last N years via wbgapi (or requests fallback); returns 10 ML-ready features per country.

import json
from pathlib import Path
from typing import Any

from tqdm import tqdm

try:
    import wbgapi
    _HAS_WBGAPI = True
except ImportError:
    _HAS_WBGAPI = False

import requests

# 6 World Bank indicators (ML Guide Section 2.4)
INDICATORS = {
    "gdp_growth": "NY.GDP.MKTP.KD.ZG",   # GDP growth rate
    "inflation": "FP.CPI.TOTL.ZG",       # Inflation rate
    "unemployment": "SL.UEM.TOTL.ZS",    # Unemployment rate
    "debt_pct_gdp": "GC.DOD.TOTL.GD.ZS", # Government debt % GDP
    "fdi": "BX.KLT.DINV.WD.GD.ZS",       # Foreign direct investment
    "military_spend": "MS.MIL.XPND.GD.ZS", # Military expenditure % GDP
}

# ISO2 (monitored) → ISO3 (World Bank)
COUNTRIES_ISO3 = {
    "UA": "UKR",
    "TW": "TWN",
    "IR": "IRN",
    "VE": "VEN",
    "PK": "PAK",
    "ET": "ETH",
    "RS": "SRB",
    "BR": "BRA",
}


def _data_dir() -> Path:
    """Project data dir: data/world_bank/ (from repo root)."""
    root = Path(__file__).resolve().parents[3]
    d = root / "data" / "world_bank"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _fetch_indicator_via_api(indicator_code: str, country_iso3: str, mrv: int = 5) -> list[float]:
    """Fetch up to mrv most recent values from World Bank API v2 (requests fallback)."""
    url = (
        "https://api.worldbank.org/v2/country/"
        f"{country_iso3}/indicator/{indicator_code}?format=json&per_page={mrv}"
    )
    try:
        r = requests.get(url, timeout=60)
        r.raise_for_status()
        payload = r.json()
        if not payload or len(payload) < 2:
            return []
        # payload[1] = list of { value, date, ... }; API returns most recent first
        rows = payload[1]
        # collect (date, value) and sort by date desc so values[0] = latest
        dated = [(row.get("date"), float(row["value"])) for row in rows if row.get("value") is not None]
        dated.sort(key=lambda x: x[0], reverse=True)
        return [v for _, v in dated[:mrv]]
    except Exception:
        return []


def _fetch_raw_world_bank(country_iso3: str, mrv: int = 5) -> dict[str, Any]:
    """
    Fetches last mrv years of World Bank indicators for one country (internal).
    Returns raw features dict: *_latest and *_trend per indicator.
    Handles missing data and Taiwan (TWN) gracefully; per-indicator try/except.
    Uses wbgapi if available, else requests to api.worldbank.org/v2.
    """
    features: dict[str, Any] = {}
    for name, code in INDICATORS.items():
        try:
            values = []
            if _HAS_WBGAPI:
                try:
                    data = list(wbgapi.data.get(code, country_iso3, mrv=mrv))
                    values = [v["value"] for v in data if v.get("value") is not None]
                except Exception:
                    pass
            if not values:
                values = _fetch_indicator_via_api(code, country_iso3, mrv=mrv)
            if values:
                features[f"{name}_latest"] = values[0]
                features[f"{name}_trend"] = values[0] - values[-1]
            else:
                features[f"{name}_latest"] = None
                features[f"{name}_trend"] = None
        except Exception:
            features[f"{name}_latest"] = None
            features[f"{name}_trend"] = None
    return features


def fetch_world_bank_features(country_iso3: str, mrv: int = 5) -> dict[str, Any]:
    """
    Fetches World Bank indicators and returns 10 ML-ready features per country.
    mrv: most recent N years of data (default 5).
    Keys: wb_gdp_growth_latest, wb_gdp_growth_trend, wb_inflation_latest,
    wb_inflation_trend, wb_unemployment_latest, wb_debt_pct_gdp, wb_fdi_latest,
    wb_fdi_trend, wb_military_spend, econ_composite_score.
    """
    raw = _fetch_raw_world_bank(country_iso3, mrv=mrv)
    return format_wb_features(raw)


def fetch_world_bank_all_countries(mrv: int = 30) -> None:
    """Fetch World Bank indicators for all countries in data/countries.json. Saves data/world_bank/{ISO3}.json."""
    root = Path(__file__).resolve().parents[3]
    countries_path = root / "data" / "countries.json"
    if not countries_path.exists():
        raise FileNotFoundError("data/countries.json not found; run --step countries first")
    with open(countries_path, encoding="utf-8") as f:
        countries = json.load(f)
    wb_dir = _data_dir()
    for entry in tqdm(countries, desc="World Bank"):
        iso3 = entry.get("iso3")
        if not iso3:
            continue
        out_path = wb_dir / f"{iso3}.json"
        if out_path.exists():
            continue
        try:
            tqdm.write(f"  Fetching {iso3}...")
            features = fetch_world_bank_features(iso3, mrv=mrv)
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump({"iso3": iso3, "features": features}, f, indent=2)
        except Exception as e:
            print(f"  {iso3}: {e}")


def compute_econ_composite(wb_features: dict[str, Any]) -> float:
    """
    Economic stress score 0–100 from inflation, GDP growth, and debt (ML Guide Section 4).
    Accepts raw-style keys (inflation_latest, gdp_growth_latest, debt_pct_gdp_latest).
    """
    score = 0.0
    inflation = wb_features.get("inflation_latest")
    if inflation is not None:
        if inflation > 50:
            score += 40
        elif inflation > 20:
            score += 25
        elif inflation > 10:
            score += 10

    gdp = wb_features.get("gdp_growth_latest")
    if gdp is not None:
        if gdp < -5:
            score += 30
        elif gdp < 0:
            score += 20
        elif gdp < 2:
            score += 5

    debt = wb_features.get("debt_pct_gdp_latest")
    if debt is not None:
        if debt > 120:
            score += 20
        elif debt > 80:
            score += 10

    return min(100.0, score)


def format_wb_features(raw_features: dict[str, Any]) -> dict[str, Any]:
    """
    Converts raw feature dict to the 10 wb_*-prefixed keys the pipeline expects.
    Fills econ_composite_score. Uses None or 0 for missing values (no crash).
    """
    composite = compute_econ_composite(raw_features)
    out: dict[str, Any] = {
        "wb_gdp_growth_latest": raw_features.get("gdp_growth_latest"),
        "wb_gdp_growth_trend": raw_features.get("gdp_growth_trend"),
        "wb_inflation_latest": raw_features.get("inflation_latest"),
        "wb_inflation_trend": raw_features.get("inflation_trend"),
        "wb_unemployment_latest": raw_features.get("unemployment_latest"),
        "wb_debt_pct_gdp": raw_features.get("debt_pct_gdp_latest"),
        "wb_fdi_latest": raw_features.get("fdi_latest"),
        "wb_fdi_trend": raw_features.get("fdi_trend"),
        "wb_military_spend": raw_features.get("military_spend_latest"),
        "econ_composite_score": composite,
    }
    return out


if __name__ == "__main__":
    data_dir = _data_dir()
    print("World Bank economic indicators — fetching all 8 monitored countries\n")

    for iso2, iso3 in COUNTRIES_ISO3.items():
        print(f"--- {iso2} ({iso3}) ---")
        raw = _fetch_raw_world_bank(iso3)
        formatted = format_wb_features(raw)
        # Save raw + features to data/world_bank/{iso3}.json
        payload = {
            "country_iso3": iso3,
            "raw": raw,
            "features": formatted,
        }
        out_path = data_dir / f"{iso3}.json"
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)
        print(f"  Saved: {out_path}")
        for k, v in formatted.items():
            print(f"  {k}: {v}")
        print()

    print("Done. Verify: Ukraine (negative GDP trend), Venezuela (high inflation/composite).")
