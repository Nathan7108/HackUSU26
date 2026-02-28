# Sentinel AI — XGBoost risk scorer (S2-02)
# 47 features -> 5 risk levels (LOW/MODERATE/ELEVATED/HIGH/CRITICAL) with confidence.
# See GitHub Issue #16.

import json
import math
import warnings
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder

from collections import Counter

from backend.ml.pipeline import FEATURE_COLUMNS, MONITORED_COUNTRIES
from backend.ml.data.fetch_gdelt import compute_gdelt_features
from backend.ml.data.fetch_ucdp import compute_ucdp_features

RISK_LABELS = ["LOW", "MODERATE", "ELEVATED", "HIGH", "CRITICAL"]

# --- Cached model and label encoder (loaded once, reused across all predict_risk calls) ---
_cached_model = None
_cached_le = None

# Weights for weighted probability score — higher classes contribute more (0-100).
CLASS_WEIGHTS = {
    "LOW": 0,
    "MODERATE": 25,
    "ELEVATED": 50,
    "HIGH": 75,
    "CRITICAL": 100,
}


def score_from_probabilities(probabilities: list, labels: list) -> int:
    """
    Compute a 0-100 risk score as the weighted average of class probabilities.
    Ensures score is semantically aligned with the class distribution.
    """
    score = 0.0
    for prob, label in zip(probabilities, labels):
        score += prob * CLASS_WEIGHTS.get(str(label), 0)
    return max(0, min(100, int(round(score))))


def level_from_score(score: int) -> str:
    """Deterministic mapping — score and level ALWAYS agree. Thresholds: 0-20 LOW, 21-40 MODERATE, 41-60 ELEVATED, 61-80 HIGH, 81-100 CRITICAL."""
    if score >= 81:
        return "CRITICAL"
    if score >= 61:
        return "HIGH"
    if score >= 41:
        return "ELEVATED"
    if score >= 21:
        return "MODERATE"
    return "LOW"


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _safe_acled_name(name: str) -> str:
    """Sanitize country/acled name for ACLED and UCDP filenames (match fetch_acled_all_countries and split_ucdp_global)."""
    return (
        name.lower()
        .replace(" ", "_")
        .replace("(", "")
        .replace(")", "")
        .replace("'", "")
        .replace("-", "_")
        .replace("__", "_")
    )


def _acled_features_from_group(group: pd.DataFrame, window_days: int = 30) -> dict:
    """
    Compute 10 ACLED features from a single group (e.g. one month of events).
    Used for training data where we don't have 'now' relative windows.
    """
    if group is None or group.empty:
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
    fatalities = pd.to_numeric(group.get("fatalities", pd.Series(dtype=float)), errors="coerce").fillna(0)
    total_fatal = float(fatalities.sum())
    n = len(group)
    event_type = group.get("event_type", pd.Series(dtype=object))
    event_type = event_type.astype(str)
    return {
        "acled_fatalities_30d": total_fatal,
        "acled_battle_count": int((event_type == "Battles").sum()),
        "acled_civilian_violence": int((event_type == "Violence against civilians").sum()),
        "acled_explosion_count": int((event_type == "Explosions/Remote violence").sum()),
        "acled_protest_count": int(event_type.isin(["Protests", "Riots"]).sum()),
        "acled_fatality_rate": total_fatal / max(window_days, 1),
        "acled_event_count_90d": n,
        "acled_event_acceleration": 1.0,
        "acled_unique_actors": int(group["actor1"].nunique()) if "actor1" in group.columns else 0,
        "acled_geographic_spread": int(group["admin1"].nunique()) if "admin1" in group.columns else 0,
    }


