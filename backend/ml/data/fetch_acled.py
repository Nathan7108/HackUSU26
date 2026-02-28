# Sentinel AI — fetch ACLED conflict data (S1-02)
# New ACLED API: OAuth at acleddata.com, Bearer token, pagination 5000/page.

import json
import os
import time
from pathlib import Path

import pandas as pd
import requests
from dotenv import load_dotenv
from tqdm import tqdm

# ISO2 -> full country name (ACLED uses full names)
COUNTRIES = {
    "UA": "Ukraine",
    "TW": "Taiwan",
    "IR": "Iran",
    "VE": "Venezuela",
    "PK": "Pakistan",
    "ET": "Ethiopia",
    "RS": "Serbia",
    "BR": "Brazil",
}

TOKEN_URL = "https://acleddata.com/oauth/token"
API_URL = "https://acleddata.com/api/acled/read?_format=json"
PAGE_LIMIT = 5000
FIELDS = "event_date|event_type|sub_event_type|fatalities|actor1|actor2|admin1|latitude|longitude|notes"


def get_acled_token(username: str, password: str) -> str:
    """Get OAuth Bearer token from ACLED. New API (2025+)."""
    resp = requests.post(
        TOKEN_URL,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        data={
            "username": username,
            "password": password,
            "grant_type": "password",
            "client_id": "acled",
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["access_token"]


def fetch_acled(
    country: str,
    token: str,
    start_date: str = "2020-01-01",
    end_date: str = "2026-02-28",
) -> pd.DataFrame:
    """
    Fetch ACLED events for one country with pagination.
    Returns DataFrame with columns: event_date, event_type, sub_event_type,
    fatalities, actor1, actor2, admin1, latitude, longitude, notes.
    """
    headers = {"Authorization": f"Bearer {token}"}
    all_data = []
    page = 1

    while True:
        params = {
            "country": country,
            "event_date": f"{start_date}|{end_date}",
            "event_date_where": "BETWEEN",
            "fields": FIELDS,
            "limit": PAGE_LIMIT,
            "page": page,
        }
        try:
            response = requests.get(
                API_URL,
                params=params,
                headers=headers,
                timeout=60,
            )
            response.raise_for_status()
            data = response.json()
        except Exception as e:
            print(f"  Warning: fetch failed for {country} page {page}: {e}")
            break

        rows = data.get("data", [])
        if not rows:
            break

        # API may return list of dicts or list of pipe-separated strings
        if rows and isinstance(rows[0], str):
            # Parse pipe-separated: event_date|event_type|...
            keys = [k.strip() for k in FIELDS.split("|")]
            all_data.extend(
                dict(zip(keys, (c.strip() for c in r.split("|")))) for r in rows
            )
        else:
            all_data.extend(rows)

        if len(rows) < PAGE_LIMIT:
            break
        page += 1

    return pd.DataFrame(all_data) if all_data else pd.DataFrame()


def compute_acled_features(df: pd.DataFrame, window_days: int = 30) -> dict:
    """
    Compute 10 ML-ready ACLED features per ML Guide Section 2.2.
    Returns dict with exactly: acled_fatalities_30d, acled_battle_count,
    acled_civilian_violence, acled_explosion_count, acled_protest_count,
    acled_fatality_rate, acled_event_count_90d, acled_event_acceleration,
    acled_unique_actors, acled_geographic_spread.
    When window_days >= 99999, uses the ENTIRE dataframe for the full conflict picture;
    acled_event_acceleration still uses the last 90 days of the dataset (last 30d vs prior 60d).
    """
    if df is None or df.empty:
        return {
            "acled_fatalities_30d": 0.0,
            "acled_battle_count": 0,
            "acled_civilian_violence": 0,
            "acled_explosion_count": 0,
            "acled_protest_count": 0,
            "acled_fatality_rate": 0.0,
            "acled_event_count_90d": 0,
            "acled_event_acceleration": 0.0,
            "acled_unique_actors": 0,
            "acled_geographic_spread": 0,
        }

    df = df.copy()
    df["event_date"] = pd.to_datetime(df["event_date"], errors="coerce")
    df = df.dropna(subset=["event_date"])
    if df.empty:
        return {
            "acled_fatalities_30d": 0.0,
            "acled_battle_count": 0,
            "acled_civilian_violence": 0,
            "acled_explosion_count": 0,
            "acled_protest_count": 0,
            "acled_fatality_rate": 0.0,
            "acled_event_count_90d": 0,
            "acled_event_acceleration": 0.0,
            "acled_unique_actors": 0,
            "acled_geographic_spread": 0,
        }

    use_full_history = window_days >= 99999
    ref_date = df["event_date"].max()

    if use_full_history:
        recent = df
        recent_90 = df[df["event_date"] > ref_date - pd.Timedelta(days=90)]
        recent_30 = df[df["event_date"] > ref_date - pd.Timedelta(days=30)]
        older_60_90 = df[
            (df["event_date"] > ref_date - pd.Timedelta(days=90))
            & (df["event_date"] <= ref_date - pd.Timedelta(days=30))
        ]
        count_90 = len(recent_90)
        count_30 = len(recent_30)
        count_60_90 = len(older_60_90)
        days_span = max((ref_date - df["event_date"].min()).days, 1)
    else:
        recent = df[df["event_date"] > ref_date - pd.Timedelta(days=window_days)]
        recent_90 = df[df["event_date"] > ref_date - pd.Timedelta(days=90)]
        recent_30 = df[df["event_date"] > ref_date - pd.Timedelta(days=30)]
        older_60_90 = df[
            (df["event_date"] > ref_date - pd.Timedelta(days=90))
            & (df["event_date"] <= ref_date - pd.Timedelta(days=30))
        ]
        count_90 = len(recent_90)
        count_30 = len(recent_30)
        count_60_90 = len(older_60_90)
        days_span = max(window_days, 1)

    fatalities = pd.to_numeric(recent["fatalities"], errors="coerce").fillna(0)
    total_fatal = float(fatalities.sum())
    older_60_90_count = max(count_60_90, 1)

    return {
        "acled_fatalities_30d": total_fatal,
        "acled_battle_count": int(len(recent[recent["event_type"] == "Battles"])),
        "acled_civilian_violence": int(
            len(recent[recent["event_type"] == "Violence against civilians"])
        ),
        "acled_explosion_count": int(
            len(recent[recent["event_type"] == "Explosions/Remote violence"])
        ),
        "acled_protest_count": int(
            len(
                recent[
                    recent["event_type"].isin(["Protests", "Riots"])
                ]
            )
        ),
        "acled_fatality_rate": float(total_fatal / days_span),
        "acled_event_count_90d": count_90,
        "acled_event_acceleration": float(count_30 / older_60_90_count),
        "acled_unique_actors": int(recent["actor1"].nunique()) if "actor1" in recent.columns else 0,
        "acled_geographic_spread": int(recent["admin1"].nunique()) if "admin1" in recent.columns else 0,
    }


def _data_dir() -> Path:
    """Project data dir: data/acled/ (from repo root)."""
    # Resolve from this file: backend/ml/data/fetch_acled.py -> repo root
    root = Path(__file__).resolve().parents[3]
    d = root / "data" / "acled"
    d.mkdir(parents=True, exist_ok=True)
    return d


def fetch_acled_all_countries(
    token: str,
    start_date: str = "1997-01-01",
    end_date: str = "2026-12-31",
) -> None:
    """Fetch ACLED for every country in data/countries.json. Skips already-fetched files. 0.5s delay between requests."""
    root = Path(__file__).resolve().parents[3]
    countries_path = root / "data" / "countries.json"
    if not countries_path.exists():
        raise FileNotFoundError("data/countries.json not found; run --step countries first")
    with open(countries_path, encoding="utf-8") as f:
        countries = json.load(f)
    data_dir = _data_dir()

    for entry in tqdm(countries, desc="ACLED"):
        acled_name = entry.get("acled_name") or entry.get("name", "")
        safe = acled_name.lower().replace(" ", "_").replace("(", "").replace(")", "").replace("'", "").replace("-", "_").replace("__", "_")
        out_path = data_dir / f"{safe}.csv"
        if out_path.exists() and out_path.stat().st_size > 100:
            continue
        try:
            df = fetch_acled(acled_name, token, start_date=start_date, end_date=end_date)
            if len(df) > 0:
                df.to_csv(out_path, index=False)
                print(f"  {acled_name}: {len(df)} events")
            time.sleep(0.5)
        except Exception as e:
            print(f"  {acled_name}: {e}")


if __name__ == "__main__":
    load_dotenv()
    username = os.getenv("ACLED_USERNAME")
    password = os.getenv("ACLED_PASSWORD")
    if not username or not password:
        print("Set ACLED_USERNAME and ACLED_PASSWORD in .env")
        raise SystemExit(1)

    token = get_acled_token(username, password)
    print("Token acquired.")

    data_dir = _data_dir()
    country_names = list(COUNTRIES.values())

    for i, country in enumerate(country_names):
        try:
            df = fetch_acled(country, token)
            n = len(df)
            out_path = data_dir / f"{country.lower().replace(' ', '_')}.csv"
            if n > 0:
                df.to_csv(out_path, index=False)
            print(f"  {country}: {n} events -> {out_path.name}")
        except Exception as e:
            print(f"  {country}: failed - {e}")
        if i < len(country_names) - 1:
            time.sleep(1)

    # Sample features for Ukraine
    ukraine_csv = data_dir / "ukraine.csv"
    if ukraine_csv.exists():
        df_ua = pd.read_csv(ukraine_csv)
        features = compute_acled_features(df_ua)
        print("Sample compute_acled_features(Ukraine):", features)
    else:
        print("Ukraine CSV not found; skipping feature sample.")
