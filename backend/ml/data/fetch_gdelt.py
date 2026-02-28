# Sentinel AI — fetch GDELT v2 event data (S1-03)
# GDELT v2: masterfilelist.txt, .export.CSV.zip files, tab-separated no header.

import io
import json
import zipfile
from collections import defaultdict
from pathlib import Path
from urllib.request import urlopen, Request

import pandas as pd
from tqdm import tqdm

# Monitored countries: we use ISO2 in filenames/APIs; GDELT export uses ISO3 in Actor columns
COUNTRIES = ["UA", "TW", "IR", "VE", "PK", "ET", "RS", "BR"]
# ISO2 -> ISO3 for GDELT Actor1CountryCode / Actor2CountryCode (GDELT uses 3-letter)
ISO2_TO_ISO3 = {
    "UA": "UKR", "TW": "TWN", "IR": "IRN", "VE": "VEN", "PK": "PAK",
    "ET": "ETH", "RS": "SRB", "BR": "BRA",
}

# GDELT v2 export: 61 columns, tab-separated, no header. We only load these (0-based indices).
GDELT_COL_INDICES = [1, 7, 17, 26, 30, 31, 34]
GDELT_COL_NAMES = [
    "SQLDATE",
    "Actor1CountryCode",
    "Actor2CountryCode",
    "EventCode",
    "GoldsteinScale",
    "NumMentions",
    "AvgTone",
]

MASTERFILELIST_URL = "http://data.gdeltproject.org/gdeltv2/masterfilelist.txt"
# For hackathon/demo: 30 days (~2880 files). Set to 365 for full year.
DEFAULT_DAYS_BACK = 30
FILES_PER_DAY = 96  # one export every 15 minutes


def _data_dir() -> Path:
    """Project data dir: data/gdelt/ (from repo root)."""
    root = Path(__file__).resolve().parents[3]
    d = root / "data" / "gdelt"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _zips_dir() -> Path:
    """Cache dir for downloaded zip files: data/gdelt/zips/."""
    z = _data_dir() / "zips"
    z.mkdir(parents=True, exist_ok=True)
    return z


def _get_export_urls(days_back: int) -> list[str]:
    """Download master file list and return last (days_back * FILES_PER_DAY) export zip URLs."""
    req = Request(MASTERFILELIST_URL, headers={"User-Agent": "SentinelAI/1.0"})
    with urlopen(req, timeout=60) as r:
        text = r.read().decode("utf-8", errors="replace")
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    export_urls = [ln.split()[-1] for ln in lines if ".export.CSV.zip" in ln]
    n = min(days_back * FILES_PER_DAY, len(export_urls))
    return export_urls[-n:] if n else []


def _download_or_get_cached(url: str) -> Path | None:
    """Download zip from URL to data/gdelt/zips/ if not present. Return path or None on failure."""
    name = url.split("/")[-1]
    cache_path = _zips_dir() / name
    if cache_path.exists():
        return cache_path
    try:
        req = Request(url, headers={"User-Agent": "SentinelAI/1.0"})
        with urlopen(req, timeout=120) as r:
            data = r.read()
        cache_path.write_bytes(data)
        return cache_path
    except Exception as e:
        print(f"  Warning: skip {name}: {e}")
        return None


def _read_zip_csv(zip_path: Path, country_code: str) -> pd.DataFrame | None:
    """Extract CSV from zip, load selected columns, filter by country. Return DataFrame or None."""
    try:
        with zipfile.ZipFile(zip_path, "r") as z:
            names = z.namelist()
            if not names:
                return None
            with z.open(names[0]) as f:
                df = pd.read_csv(
                    io.BytesIO(f.read()),
                    sep="\t",
                    header=None,
                    usecols=GDELT_COL_INDICES,
                    names=GDELT_COL_NAMES,
                    dtype=str,
                    on_bad_lines="skip",
                    low_memory=False,
                )
        # GDELT uses 3-letter ISO codes; filter by ISO3 for this country
        iso3 = ISO2_TO_ISO3.get(country_code.upper(), country_code.upper())
        a1 = df["Actor1CountryCode"].fillna("").str.strip().str.upper()
        a2 = df["Actor2CountryCode"].fillna("").str.strip().str.upper()
        mask = (a1 == iso3) | (a2 == iso3)
        return df.loc[mask].copy()
    except Exception as e:
        print(f"  Warning: skip {zip_path.name}: {e}")
        return None