def _acled_features_from_period(full_df: pd.DataFrame, period, window_days: int = 30) -> dict:
    """
    Compute ACLED features for a given period using full country DataFrame for proper 90-day windows.
    """
    month_end = period.to_timestamp() + pd.offsets.MonthEnd(0)
    month_start = period.to_timestamp()

    recent_30 = full_df[(full_df["event_date"] > month_end - pd.Timedelta(days=30)) & (full_df["event_date"] <= month_end)]
    recent_90 = full_df[(full_df["event_date"] > month_end - pd.Timedelta(days=90)) & (full_df["event_date"] <= month_end)]
    older_60 = full_df[(full_df["event_date"] > month_end - pd.Timedelta(days=90)) & (full_df["event_date"] <= month_end - pd.Timedelta(days=30))]

    # Current month group
    current = full_df[(full_df["event_date"] >= month_start) & (full_df["event_date"] <= month_end)]

    if current.empty:
        return {
            "acled_fatalities_30d": 0.0,
            "acled_battle_count": 0,
            "acled_civilian_violence": 0,
            "acled_explosion_count": 0,
            "acled_protest_count": 0,
            "acled_fatality_rate": 0.0,
            "acled_event_count_90d": len(recent_90),
            "acled_event_acceleration": float(len(recent_30) / max(len(older_60), 1)),
            "acled_unique_actors": 0,
            "acled_geographic_spread": 0,
        }

    fatalities = pd.to_numeric(current["fatalities"], errors="coerce").fillna(0)
    total_fatal = float(fatalities.sum())
    event_type = current["event_type"].astype(str)

    return {
        "acled_fatalities_30d": total_fatal,
        "acled_battle_count": int((event_type == "Battles").sum()),
        "acled_civilian_violence": int((event_type == "Violence against civilians").sum()),
        "acled_explosion_count": int((event_type == "Explosions/Remote violence").sum()),
        "acled_protest_count": int(event_type.isin(["Protests", "Riots"]).sum()),
        "acled_fatality_rate": total_fatal / max(window_days, 1),
        "acled_event_count_90d": len(recent_90),
        "acled_event_acceleration": float(len(recent_30) / max(len(older_60), 1)),
        "acled_unique_actors": int(current["actor1"].nunique()) if "actor1" in current.columns else 0,
        "acled_geographic_spread": int(current["admin1"].nunique()) if "admin1" in current.columns else 0,
    }


def _label_from_events(group) -> str:
    """Composite risk label from fatalities and event diversity (battles, explosions, etc.)."""
    fatalities = pd.to_numeric(group.get("fatalities", pd.Series(0)), errors="coerce").fillna(0).sum()
    event_type = group.get("event_type", pd.Series(dtype=object)).astype(str)
    battles = (event_type == "Battles").sum()
    explosions = (event_type == "Explosions/Remote violence").sum()
    civilian_violence = (event_type == "Violence against civilians").sum()
    protests = event_type.isin(["Protests", "Riots"]).sum()

    # Composite score: fatalities dominate, but event diversity matters
    score = (
        fatalities * 1.0
        + battles * 5.0
        + explosions * 4.0
        + civilian_violence * 3.0
        + protests * 0.2
    )

    if score >= 1000:
        return "CRITICAL"
    if score >= 400:
        return "HIGH"
    if score >= 100:
        return "ELEVATED"
    if score >= 20:
        return "MODERATE"
    return "LOW"


def _load_country_auxiliary_features(root: Path, code: str, info: dict) -> dict:
    """
    Load UCDP and World Bank features for one country (country-level, not month-level).
    GDELT is loaded per-period in build_training_dataset() for month-specific features.
    """
    out = {}
    # UCDP: data/ucdp/{acled_name}_ged.csv (same sanitization as split_ucdp_global); fallback glob (Issue #27)
    acled_name = info["acled_name"]
    ucdp_path = root / "data" / "ucdp" / f"{_safe_acled_name(acled_name)}_ged.csv"
    if not ucdp_path.exists():
        ucdp_dir = root / "data" / "ucdp"
        first_word = acled_name.split()[0].lower()
        if first_word and len(first_word) > 1:
            candidates = list(ucdp_dir.glob(f"*{first_word}*_ged.csv"))
            if not candidates:
                candidates = list(ucdp_dir.glob(f"*{first_word}*ged*.csv"))
            if candidates:
                ucdp_path = candidates[0]
    if ucdp_path.exists():
        try:
            ucdp_df = pd.read_csv(ucdp_path)
            out.update(compute_ucdp_features(ucdp_df))
        except Exception:
            pass
    # World Bank: data/world_bank/{ISO3}.json
    iso3 = info.get("iso3", "")
    if iso3:
        wb_path = root / "data" / "world_bank" / f"{iso3}.json"
        if wb_path.exists():
            try:
                with open(wb_path, encoding="utf-8") as f:
                    wb_data = json.load(f)
                wb_features = wb_data.get("features", {}) or {}
                out.update(
                    {k: (v if v is not None else 0.0) for k, v in wb_features.items()}
                )
            except Exception:
                pass
    return out


