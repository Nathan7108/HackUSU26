"""Sentinel AI - Split BigQuery GDELT weekly exports into per-country CSV files.

Usage (from repo root):
    python scripts/split_gdelt_bigquery.py

Expects:
    data/gdelt/gdelt_part1.csv  (2015-2019)
    data/gdelt/gdelt_part2.csv  (2020-2026)

Produces:
    data/gdelt/{ISO2}_events.csv  (one per country, weekly aggregated format)
"""

import json
import sys
from datetime import datetime
from pathlib import Path

import pandas as pd


FIPS_TO_ISO2 = {
    "US": "US", "UK": "GB", "CH": "CN", "RS": "RU", "JA": "JP",
    "AS": "AU", "GM": "DE", "FR": "FR", "IT": "IT", "SP": "ES",
    "IN": "IN", "BR": "BR", "MX": "MX", "CA": "CA", "SF": "ZA",
    "TU": "TR", "IS": "IL", "EG": "EG", "PK": "PK", "KS": "KR",
    "KN": "KP", "TW": "TW", "VM": "VN", "TH": "TH", "BM": "MM",
    "NI": "NG", "CO": "CO", "AG": "DZ", "MO": "MA", "LY": "LY",
    "SU": "SD", "ET": "ET", "UG": "UG", "KE": "KE", "CG": "CD",
    "CF": "CG", "SA": "SA", "IR": "IR", "IZ": "IQ", "SY": "SY",
    "LE": "LB", "JO": "JO", "AE": "AE", "AF": "AF", "UP": "UA",
    "VE": "VE", "BL": "BO", "PE": "PE", "CI": "CL", "AR": "AR",
    "UY": "UY", "PA": "PY", "EC": "EC", "GY": "GY", "NS": "SR",
    "PO": "PL", "EZ": "CZ", "LO": "SK", "HU": "HU", "RO": "RO",
    "BU": "BG", "HR": "HR", "SI": "SI", "EN": "EE", "LG": "LV",
    "LH": "LT", "BO": "BY", "MD": "MD", "GG": "GE", "AM": "AM",
    "AJ": "AZ", "KZ": "KZ", "UZ": "UZ", "TX": "TM", "KG": "KG",
    "TI": "TJ", "FI": "FI", "SW": "SE", "NO": "NO", "DA": "DK",
    "IC": "IS", "EI": "IE", "BE": "BE", "NL": "NL", "LU": "LU",
    "SZ": "CH", "AU": "AT", "PL": "PL", "GR": "GR", "CY": "CY",
    "MT": "MT", "AL": "AL", "MK": "MK", "ME": "ME", "RI": "RS",
    "BK": "BA", "PN": "PA", "CS": "CR", "NU": "NI", "HO": "HN",
    "ES": "SV", "GT": "GT", "BH": "BZ", "HA": "HT", "DR": "DO",
    "CU": "CU", "JM": "JM", "TT": "TT", "BA": "BH", "QA": "QA",
    "KU": "KW", "MU": "OM", "YM": "YE", "CE": "LK", "BG": "BD",
    "NP": "NP", "CB": "KH", "LA": "LA", "ID": "ID", "MY": "MY",
    "SN": "SG", "RP": "PH", "PP": "PG", "NZ": "NZ", "FJ": "FJ",
    "BY": "BI", "RW": "RW", "SO": "SO", "DJ": "DJ", "ER": "ER",
    "WA": "NA", "BC": "BW", "ZI": "ZW", "MZ": "MZ", "MI": "MW",
    "ZA": "ZM", "AO": "AO", "GA": "GM", "SG": "SN", "ML": "ML",
    "UV": "BF", "IV": "CI", "GH": "GH", "TO": "TG", "BN": "BJ",
    "NG": "NE", "CT": "CF", "CM": "CM", "GB": "GA", "EK": "GQ",
    "TP": "ST", "LI": "LR", "SL": "SL", "GV": "GN", "PU": "GW",
    "CV": "CV", "MP": "MU", "MA": "MG", "SE": "SC", "CN": "KM",
    "MN": "MN", "PT": "PT",
}


def _week_to_sqldate(year_week: str) -> str:
    try:
        year, week = year_week.split("-W")
        d = datetime.strptime(f"{year} {int(week)} 1", "%G %V %u")
        return d.strftime("%Y%m%d")
    except Exception:
        return "20200101"


