# Sentinel AI — fetch UCDP conflict data (S1-04)
# UCDP GED API + Armed Conflict Dataset; no API key required.

import io
import time
from pathlib import Path

import pandas as pd
import requests

# ISO2 -> UCDP country name (for display and CSV filenames)
COUNTRIES = {
    "UA": "Ukraine",
    "TW": "Taiwan",
    "IR": "Iran (Government of)",
    "VE": "Venezuela",
    "PK": "Pakistan",
    "ET": "Ethiopia",
    "RS": "Serbia",
    "BR": "Brazil",
}

# Gleditsch-Ward country codes for UCDP GED API (Country filter is integer)
# https://ucdp.uu.se/apidocs/ — Country = country_id (GW code)
COUNTRY_NAME_TO_GW = {
    "Ukraine": 369,
    "Taiwan": 713,
    "Iran (Government of)": 630,
    "Iran": 630,
    "Venezuela": 101,
    "Pakistan": 770,
    "Ethiopia": 530,
    "Serbia": 345,
    "Serbia (Yugoslavia)": 345,
    "Brazil": 140,
}

GED_API_URL = "https://ucdpapi.pcr.uu.se/api/gedevents/23.1"
ARMED_CONFLICT_CSV_URLS = [
    "https://ucdp.uu.se/downloads/ucdpprio/ucdp-prio-acd-251.csv",
    "https://ucdp.uu.se/downloads/ucdpprio/ucdp-prio-acd-241.csv",
]


def _data_dir() -> Path:
    """Project data dir: data/ucdp/ (from repo root)."""
    root = Path(__file__).resolve().parents[3]
    d = root / "data" / "ucdp"
    d.mkdir(parents=True, exist_ok=True)
    return d


def split_ucdp_global() -> None:
    """Split UCDP GED master CSV into per-country files. Uses largest *ged*.csv in data/ucdp/ as master."""
    ucdp_dir = _data_dir()
    ged_files = list(ucdp_dir.glob("*ged*.csv")) + list(ucdp_dir.glob("*GED*.csv"))
    if not ged_files:
        print("No UCDP GED master file found in data/ucdp/")
        return
    master_path = max(ged_files, key=lambda p: p.stat().st_size)
    print(f"Splitting {master_path.name}...")
    df = pd.read_csv(master_path, low_memory=False)
    country_col = "country" if "country" in df.columns else "country_name"
    if country_col not in df.columns:
        print(f"  No column 'country' or 'country_name' in {master_path.name}")
        return
    for country, group in df.groupby(country_col):
        safe = (
            str(country)
            .lower()
            .replace(" ", "_")
            .replace("(", "")
            .replace(")", "")
            .replace("'", "")
            .replace("-", "_")
            .replace("__", "_")
        )
        out_path = ucdp_dir / f"{safe}_ged.csv"
        group.to_csv(out_path, index=False)
    print(f"Split into {df[country_col].nunique()} country files")