def build_training_dataset() -> pd.DataFrame:
    """
    Build labeled training dataset from ACLED (country-month aggregation).
    Enriches each country-month with month-specific GDELT, rolling ACLED 90d, UCDP, and World Bank.
    Returns DataFrame with FEATURE_COLUMNS + 'risk_label' + 'country_code'.
    """
    root = _repo_root()
    data_acled = root / "data" / "acled"
    frames = []

    for code, info in MONITORED_COUNTRIES.items():
        acled_name = info["acled_name"]
        acled_file = _safe_acled_name(acled_name) + ".csv"
        acled_path = data_acled / acled_file
        if not acled_path.exists():
            continue
        try:
            acled_df = pd.read_csv(acled_path)
        except Exception as e:
            warnings.warn(f"ACLED {code} read failed: {e}")
            continue
        if "event_date" not in acled_df.columns or acled_df.empty:
            continue
        acled_df["event_date"] = pd.to_datetime(acled_df["event_date"], errors="coerce")
        acled_df = acled_df.dropna(subset=["event_date"])
        if acled_df.empty:
            continue
        acled_df["year_month"] = acled_df["event_date"].dt.to_period("M")

        # GDELT: load once per country, parse dates for per-period windowing
        gdelt_df = None
        gdelt_path = root / "data" / "gdelt" / f"{code}_events.csv"
        if gdelt_path.exists():
            try:
                gdelt_df = pd.read_csv(gdelt_path)
                gdelt_df.columns = gdelt_df.columns.str.strip()
                gdelt_df["date"] = pd.to_datetime(gdelt_df["SQLDATE"].astype(str), format="%Y%m%d", errors="coerce")
                gdelt_df = gdelt_df.dropna(subset=["date"])
            except Exception:
                gdelt_df = None

        # Country-level features (UCDP + World Bank only; GDELT is per-period below)
        country_features = _load_country_auxiliary_features(root, code, info)

        for period, group in acled_df.groupby("year_month"):
            features = _acled_features_from_period(acled_df, period, window_days=30)
            features.update(country_features)

            # Month-specific GDELT features
            if gdelt_df is not None and not gdelt_df.empty:
                month_end = period.to_timestamp() + pd.offsets.MonthEnd(0)
                mask_90 = gdelt_df["date"] > (month_end - pd.Timedelta(days=90))
                gdelt_window = gdelt_df[mask_90 & (gdelt_df["date"] <= month_end)]
                if not gdelt_window.empty:
                    gdelt_features = compute_gdelt_features(gdelt_window, window_days=30)
                else:
                    gdelt_features = compute_gdelt_features(pd.DataFrame(), window_days=30)
                features.update(gdelt_features)
            else:
                features.update(compute_gdelt_features(pd.DataFrame(), window_days=30))

            for col in FEATURE_COLUMNS:
                if col not in features:
                    features[col] = 0.0
            features["risk_label"] = _label_from_events(group)
            features["country_code"] = code
            frames.append(features)

    if not frames:
        return pd.DataFrame(columns=FEATURE_COLUMNS + ["risk_label", "country_code"])

    df = pd.DataFrame(frames)
    int_cols = {
        "gdelt_event_count",
        "acled_battle_count",
        "acled_civilian_violence",
        "acled_explosion_count",
        "acled_protest_count",
        "acled_event_count_90d",
        "acled_unique_actors",
        "acled_geographic_spread",
        "ucdp_state_conflict_years",
        "headline_volume",
    }
    for c in int_cols:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0).astype(int)
    return df