def fetch_gdelt_country(country_code: str, days_back: int = 365) -> pd.DataFrame:
    """
    Download GDELT v2 export files, filter by country, cache zips locally.
    country_code: ISO2 e.g. 'UA', 'IR', 'TW'
    Returns DataFrame with columns: SQLDATE, Actor1CountryCode, Actor2CountryCode,
    EventCode, GoldsteinScale, NumMentions, AvgTone.
    """
    urls = _get_export_urls(days_back)
    if not urls:
        return pd.DataFrame(columns=GDELT_COL_NAMES)

    chunks = []
    for url in tqdm(urls, desc=f"GDELT {country_code}", unit="file"):
        path = _download_or_get_cached(url)
        if path is None:
            continue
        part = _read_zip_csv(path, country_code)
        if part is not None and not part.empty:
            chunks.append(part)

    if not chunks:
        return pd.DataFrame(columns=GDELT_COL_NAMES)
    out = pd.concat(chunks, ignore_index=True)
    # Coerce numeric columns for features
    for col in ["GoldsteinScale", "NumMentions", "AvgTone"]:
        out[col] = pd.to_numeric(out[col], errors="coerce")
    return out


def _load_iso3_to_iso2() -> dict[str, str]:
    """Load countries.json and build ISO3 -> ISO2 for GDELT partition filenames."""
    root = Path(__file__).resolve().parents[3]
    path = root / "data" / "countries.json"
    if not path.exists():
        return {v: k for k, v in ISO2_TO_ISO3.items()}  # fallback: iso3 -> iso2
    with open(path, encoding="utf-8") as f:
        entries = json.load(f)
    return {e["iso3"]: e["iso2"] for e in entries if e.get("iso3") and e.get("iso2")}


def fetch_gdelt_all_countries(days_back: int = 3650) -> None:
    """
    Download GDELT v2 zips in chunks, extract events for ALL countries in single pass per chunk.
    days_back=3650 ≈ 10 years (full GDELT v2 history from 2015).
    Processes zips in chunks and uses append mode for CSVs to avoid memory issues.
    Writes data/gdelt/{ISO2}_events.csv using ISO2 from countries.json (GDELT uses ISO3 in Actor columns).
    """
    iso3_to_iso2 = _load_iso3_to_iso2()
    urls = _get_export_urls(days_back)
    data_dir = _data_dir()
    CHUNK_SIZE = 500

    # Track which country files we've already written (so first write has header, rest append)
    written_iso2 = set()

    for chunk_start in range(0, len(urls), CHUNK_SIZE):
        chunk_urls = urls[chunk_start : chunk_start + CHUNK_SIZE]
        country_frames = defaultdict(list)

        for url in tqdm(chunk_urls, desc=f"GDELT chunk {chunk_start // CHUNK_SIZE + 1}"):
            path = _download_or_get_cached(url)
            if path is None:
                continue
            try:
                with zipfile.ZipFile(path, "r") as z:
                    names = z.namelist()
                    if not names:
                        continue
                    with z.open(names[0]) as f:
                        df = pd.read_csv(
                            io.BytesIO(f.read()),
                            sep="\t",
                            header=None,
                            usecols=GDELT_COL_INDICES,
                            names=GDELT_COL_NAMES,
                            dtype=str,
                            on_bad_lines="skip",
                            low_memory=False,
                        )
                a1 = df["Actor1CountryCode"].fillna("").str.strip().str.upper()
                a2 = df["Actor2CountryCode"].fillna("").str.strip().str.upper()
                all_codes_iso3 = set(a1.unique()) | set(a2.unique())
                all_codes_iso3.discard("")

                for iso3 in all_codes_iso3:
                    iso2 = iso3_to_iso2.get(iso3)
                    if iso2 is None:
                        continue
                    mask = (a1 == iso3) | (a2 == iso3)
                    country_frames[iso2].append(df.loc[mask].copy())
            except Exception:
                continue

        for iso2, frames in country_frames.items():
            merged = pd.concat(frames, ignore_index=True)
            for col in ["GoldsteinScale", "NumMentions", "AvgTone"]:
                merged[col] = pd.to_numeric(merged[col], errors="coerce")
            out_path = data_dir / f"{iso2}_events.csv"
            if iso2 in written_iso2:
                merged.to_csv(out_path, mode="a", header=False, index=False)
            else:
                merged.to_csv(out_path, index=False)
                written_iso2.add(iso2)

        print(f"  Chunk {chunk_start // CHUNK_SIZE + 1}: {len(country_frames)} countries")

    csvs = list(data_dir.glob("*_events.csv"))
    print(f"GDELT complete: {len(csvs)} country files")