def fetch_ucdp_ged(country_name: str) -> pd.DataFrame:
    """
    Fetch UCDP GED (Georeferenced Event Dataset) for one country via REST API.
    Handles pagination; saves to data/ucdp/{country_name_lower}_ged.csv.
    Returns DataFrame with columns including year, country, deaths_a, deaths_b,
    deaths_civilians, type_of_violence, latitude, longitude.
    """
    data_dir = _data_dir()
    # Resolve GW code: try exact name then fallback (e.g. Iran)
    gw = COUNTRY_NAME_TO_GW.get(country_name)
    if gw is None:
        # Try without suffix for Iran
        for k, v in COUNTRY_NAME_TO_GW.items():
            if k in country_name or country_name in k:
                gw = v
                break
    if gw is None:
        # Request without filter (would return all) is wrong; return empty
        print(f"  Warning: no GW code for '{country_name}', returning empty GED")
        return pd.DataFrame()

    params = {"Country": gw, "pagesize": 1000, "page": 1}
    all_results = []

    while True:
        try:
            response = requests.get(GED_API_URL, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()
        except Exception as e:
            print(f"  Warning: GED API failed for {country_name} page {params['page']}: {e}")
            break

        results = data.get("Result", [])
        if not results:
            break
        all_results.extend(results)
        if len(results) < params["pagesize"]:
            break
        params["page"] += 1

    df = pd.DataFrame(all_results)
    if len(df) > 0:
        safe_name = (
            country_name.lower()
            .replace(" ", "_")
            .replace("(", "")
            .replace(")", "")
            .replace("__", "_")
        )
        out_path = data_dir / f"{safe_name}_ged.csv"
        df.to_csv(out_path, index=False)
    return df


def fetch_ucdp_armed_conflict() -> pd.DataFrame:
    """
    Download UCDP/PRIO Armed Conflict Dataset (1946–2023/2024) as CSV.
    Saves to data/ucdp/armed_conflict_1946_2023.csv.
    Tries version 25.1 then 24.1 if URL changes.
    """
    data_dir = _data_dir()
    out_path = data_dir / "armed_conflict_1946_2023.csv"

    for url in ARMED_CONFLICT_CSV_URLS:
        try:
            resp = requests.get(url, timeout=60)
            resp.raise_for_status()
            df = pd.read_csv(io.BytesIO(resp.content), encoding="utf-8", on_bad_lines="skip")
            df.to_csv(out_path, index=False)
            return df
        except Exception as e:
            print(f"  Warning: armed conflict CSV failed ({url}): {e}")
            continue

    if out_path.exists():
        print("  Using existing armed_conflict_1946_2023.csv")
        return pd.read_csv(out_path)
    return pd.DataFrame()


def compute_ucdp_features(ged_df: pd.DataFrame, window_years: int = 5) -> dict:
    """
    Compute 5 UCDP features per ML Guide Section 2.3.
    Returns dict with exactly: ucdp_total_deaths, ucdp_state_conflict_years,
    ucdp_civilian_deaths, ucdp_conflict_intensity, ucdp_recurrence_rate.
    """
    keys = [
        "ucdp_total_deaths",
        "ucdp_state_conflict_years",
        "ucdp_civilian_deaths",
        "ucdp_conflict_intensity",
        "ucdp_recurrence_rate",
    ]
    if ged_df is None or len(ged_df) == 0:
        return {k: 0 for k in keys}

    ged_df = ged_df.copy()
    ged_df["year"] = pd.to_numeric(ged_df.get("year", 0), errors="coerce")
    ged_df = ged_df.dropna(subset=["year"])
    if len(ged_df) == 0:
        return {k: 0 for k in keys}

    max_year = ged_df["year"].max()
    recent = ged_df[ged_df["year"] >= max_year - window_years]
    if len(recent) == 0:
        return {k: 0 for k in keys}

    type_col = recent.get("type_of_violence", pd.Series(dtype=object))
    type_str = type_col.astype(str)
    state_based = recent[type_str == "1"]
    civilian = recent[type_str == "3"]

    deaths_a = recent.get("deaths_a", pd.Series(0)).fillna(0)
    deaths_b = recent.get("deaths_b", pd.Series(0)).fillna(0)
    deaths_civ = civilian.get("deaths_civilians", pd.Series(0)).fillna(0)

    return {
        "ucdp_total_deaths": float(deaths_a.sum() + deaths_b.sum()),
        "ucdp_state_conflict_years": (
            len(state_based["year"].unique()) if len(state_based) > 0 else 0
        ),
        "ucdp_civilian_deaths": float(deaths_civ.sum()),
        "ucdp_conflict_intensity": float(deaths_a.mean()),
        "ucdp_recurrence_rate": float(len(recent["year"].unique()) / max(window_years, 1)),
    }


def build_ucdp_training_labels(armed_conflict_df: pd.DataFrame) -> pd.DataFrame:
    """
    Build labeled country-years for XGBoost training from armed conflict dataset.
    Returns DataFrame with columns: location, year, conflict_id, intensity_level, risk_label.
    risk_label is LOW / ELEVATED / HIGH. Prints value counts.
    """
    df = armed_conflict_df.copy()

    # UCDP/PRIO CSV often uses: loc (or gwnoloc), year, conflictid, intensity
    rename = {}
    if "loc" in df.columns:
        rename["loc"] = "location"
    if "gwnoloc" in df.columns and "location" not in df.columns:
        rename["gwnoloc"] = "location"
    if "conflictid" in df.columns:
        rename["conflictid"] = "conflict_id"
    if "intensity" in df.columns:
        rename["intensity"] = "intensity_level"
    df = df.rename(columns=rename)

    def assign_label(row):
        cid = row.get("conflict_id", row.get("conflictid", None))
        if pd.isna(cid) or cid == "" or (isinstance(cid, (int, float)) and cid == 0):
            return "LOW"
        intensity = row.get("intensity_level", row.get("intensity", 0))
        try:
            intensity = int(float(intensity))
        except (ValueError, TypeError):
            intensity = 0
        if intensity >= 2:
            return "HIGH"
        if intensity == 1:
            return "ELEVATED"
        return "LOW"

    df["risk_label"] = df.apply(assign_label, axis=1)

    out_cols = ["location", "year", "conflict_id", "intensity_level", "risk_label"]
    available = [c for c in out_cols if c in df.columns]
    result = df[available].copy()

    print(f"Labeled {len(result)} country-years")
    print(result["risk_label"].value_counts())
    return result


if __name__ == "__main__":
    data_dir = _data_dir()
    country_names = list(COUNTRIES.values())

    print("Fetching UCDP GED for all monitored countries...")
    for i, country in enumerate(country_names):
        try:
            df = fetch_ucdp_ged(country)
            print(f"  {country}: {len(df)} events")
        except Exception as e:
            print(f"  {country}: failed - {e}")
        if i < len(country_names) - 1:
            time.sleep(1)

    print("\nDownloading UCDP/PRIO Armed Conflict Dataset...")
    ac_df = fetch_ucdp_armed_conflict()
    print(f"  Armed conflict rows: {len(ac_df)}")
    if len(ac_df) > 0 and "year" in ac_df.columns:
        print(f"  Year range: {ac_df['year'].min()} - {ac_df['year'].max()}")

    # Sample compute_ucdp_features for Ukraine
    ukraine_path = data_dir / "ukraine_ged.csv"
    if not ukraine_path.exists():
        for p in data_dir.glob("*_ged.csv"):
            if "ukraine" in p.stem.lower():
                ukraine_path = p
                break
    if ukraine_path.exists():
        df_ua = pd.read_csv(ukraine_path)
        features = compute_ucdp_features(df_ua)
        print("\nSample compute_ucdp_features(Ukraine):", features)
    else:
        print("\nNo Ukraine GED CSV found; skipping feature sample.")

    # Training label distribution
    if len(ac_df) > 0:
        print("\nTraining labels from build_ucdp_training_labels():")
        labels_df = build_ucdp_training_labels(ac_df)
        print("Done.")