def train_risk_scorer(training_df: pd.DataFrame):
    """
    Train XGBoost classifier on FEATURE_COLUMNS, save model and label encoder.
    Prints classification_report and top 10 feature importances.
    """
    root = _repo_root()
    models_dir = root / "models"
    models_dir.mkdir(parents=True, exist_ok=True)

    if training_df.empty or "risk_label" not in training_df.columns:
        raise ValueError("training_df must have risk_label and at least one row")

    # Merge CRITICAL into HIGH if CRITICAL has too few samples for stratify
    df = training_df.copy()
    label_counts = df["risk_label"].value_counts()
    if "CRITICAL" in label_counts and label_counts.get("CRITICAL", 0) < 2:
        df.loc[df["risk_label"] == "CRITICAL", "risk_label"] = "HIGH"
    if "HIGH" in label_counts and label_counts.get("HIGH", 0) < 2:
        df.loc[df["risk_label"] == "HIGH", "risk_label"] = "ELEVATED"

    le = LabelEncoder()
    le.fit(RISK_LABELS)
    y = le.transform(df["risk_label"].astype(str))
    X = df[FEATURE_COLUMNS].fillna(0)

    # Class weighting: inverse frequency so LOW does not dominate
    counts = Counter(y)
    total = len(y)
    n_classes = len(counts)
    weights = {cls: total / (n_classes * count) for cls, count in counts.items()}
    sample_weights = np.array([weights[label] for label in y])

    stratify_arg = y if all((y == i).sum() >= 2 for i in range(len(le.classes_))) else None
    try:
        X_train, X_test, y_train, y_test, sw_train, sw_test = train_test_split(
            X, y, sample_weights, test_size=0.2, random_state=42, stratify=stratify_arg
        )
    except ValueError:
        X_train, X_test, y_train, y_test, sw_train, sw_test = train_test_split(
            X, y, sample_weights, test_size=0.2, random_state=42
        )

    fit_kw = {}
    if len(X_test) >= 10:
        fit_kw["eval_set"] = [(X_test, y_test)]
        fit_kw["verbose"] = 50

    model_kw = dict(
        n_estimators=500,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        eval_metric="mlogloss",
        random_state=42,
    )
    if len(X_test) >= 10:
        model_kw["early_stopping_rounds"] = 20
    model = xgb.XGBClassifier(**model_kw)
    model.fit(X_train, y_train, sample_weight=sw_train, **fit_kw)

    y_pred = model.predict(X_test)
    target_names = [le.inverse_transform([i])[0] for i in range(len(le.classes_))]
    print("Classification report (test set):")
    print(classification_report(y_test, y_pred, target_names=target_names, zero_division=0))

    importance = pd.Series(model.feature_importances_, index=FEATURE_COLUMNS)
    print("\nTop 10 Feature Importances:")
    print(importance.nlargest(10))

    model_path = models_dir / "risk_scorer.pkl"
    encoder_path = models_dir / "risk_label_encoder.pkl"
    joblib.dump(model, model_path)
    joblib.dump(le, encoder_path)
    print(f"\nSaved: {model_path}, {encoder_path}")
    return model