def compute_gdelt_features(df: pd.DataFrame, window_days: int = 30) -> dict:
    """
    Compute 10 ML-ready GDELT features per ML Guide Section 2.1.
    Handles BOTH formats:
      - Raw GDELT events (SQLDATE, GoldsteinScale, NumMentions, AvgTone, EventCode)
      - BigQuery weekly aggregates (has _weekly_aggregate column)
    """
    zeros = {
        "gdelt_goldstein_mean": 0.0, "gdelt_goldstein_std": 0.0,
        "gdelt_goldstein_min": 0.0, "gdelt_event_count": 0,
        "gdelt_avg_tone": 0.0, "gdelt_conflict_pct": 0.0,
        "gdelt_goldstein_mean_90d": 0.0, "gdelt_event_acceleration": 0.0,
        "gdelt_mention_weighted_tone": 0.0, "gdelt_volatility": 0.0,
    }
    if df is None or df.empty:
        return zeros

    df = df.copy()
    is_weekly = "_weekly_aggregate" in df.columns

    if is_weekly:
        df["date"] = pd.to_datetime(df["SQLDATE"].astype(str), format="%Y%m%d", errors="coerce")
        df = df.dropna(subset=["date"])
        if df.empty:
            return zeros

        ref_date = df["date"].max()
        window_weeks = max(window_days // 7, 1)
        recent = df[df["date"] > ref_date - pd.Timedelta(weeks=window_weeks)]
        recent_90 = df[df["date"] > ref_date - pd.Timedelta(weeks=13)]

        if recent.empty:
            return zeros

        ec = recent["_event_count"].fillna(0)
        ec_90 = recent_90["_event_count"].fillna(0)
        n_recent = int(ec.sum())
        n_90 = int(ec_90.sum())
        older = max(n_90 - n_recent, 1)

        def wmean(series, weights):
            w = weights.fillna(0)
            s = series.fillna(0)
            tw = w.sum()
            return float((s * w).sum() / tw) if tw > 0 else 0.0

        return {
            "gdelt_goldstein_mean": wmean(recent["GoldsteinScale"], ec),
            "gdelt_goldstein_std": float(recent["_goldstein_std"].mean()),
            "gdelt_goldstein_min": float(recent["_goldstein_min"].min()),
            "gdelt_event_count": n_recent,
            "gdelt_avg_tone": wmean(recent["AvgTone"], ec),
            "gdelt_conflict_pct": wmean(recent["_conflict_pct"], ec),
            "gdelt_goldstein_mean_90d": wmean(recent_90["GoldsteinScale"], ec_90),
            "gdelt_event_acceleration": float(n_recent / older),
            "gdelt_mention_weighted_tone": float(recent["_mention_weighted_tone"].mean()),
            "gdelt_volatility": float(recent["_goldstein_std"].mean()),
        }

    else:
        df["date"] = pd.to_datetime(df["SQLDATE"].astype(str), format="%Y%m%d", errors="coerce")
        df = df.dropna(subset=["date"])
        ref_date = df["date"].max()
        recent = df[df["date"] > ref_date - pd.Timedelta(days=window_days)]
        recent_90 = df[df["date"] > ref_date - pd.Timedelta(days=90)]

        def sm(s):
            return float(s.mean()) if len(s) > 0 else 0.0

        def ss(s):
            return float(s.std()) if len(s) > 1 else 0.0

        n_recent = len(recent)
        n_90 = len(recent_90)
        older_60_90 = max(n_90 - n_recent, 1)
        goldstein = recent["GoldsteinScale"]
        tone = recent["AvgTone"]
        mentions = recent["NumMentions"]

        return {
            "gdelt_goldstein_mean": sm(goldstein),
            "gdelt_goldstein_std": ss(recent["GoldsteinScale"]),
            "gdelt_goldstein_min": float(goldstein.min()) if n_recent > 0 else 0.0,
            "gdelt_event_count": n_recent,
            "gdelt_avg_tone": sm(tone),
            "gdelt_conflict_pct": float(len(recent[recent["GoldsteinScale"] < -5]) / max(n_recent, 1)),
            "gdelt_goldstein_mean_90d": sm(recent_90["GoldsteinScale"]),
            "gdelt_event_acceleration": float(n_recent / older_60_90),
            "gdelt_mention_weighted_tone": float(
                (tone * mentions).sum() / max(mentions.sum(), 1)
            ),
            "gdelt_volatility": ss(recent["GoldsteinScale"]),
        }


if __name__ == "__main__":
    days_back = DEFAULT_DAYS_BACK
    data_dir = _data_dir()
    print(f"Fetching GDELT v2 for {len(COUNTRIES)} countries (days_back={days_back})...")

    for country_code in COUNTRIES:
        try:
            df = fetch_gdelt_country(country_code, days_back=days_back)
            n = len(df)
            out_path = data_dir / f"{country_code}_events.csv"
            df.to_csv(out_path, index=False)  # always write (empty = zero-filled features for pipeline)
            print(f"  {country_code}: {n} events -> {out_path.name}")
        except Exception as e:
            print(f"  {country_code}: failed - {e}")

    # Sample compute_gdelt_features for Ukraine
    ua_path = data_dir / "UA_events.csv"
    if ua_path.exists():
        df_ua = pd.read_csv(ua_path)
        features = compute_gdelt_features(df_ua)
        print("Sample compute_gdelt_features(Ukraine):", features)
    else:
        print("UA_events.csv not found; skipping feature sample.")
