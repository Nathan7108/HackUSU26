# Sentinel AI — anomaly (S2-01)
# Isolation Forest anomaly detectors: one model per country on weekly GDELT aggregates.
# See GitHub Issue #15.

from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

ANOMALY_FEATURES = [
    "goldstein_mean",
    "goldstein_std",
    "goldstein_min",
    "mentions_total",
    "avg_tone",
    "event_count",
]

# Fallback list when no GDELT CSVs exist; normally train_all_anomaly_detectors iterates data/gdelt/*_events.csv
COUNTRIES = ["UA", "TW", "IR", "VE", "PK", "ET", "RS", "BR"]
MIN_WEEKS_FOR_TRAINING = 5

# GDELT CSV columns (must match fetch_gdelt.py output)
REQUIRED_GDELT_COLUMNS = [
    "SQLDATE",
    "GoldsteinScale",
    "NumMentions",
    "AvgTone",
    "EventCode",
]

# BigQuery weekly aggregate columns (one row per week)
WEEKLY_GDELT_COLUMNS = [
    "_weekly_aggregate",
    "GoldsteinScale",
    "_goldstein_std",
    "_goldstein_min",
    "_mentions_total",
    "AvgTone",
    "_event_count",
]


def _repo_root() -> Path:
    """Repo root: directory that contains data/gdelt/ (works from any cwd)."""
    this_file = Path(__file__).resolve()
    # Try __file__-based: backend/ml/anomaly.py -> parents[2] = repo root
    for level in [2, 3]:
        if level < len(this_file.parents):
            candidate = this_file.parents[level]
            if (candidate / "data" / "gdelt").exists():
                return candidate
    # Fallback: walk up from cwd to find data/gdelt
    cwd = Path.cwd()
    for parent in [cwd, *cwd.parents]:
        if (parent / "data" / "gdelt").exists():
            return parent
    return this_file.parents[1]  # last resort: backend/ parent


def _models_dir() -> Path:
    """models/ at repo root."""
    d = _repo_root() / "models"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _gdelt_path(country_code: str) -> Path:
    """Path to data/gdelt/{CC}_events.csv (same filenames as fetch_gdelt.py)."""
    return _repo_root() / "data" / "gdelt" / f"{country_code}_events.csv"


def _load_gdelt_csv(path: Path) -> pd.DataFrame | None:
    """
    Load GDELT CSV and verify required columns. Normalize column names (strip).
    If _weekly_aggregate is present, treat as BigQuery weekly aggregate (one row per week).
    Returns None if file missing, empty, or columns invalid.
    """
    if not path.exists():
        return None
    if path.stat().st_size <= 90:
        return None  # header-only or empty
    df = pd.read_csv(path)
    df.columns = df.columns.str.strip()
    if "_weekly_aggregate" in df.columns:
        missing = [c for c in WEEKLY_GDELT_COLUMNS if c not in df.columns]
        if missing:
            print(f"  Warning: {path.name} (weekly) missing columns: {missing}")
            return None
        return df
    missing = [c for c in REQUIRED_GDELT_COLUMNS if c not in df.columns]
    if missing:
        print(f"  Warning: {path.name} missing columns: {missing}")
        return None
    return df


def train_anomaly_detector(country_code: str, gdelt_df: pd.DataFrame):
    """
    Train one Isolation Forest per country.
    Learns country-specific 'normal' baseline from weekly aggregates.
    Saves models/anomaly_{CC}.pkl and models/scaler_{CC}.pkl.
    Supports both raw-event CSVs (groupby week) and BigQuery weekly aggregate CSVs (one row per week).
    """
    df = gdelt_df.copy()

    if "_weekly_aggregate" in df.columns:
        # BigQuery weekly format: each row is already a week; map columns directly
        for col in [
            "GoldsteinScale",
            "_goldstein_std",
            "_goldstein_min",
            "_mentions_total",
            "AvgTone",
            "_event_count",
        ]:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
        weekly = pd.DataFrame(
            {
                "goldstein_mean": df["GoldsteinScale"].values,
                "goldstein_std": df["_goldstein_std"].values,
                "goldstein_min": df["_goldstein_min"].values,
                "mentions_total": df["_mentions_total"].values,
                "avg_tone": df["AvgTone"].values,
                "event_count": df["_event_count"].values,
            }
        )
        weekly = weekly.fillna(0)
    else:
        # Raw-event format: aggregate by week
        sqldate = df["SQLDATE"].astype(str).str.replace(r"\.0$", "", regex=True)
        df["date"] = pd.to_datetime(sqldate, format="%Y%m%d", errors="coerce")
        df = df.dropna(subset=["date"])
        for col in ["GoldsteinScale", "NumMentions", "AvgTone"]:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

        df["week"] = df["date"].dt.to_period("W")
        weekly = (
            df.groupby("week")
            .agg(
                {
                    "GoldsteinScale": ["mean", "std", "min"],
                    "NumMentions": "sum",
                    "AvgTone": "mean",
                    "EventCode": "count",
                }
            )
            .reset_index()
        )
        weekly.columns = ["week"] + ANOMALY_FEATURES
        weekly = weekly.fillna(0)

    n_weeks = len(weekly)
    if n_weeks < 10:
        print(f"  Warning: {country_code} has only {n_weeks} weeks of data")
    if n_weeks == 0:
        print(f"  Warning: {country_code} has no weekly data, skipping")
        return None, None

    X = weekly[ANOMALY_FEATURES].values
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    model = IsolationForest(
        n_estimators=200, contamination=0.05, random_state=42
    )
    model.fit(X_scaled)

    models_dir = _models_dir()
    joblib.dump(model, models_dir / f"anomaly_{country_code}.pkl")
    joblib.dump(scaler, models_dir / f"scaler_{country_code}.pkl")
    print(f"  Trained anomaly detector for {country_code} on {n_weeks} weeks")
    return model, scaler