def predict_risk(features: dict) -> dict:
    """
    Load trained model and predict risk from a 47-feature dict (e.g. from SentinelFeaturePipeline.compute()).
    Returns dict with risk_level, risk_score (0-100), confidence, probabilities, top_drivers (5 names).
    risk_level is always derived from risk_score thresholds so they never contradict.
    """
    global _cached_model, _cached_le
    if _cached_model is None or _cached_le is None:
        root = _repo_root()
        model_path = root / "models" / "risk_scorer.pkl"
        encoder_path = root / "models" / "risk_label_encoder.pkl"
        if not model_path.exists() or not encoder_path.exists():
            raise FileNotFoundError("Train the risk scorer first: python -m backend.ml.risk_scorer")
        _cached_model = joblib.load(model_path)
        _cached_le = joblib.load(encoder_path)
    model = _cached_model
    le = _cached_le

    X = pd.DataFrame([{col: features.get(col, 0) for col in FEATURE_COLUMNS}])
    probabilities = model.predict_proba(X)[0]
    # Ordered labels matching probabilities array (model/encoder order)
    labels = list(le.inverse_transform(range(len(probabilities))))

    # --- Probability smoothing: prevent overconfident 100% predictions ---
    n_classes = len(probabilities)
    epsilon = 0.02
    probabilities = probabilities * (1 - epsilon * n_classes) + epsilon
    probabilities = probabilities / probabilities.sum()  # re-normalize

    # XGBoost-based score from smoothed probabilities
    xgb_score = score_from_probabilities(probabilities.tolist(), labels)

    # --- Feature-based heuristic score for blending (prevents all-100 clustering) ---
    # NOTE: ACLED features are cumulative all-time (window_days=99999 in pipeline),
    # so we use log-scale normalization to compress wide ranges properly.
    fatalities_raw = max(float(features.get("acled_fatalities_30d", 0) or 0), 0)
    battles_raw = max(float(features.get("acled_battle_count", 0) or 0), 0)
    explosions_raw = max(float(features.get("acled_explosion_count", 0) or 0), 0)
    protests_raw = max(float(features.get("acled_protest_count", 0) or 0), 0)
    goldstein = float(features.get("gdelt_goldstein_mean", 0) or 0)
    conflict_pct = float(features.get("gdelt_conflict_pct", 0) or 0)
    inflation = float(features.get("wb_inflation_latest", 0) or 0)
    ucdp_deaths = float(features.get("ucdp_total_deaths", 0) or 0)

    # Sqrt-scale normalization: sqrt(x)/sqrt(max) maps [0, max] -> [0, 1]
    # Sqrt gives much better differentiation than log for cumulative data:
    # 50K fatalities = 0.50, 10K = 0.22, 1K = 0.07, 100 = 0.02
    fat_n = min(1.0, math.sqrt(fatalities_raw) / math.sqrt(200000))
    bat_n = min(1.0, math.sqrt(battles_raw) / math.sqrt(100000))
    exp_n = min(1.0, math.sqrt(explosions_raw) / math.sqrt(50000))
    pro_n = min(1.0, math.sqrt(protests_raw) / math.sqrt(100000))
    ucdp_n = min(1.0, math.sqrt(ucdp_deaths) / math.sqrt(500000))

    heuristic = min(100, (
        fat_n * 30
        + bat_n * 20
        + exp_n * 15
        + pro_n * 10
        + max(0, -goldstein) * 3
        + conflict_pct * 20
        + min(inflation, 50) * 0.3
        + ucdp_n * 15
    ))

    # Blend: 50% XGBoost, 50% heuristic — balanced between ML and feature-grounded scoring
    risk_score = max(0, min(100, int(round(xgb_score * 0.50 + heuristic * 0.50))))

    # Level derived from score — ALWAYS consistent
    risk_level = level_from_score(risk_score)

    # Confidence = probability of the derived level's class
    level_idx = labels.index(risk_level) if risk_level in labels else 0
    confidence = float(probabilities[level_idx])

    # Per-sample SHAP-like contributions via XGBoost pred_contribs
    try:
        booster = model.get_booster()
        import xgboost as _xgb
        dmat = _xgb.DMatrix(X, feature_names=FEATURE_COLUMNS)
        contribs = booster.predict(dmat, pred_contribs=True)[0]  # shape (n_classes, n_features+1)
        # Sum absolute contributions across classes for each feature (exclude bias term)
        if contribs.ndim == 2:
            per_feature = np.abs(contribs[:, :-1]).sum(axis=0)  # (n_features,)
        else:
            # Binary or single-output: contribs is (n_features+1,)
            per_feature = np.abs(contribs[:-1])
        top_features = sorted(
            zip(FEATURE_COLUMNS, per_feature), key=lambda x: -x[1]
        )[:5]
        top_drivers = [str(f) for f, _ in top_features]
    except Exception:
        # Fallback to global importances if pred_contribs fails
        importance = model.feature_importances_
        top_features = sorted(
            zip(FEATURE_COLUMNS, importance), key=lambda x: -x[1]
        )[:5]
        top_drivers = [str(f) for f, _ in top_features]

    proba_dict = {
        str(labels[i]): round(float(probabilities[i]), 3)
        for i in range(len(probabilities))
    }
    return {
        "risk_level": risk_level,
        "risk_score": risk_score,
        "confidence": round(confidence, 3),
        "probabilities": proba_dict,
        "top_drivers": top_drivers,
    }


if __name__ == "__main__":
    print("Building training dataset from ACLED...")
    training_df = build_training_dataset()
    print(f"Dataset shape: {training_df.shape}")
    if training_df.empty:
        print("No training data. Ensure data/acled/*.csv exist for monitored countries.")
        raise SystemExit(1)
    print("Risk label distribution:")
    print(training_df["risk_label"].value_counts())

    print("\nTraining XGBoost risk scorer...")
    train_risk_scorer(training_df)

    print("\nTesting predict_risk() with sample features from pipeline...")
    from backend.ml.pipeline import SentinelFeaturePipeline

    pipeline = SentinelFeaturePipeline("UA", "Ukraine")
    try:
        all_features = SentinelFeaturePipeline.compute_all_countries()
        sample = all_features.get("UA") or next(iter(all_features.values()))
    except Exception:
        sample = {k: 0.0 for k in FEATURE_COLUMNS}
    result = predict_risk(sample)
    print("Sample prediction:", result)