def main():
    for candidate in [Path(__file__).resolve().parent.parent, Path.cwd()]:
        if (candidate / "data" / "gdelt").exists():
            repo_root = candidate
            break
    else:
        print("ERROR: Cannot find data/gdelt/. Run from repo root.")
        sys.exit(1)

    gdelt_dir = repo_root / "data" / "gdelt"

    # Load and merge
    frames = []
    for name in ["gdelt_part1.csv", "gdelt_part2.csv"]:
        p = gdelt_dir / name
        if p.exists():
            df = pd.read_csv(p)
            print(f"Loaded {name}: {len(df):,} rows")
            frames.append(df)
        else:
            print(f"WARNING: {name} not found")

    if not frames:
        print("ERROR: Place gdelt_part1.csv and gdelt_part2.csv in data/gdelt/")
        sys.exit(1)

    merged = pd.concat(frames, ignore_index=True)
    print(f"Merged: {len(merged):,} rows, {merged['country_code'].nunique()} unique GDELT codes")

    # Build mapping
    countries_path = repo_root / "data" / "countries.json"
    iso3_to_iso2 = {}
    iso2_set = set()
    if countries_path.exists():
        with open(countries_path, encoding="utf-8") as f:
            countries = json.load(f)
        iso3_to_iso2 = {e["iso3"]: e["iso2"] for e in countries if e.get("iso3") and e.get("iso2")}
        iso2_set = {e["iso2"] for e in countries if e.get("iso2")}

    def to_iso2(code):
        if not isinstance(code, str) or not code.strip():
            return None
        code = code.strip().upper()
        if code in iso3_to_iso2:
            return iso3_to_iso2[code]
        if code in iso2_set:
            return code
        if code in FIPS_TO_ISO2:
            return FIPS_TO_ISO2[code]
        return None

    merged["iso2"] = merged["country_code"].apply(to_iso2)
    mapped_codes = merged[merged["iso2"].notna()]["country_code"].nunique()
    unmapped_codes = merged[merged["iso2"].isna()]["country_code"].unique()
    print(f"Mapped {mapped_codes} GDELT codes -> ISO2")
    if 0 < len(unmapped_codes) <= 30:
        print(f"Unmapped codes: {sorted(unmapped_codes)}")

    mapped_df = merged[merged["iso2"].notna()].copy()

    # Aggregate
    grouped = mapped_df.groupby(["iso2", "year_week"]).agg(
        goldstein_mean=("goldstein_mean", "mean"),
        goldstein_std=("goldstein_std", "mean"),
        goldstein_min=("goldstein_min", "min"),
        event_count=("event_count", "sum"),
        avg_tone=("avg_tone", "mean"),
        mentions_total=("mentions_total", "sum"),
        mention_weighted_tone=("mention_weighted_tone", "mean"),
        conflict_pct=("conflict_pct", "mean"),
    ).reset_index()

    # Write per-country CSVs
    count = 0
    for iso2, cdf in grouped.groupby("iso2"):
        cdf = cdf.sort_values("year_week").copy()
        cdf["SQLDATE"] = cdf["year_week"].apply(_week_to_sqldate)

        out_df = pd.DataFrame({
            "SQLDATE": cdf["SQLDATE"],
            "GoldsteinScale": cdf["goldstein_mean"],
            "AvgTone": cdf["avg_tone"],
            "NumMentions": cdf["mentions_total"].astype(int),
            "EventCode": "---",
            "Actor1CountryCode": iso2,
            "Actor2CountryCode": "",
            "_weekly_aggregate": True,
            "_goldstein_std": cdf["goldstein_std"].values,
            "_goldstein_min": cdf["goldstein_min"].values,
            "_event_count": cdf["event_count"].astype(int).values,
            "_mentions_total": cdf["mentions_total"].astype(int).values,
            "_mention_weighted_tone": cdf["mention_weighted_tone"].values,
            "_conflict_pct": cdf["conflict_pct"].values,
        })

        out_path = gdelt_dir / f"{iso2}_events.csv"
        out_df.to_csv(out_path, index=False)
        count += 1

    print(f"\nWrote {count} country CSV files to {gdelt_dir}")
    print(f"Total weekly records: {len(grouped):,}")

    # Verify key countries
    key = ["UA", "TW", "IR", "VE", "PK", "ET", "RS", "BR", "US", "CN", "RU", "DE", "JP", "GB"]
    print("\nKey country verification:")
    for cc in key:
        p = gdelt_dir / f"{cc}_events.csv"
        if p.exists():
            n = sum(1 for _ in open(p, encoding="utf-8")) - 1
            print(f"  {cc}: {n:>4} weeks")
        else:
            print(f"  {cc}: MISSING")

    print("\nDone! Next: update compute_gdelt_features, then run --step models")


if __name__ == "__main__":
    main()