def train_all_anomaly_detectors() -> None:
    """Train Isolation Forest + scaler for every country with >= MIN_WEEKS_FOR_TRAINING weeks of GDELT data. Saves to models/."""
    gdelt_dir = _repo_root() / "data" / "gdelt"
    if not gdelt_dir.exists():
        print(f"  Warning: data/gdelt not found at {gdelt_dir}")
        return
    count = 0
    for csv_path in sorted(gdelt_dir.glob("*_events.csv")):
        country_code = csv_path.stem.replace("_events", "")
        try:
            df = _load_gdelt_csv(csv_path)
            if df is None or len(df) == 0:
                continue
            if "_weekly_aggregate" in df.columns:
                weeks = len(df)
            else:
                df = df.copy()
                sqldate = df["SQLDATE"].astype(str).str.replace(r"\.0$", "", regex=True)
                df["date"] = pd.to_datetime(sqldate, format="%Y%m%d", errors="coerce")
                df = df.dropna(subset=["date"])
                weeks = df["date"].dt.to_period("W").nunique()
            if weeks < MIN_WEEKS_FOR_TRAINING:
                continue
            train_anomaly_detector(country_code, df)
            count += 1
        except Exception as e:
            print(f"  Warning: {country_code} failed - {e}")
    print(f"Trained anomaly detectors for {count} countries")


def detect_anomaly(country_code: str, current_features: dict) -> dict:
    """
    Run anomaly detection on current features.
    Returns dict with anomaly_score (0–1), is_anomaly (bool), severity (LOW/MED/HIGH).
    If model files are missing, returns default LOW.
    """
    models_dir = _models_dir()
    model_path = models_dir / f"anomaly_{country_code}.pkl"
    scaler_path = models_dir / f"scaler_{country_code}.pkl"
    try:
        model = joblib.load(model_path)
        scaler = joblib.load(scaler_path)
    except FileNotFoundError:
        return {
            "anomaly_score": 0.0,
            "is_anomaly": False,
            "severity": "LOW",
        }

    X = np.array([[current_features.get(f, 0) for f in ANOMALY_FEATURES]])
    X_scaled = scaler.transform(X)
    raw_score = model.score_samples(X_scaled)[0]
    # Sigmoid normalization centered on Isolation Forest decision boundary (~-0.5)
    # Normal data (raw > -0.5) → low score; anomalous data (raw < -0.5) → high score
    anomaly_score = float(1.0 / (1.0 + np.exp(5.0 * (raw_score + 0.5))))
    anomaly_score = max(0.0, min(1.0, anomaly_score))
    is_anomaly = model.predict(X_scaled)[0] == -1

    severity = (
        "HIGH"
        if anomaly_score > 0.7
        else "MED"
        if anomaly_score > 0.4
        else "LOW"
    )
    return {
        "anomaly_score": round(float(anomaly_score), 3),
        "is_anomaly": bool(is_anomaly),
        "severity": severity,
    }


if __name__ == "__main__":
    print("Training anomaly detectors for all 8 countries...")
    train_all_anomaly_detectors()
    models_dir = _models_dir()
    pkl_files = list(models_dir.glob("*.pkl"))
    n_files = len(pkl_files)
    print(f"Models saved: {n_files} files in {models_dir}")
    if n_files > 0:
        print(f"  Files: {[f.name for f in sorted(pkl_files)]}")

    # Test Ukraine (or first country that has a model)
    print("\nTest detect_anomaly(..., current_features):")
    from backend.ml.data.fetch_gdelt import compute_gdelt_features

    test_country = "UA"
    gdelt_path = _gdelt_path(test_country)
    df_ua = _load_gdelt_csv(gdelt_path) if gdelt_path.exists() else None
    if df_ua is not None and len(df_ua) > 0:
        features_30d = compute_gdelt_features(df_ua, window_days=30)
        current = {
            "goldstein_mean": features_30d.get("gdelt_goldstein_mean", 0),
            "goldstein_std": features_30d.get("gdelt_goldstein_std", 0),
            "goldstein_min": features_30d.get("gdelt_goldstein_min", 0),
            "mentions_total": features_30d.get("gdelt_event_count", 0),
            "avg_tone": features_30d.get("gdelt_avg_tone", 0),
            "event_count": features_30d.get("gdelt_event_count", 0),
        }
    else:
        current = {f: 0.0 for f in ANOMALY_FEATURES}
        current["event_count"] = 0
    result = detect_anomaly(test_country, current)
    print(f"  detect_anomaly('{test_country}', current_features) = {result}")
    assert 0 <= result["anomaly_score"] <= 1, "anomaly_score must be in [0, 1]"
    assert result["severity"] in ("LOW", "MED", "HIGH")
    print("  OK: anomaly_score in [0,1], severity in LOW/MED/HIGH.")
