# Sentinel AI — LSTM risk forecaster (S2-04)
# 90-day sequences -> 30/60/90 day risk predictions + trend. See GitHub Issue #17.

import json
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader

from backend.ml.pipeline import (
    FEATURE_COLUMNS,
    MONITORED_COUNTRIES,
    SentinelFeaturePipeline,
)

# 12 daily features for time series (issue #17)
SEQUENCE_FEATURES = [
    "risk_score",
    "gdelt_goldstein_mean",
    "gdelt_event_count",
    "acled_fatalities_30d",
    "acled_battle_count",
    "finbert_negative_score",
    "wb_gdp_growth_latest",
    "anomaly_score",
    "gdelt_avg_tone",
    "gdelt_event_acceleration",
    "ucdp_conflict_intensity",
    "econ_composite_score",
]

SEQUENCE_LEN = 90
HORIZON_DAYS = [30, 60, 90]
MIN_DAYS_FOR_SEQUENCE = SEQUENCE_LEN + 90  # 90 input + 90 for last target


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _models_dir() -> Path:
    d = _repo_root() / "models"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _safe_float(x) -> float:
    if x is None or (isinstance(x, float) and np.isnan(x)):
        return 0.0
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0.0


# --- RiskLSTM with attention (ML Guide Section 3.4) ---
class RiskLSTM(nn.Module):
    def __init__(
        self,
        input_size: int = 12,
        hidden_size: int = 128,
        num_layers: int = 2,
        output_size: int = 3,
        dropout: float = 0.2,
    ):
        super().__init__()
        self.input_size = input_size
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0,
        )
        self.attention = nn.Linear(hidden_size, 1)
        self.fc = nn.Sequential(
            nn.Linear(hidden_size, 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, output_size),
            nn.Sigmoid(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        lstm_out, _ = self.lstm(x)
        attention_weights = torch.softmax(
            self.attention(lstm_out).squeeze(-1), dim=1
        )
        context = (lstm_out * attention_weights.unsqueeze(-1)).sum(dim=1)
        return self.fc(context) * 100  # Scale to 0-100


class RiskSequenceDataset(Dataset):
    """Dataset of (sequence, target) for DataLoader."""

    def __init__(self, sequences: list[np.ndarray], targets: list[np.ndarray]):
        self.sequences = [np.asarray(s, dtype=np.float32) for s in sequences]
        self.targets = [np.asarray(t, dtype=np.float32) for t in targets]

    def __len__(self) -> int:
        return len(self.sequences)

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, torch.Tensor]:
        return (
            torch.from_numpy(self.sequences[idx]),
            torch.from_numpy(self.targets[idx]),
        )


def _daily_gdelt_features(gdelt_df: pd.DataFrame) -> pd.DataFrame:
    """Aggregate GDELT by day; return DataFrame with date index and feature columns."""
    if gdelt_df is None or gdelt_df.empty or "SQLDATE" not in gdelt_df.columns:
        return pd.DataFrame()
    df = gdelt_df.copy()
    df["date"] = pd.to_datetime(
        df["SQLDATE"].astype(str).str.replace(r"\.0$", "", regex=True),
        format="%Y%m%d",
        errors="coerce",
    )
    df = df.dropna(subset=["date"])
    for col in ["GoldsteinScale", "NumMentions", "AvgTone"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    daily = (
        df.groupby(df["date"].dt.date)
        .agg(
            {
                "GoldsteinScale": ["mean", "std", "min", "count"],
                "NumMentions": "sum",
                "AvgTone": "mean",
            }
        )
        .reset_index()
    )
    daily.columns = [
        "date",
        "gdelt_goldstein_mean",
        "gdelt_goldstein_std",
        "gdelt_goldstein_min",
        "gdelt_event_count",
        "gdelt_mentions_sum",
        "gdelt_avg_tone",
    ]
    daily["date"] = pd.to_datetime(daily["date"])
    daily["gdelt_event_acceleration"] = 1.0  # placeholder
    if "GoldsteinScale" in df.columns:
        conflict = df.groupby(df["date"].dt.date)["GoldsteinScale"].apply(
            lambda s: (s < -5).mean()
        )
        conflict = conflict.reindex(daily["date"].dt.date).values
        daily["gdelt_conflict_pct"] = np.nan_to_num(conflict, 0)
    else:
        daily["gdelt_conflict_pct"] = 0.0
    return daily


def _daily_acled_features(acled_df: pd.DataFrame) -> pd.DataFrame:
    """Rolling 30d ACLED aggregates per day; one row per day with events in window."""
    if acled_df is None or acled_df.empty or "event_date" not in acled_df.columns:
        return pd.DataFrame()
    df = acled_df.copy()
    df["event_date"] = pd.to_datetime(df["event_date"], errors="coerce")
    df = df.dropna(subset=["event_date"])
    if df.empty:
        return pd.DataFrame()
    df["date"] = df["event_date"].dt.normalize()
    df["fatalities"] = pd.to_numeric(df.get("fatalities", 0), errors="coerce").fillna(0)
    et = df.get("event_type", pd.Series(dtype=str)).astype(str)
    df["battle"] = (et == "Battles").astype(int)
    df["civ_violence"] = (et == "Violence against civilians").astype(int)
    df["explosion"] = (et == "Explosions/Remote violence").astype(int)
    df["protest"] = et.isin(["Protests", "Riots"]).astype(int)
    daily = df.groupby("date").agg(
        acled_fatalities_30d=("fatalities", "sum"),
        aled_battle_count=("battle", "sum"),
        acled_civilian_violence=("civ_violence", "sum"),
        acled_explosion_count=("explosion", "sum"),
        acled_protest_count=("protest", "sum"),
    )
    daily = daily.rename(columns={"aled_battle_count": "acled_battle_count"})
    daily["acled_event_count_90d"] = df.groupby("date").size()
    day_range = pd.date_range(daily.index.min(), daily.index.max(), freq="D")
    daily = daily.reindex(day_range).fillna(0).astype({"acled_event_count_90d": int})
    daily = daily.rolling(window=31, min_periods=1).sum().reset_index()
    daily = daily.rename(columns={"index": "date"})
    return daily


def _risk_score_from_features(f: dict) -> float:
    """Derive 0-100 risk_score from pipeline-style features (political_risk_score/conflict_composite)."""
    return min(
        100.0,
        max(
            0.0,
            _safe_float(f.get("political_risk_score", f.get("conflict_composite", 0))),
        ),
    )


def _build_daily_df_one_country(
    country_code: str,
    gdelt_df: pd.DataFrame,
    acled_df: pd.DataFrame,
    ucdp_features: dict,
    wb_features: dict,
) -> pd.DataFrame:
    """
    Build one DataFrame with one row per day and columns aligned to SEQUENCE_FEATURES.
    Uses real daily data where available; fills missing with 0 or constant (UCDP/WB).
    """
    gdaily = _daily_gdelt_features(gdelt_df)
    adaily = _daily_acled_features(acled_df)
    # Sentiment placeholder (no daily sentiment in hackathon)
    sentiment = {
        "finbert_negative_score": 0.0,
        "finbert_positive_score": 0.0,
        "finbert_neutral_score": 1.0,
    }
    ucdp = ucdp_features or {}
    wb = wb_features or {}
    # Date range: union of GDELT and ACLED days
    dates = set()
    if not gdaily.empty:
        gdaily = gdaily.copy()
        gdaily["date"] = gdaily["date"].dt.normalize()
        dates.update(gdaily["date"].tolist())
    if not adaily.empty:
        adaily = adaily.copy()
        adaily["date"] = adaily["date"].dt.normalize()
        dates.update(adaily["date"].tolist())
    if not dates:
        return pd.DataFrame()
    all_dates = pd.DatetimeIndex(sorted(dates)).normalize()
    base = pd.DataFrame({"date": all_dates})
    if not gdaily.empty:
        base = base.merge(gdaily, on="date", how="left")
    if not adaily.empty:
        base = base.merge(adaily, on="date", how="left")
    for c in [
        "gdelt_goldstein_mean", "gdelt_event_count", "gdelt_avg_tone",
        "gdelt_event_acceleration", "gdelt_conflict_pct",
        "acled_fatalities_30d", "acled_battle_count", "acled_civilian_violence",
        "acled_explosion_count", "acled_protest_count", "acled_event_count_90d",
    ]:
        if c not in base.columns:
            base[c] = 0
    base = base.fillna(0)
    conflict_composite = (
        base["acled_fatalities_30d"] / 200 * 40
        + base["acled_battle_count"] / 50 * 30
        + np.maximum(0, -base["gdelt_goldstein_mean"]) / 10 * 30
    ).clip(0, 100)
    base["risk_score"] = conflict_composite
    base["finbert_negative_score"] = 0.0
    base["wb_gdp_growth_latest"] = _safe_float(wb.get("wb_gdp_growth_latest", 0))
    base["anomaly_score"] = 0.0
    if "gdelt_event_acceleration" not in base.columns:
        base["gdelt_event_acceleration"] = 1.0
    base["ucdp_conflict_intensity"] = _safe_float(ucdp.get("ucdp_conflict_intensity", 0))
    base["econ_composite_score"] = _safe_float(wb.get("econ_composite_score", 0))
    return base


def _interpolate_weekly_or_monthly_to_daily(
    coarse_df: pd.DataFrame, num_days: int
) -> pd.DataFrame:
    """
    Create synthetic daily series from coarse (e.g. weekly/monthly) data.
    coarse_df must have 'date' and SEQUENCE_FEATURES columns.
    Expands to num_days by forward-fill / interpolation.
    """
    if coarse_df is None or coarse_df.empty or num_days < 1:
        return pd.DataFrame()
    feat_cols = [c for c in SEQUENCE_FEATURES if c in coarse_df.columns]
    if "date" not in coarse_df.columns or not feat_cols:
        return pd.DataFrame()
    coarse_df = coarse_df.sort_values("date").reset_index(drop=True)
    min_d = pd.Timestamp(coarse_df["date"].min()).normalize()
    day_range = pd.date_range(min_d, periods=num_days, freq="D")
    idx_df = coarse_df.set_index(pd.to_datetime(coarse_df["date"]).dt.normalize())
    reindexed = idx_df.reindex(day_range)
    reindexed = reindexed.ffill().bfill()
    for c in feat_cols:
        if c in reindexed.columns:
            reindexed[c] = reindexed[c].fillna(0)
    reindexed = reindexed.reset_index().rename(columns={"index": "date"})
    return reindexed


def build_training_sequences() -> tuple[list[np.ndarray], list[np.ndarray]]:
    """
    Build (sequences, targets) from all available country data.
    - Real daily data: aggregate GDELT/ACLED by day, build 90-day windows.
    - If insufficient real daily data (< MIN_DAYS_FOR_SEQUENCE), create synthetic
      daily sequences by interpolating weekly/monthly aggregates to daily.
    sequences: list of (90, 12) arrays
    targets: list of (3,) arrays [score_30d, score_60d, score_90d]
    """
    root = _repo_root()
    data_gdelt = root / "data" / "gdelt"
    data_acled = root / "data" / "acled"
    data_ucdp = root / "data" / "ucdp"
    data_wb = root / "data" / "world_bank"

    all_sequences: list[np.ndarray] = []
    all_targets: list[np.ndarray] = []

    for code, info in MONITORED_COUNTRIES.items():
        acled_name = info["acled_name"]
        iso3 = info["iso3"]
        acled_file = acled_name.lower().replace(" ", "_") + ".csv"
        acled_path = data_acled / acled_file
        gdelt_path = data_gdelt / f"{code}_events.csv"
        gdelt_df = pd.DataFrame()
        if gdelt_path.exists():
            try:
                gdelt_df = pd.read_csv(gdelt_path)
            except Exception as e:
                warnings.warn(f"Forecaster GDELT {code}: {e}")
        acled_df = pd.DataFrame()
        if acled_path.exists():
            try:
                acled_df = pd.read_csv(acled_path)
            except Exception as e:
                warnings.warn(f"Forecaster ACLED {code}: {e}")

        ucdp_features = {}
        safe = acled_name.lower().replace(" ", "_").replace("(", "").replace(")", "")
        ucdp_path = data_ucdp / f"{safe}_ged.csv"
        if ucdp_path.exists():
            try:
                from backend.ml.data.fetch_ucdp import compute_ucdp_features
                ucdp_df = pd.read_csv(ucdp_path)
                ucdp_features = compute_ucdp_features(ucdp_df, window_years=5)
            except Exception:
                pass
        wb_features = {}
        wb_path = data_wb / f"{iso3}.json"
        if wb_path.exists():
            try:
                with open(wb_path, encoding="utf-8") as f:
                    wb_features = json.load(f).get("features", {})
            except Exception:
                pass

        daily_df = _build_daily_df_one_country(
            code, gdelt_df, acled_df, ucdp_features, wb_features
        )
        if daily_df.empty:
            continue
        daily_df = daily_df.sort_values("date").drop_duplicates(subset=["date"]).reset_index(drop=True)
        # Cap to last 400 days to keep training fast when data is large
        if len(daily_df) > 400:
            daily_df = daily_df.tail(400).reset_index(drop=True)
        n_days = len(daily_df)
        if n_days < MIN_DAYS_FOR_SEQUENCE:
            # Synthetic: interpolate weekly/monthly to daily to get enough length
            if n_days >= 4:
                coarse = daily_df.copy()
                coarse["date"] = pd.to_datetime(coarse["date"])
                coarse = coarse.set_index("date").resample("7D").mean().reset_index()
                coarse = coarse.ffill().bfill()
                for c in SEQUENCE_FEATURES:
                    if c not in coarse.columns:
                        coarse[c] = 0.0
                synth_days = max(MIN_DAYS_FOR_SEQUENCE, 200)
                daily_df = _interpolate_weekly_or_monthly_to_daily(coarse, synth_days)
                if not daily_df.empty:
                    n_days = len(daily_df)
            if n_days < MIN_DAYS_FOR_SEQUENCE:
                # Replicate last row to get at least one 90+90 window
                need = MIN_DAYS_FOR_SEQUENCE - n_days
                for _ in range(need):
                    daily_df = pd.concat(
                        [daily_df, daily_df.iloc[-1:].copy()], ignore_index=True
                    )
                n_days = len(daily_df)
        if "date" in daily_df.columns:
            daily_df = daily_df.sort_values("date").reset_index(drop=True)
        cols = [c for c in SEQUENCE_FEATURES if c in daily_df.columns]
        missing = [c for c in SEQUENCE_FEATURES if c not in daily_df.columns]
        for c in missing:
            daily_df[c] = 0.0
        values = daily_df[SEQUENCE_FEATURES].fillna(0).astype(np.float32).values
        for i in range(SEQUENCE_LEN, len(values) - 90):
            seq = values[i - SEQUENCE_LEN : i]
            t30 = values[i + 29][0]
            t60 = values[i + 59][0]
            t90 = values[i + 89][0]
            all_sequences.append(seq)
            all_targets.append(np.array([t30, t60, t90], dtype=np.float32))
    return all_sequences, all_targets


def train_forecaster(
    country_sequences: list[np.ndarray],
    country_targets: list[np.ndarray],
    epochs: int = 50,
    batch_size: int = 64,
    lr: float = 0.001,
) -> RiskLSTM:
    """
    Train LSTM forecaster on (sequences, targets). Saves models/forecaster.pt.
    If no data, saves a randomly initialized model so forecast_risk() still runs.
    """
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = RiskLSTM(
        input_size=len(SEQUENCE_FEATURES),
        hidden_size=128,
        num_layers=2,
        output_size=3,
        dropout=0.2,
    ).to(device)
    models_dir = _models_dir()
    if not country_sequences or not country_targets:
        print("  No training sequences; saving randomly initialized forecaster.pt")
        torch.save(model.state_dict(), models_dir / "forecaster.pt")
        return model
    dataset = RiskSequenceDataset(country_sequences, country_targets)
    loader = DataLoader(
        dataset,
        batch_size=min(batch_size, len(dataset)),
        shuffle=True,
        num_workers=0,
    )
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    criterion = nn.MSELoss()
    for epoch in range(epochs):
        model.train()
        total_loss = 0.0
        for batch_x, batch_y in loader:
            batch_x, batch_y = batch_x.to(device), batch_y.to(device)
            optimizer.zero_grad()
            out = model(batch_x)
            loss = criterion(out, batch_y)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            total_loss += loss.item()
        if (epoch + 1) % 10 == 0:
            print(f"  Epoch {epoch + 1}/{epochs} loss: {total_loss / len(loader):.4f}")
    torch.save(model.state_dict(), models_dir / "forecaster.pt")
    print(f"  Saved {models_dir / 'forecaster.pt'}")
    return model


def forecast_risk(recent_features: np.ndarray) -> dict:
    """
    Return 30/60/90 day risk forecasts and trend from last 90 days of 12 features.
    recent_features: (90, 12) array. Returns predictions even if model was trained on synthetic data.
    """
    models_dir = _models_dir()
    path = models_dir / "forecaster.pt"
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = RiskLSTM(
        input_size=len(SEQUENCE_FEATURES),
        hidden_size=128,
        num_layers=2,
        output_size=3,
        dropout=0.2,
    ).to(device)
    if path.exists():
        try:
            model.load_state_dict(
                torch.load(path, map_location=device, weights_only=True)
            )
        except Exception:
            model.load_state_dict(torch.load(path, map_location=device))
    model.eval()
    x = np.asarray(recent_features, dtype=np.float32)
    if x.shape != (90, 12):
        raise ValueError(f"recent_features must be (90, 12), got {x.shape}")
    with torch.no_grad():
        inp = torch.from_numpy(x).unsqueeze(0).to(device)
        preds = model(inp)[0].cpu().numpy()
    preds = np.clip(preds, 0.0, 100.0)
    trend = (
        "ESCALATING"
        if preds[2] > preds[0] + 10
        else "DE-ESCALATING"
        if preds[0] > preds[2] + 10
        else "STABLE"
    )
    return {
        "forecast_30d": round(float(preds[0]), 1),
        "forecast_60d": round(float(preds[1]), 1),
        "forecast_90d": round(float(preds[2]), 1),
        "trend": trend,
    }


if __name__ == "__main__":
    print("S2-04 LSTM Risk Forecaster — build sequences, train, save, test")
    print("Building training sequences from ACLED + GDELT (synthetic daily if needed)...")
    sequences, targets = build_training_sequences()
    print(f"  Total sequences: {len(sequences)}")
    if sequences:
        print(f"  Sequence shape: {sequences[0].shape}, target shape: {targets[0].shape}")
    print("Training forecaster (epochs=50)...")
    train_forecaster(sequences, targets, epochs=50)
    print("Testing forecast_risk(recent_features)...")
    if sequences:
        test_seq = sequences[-1]
    else:
        test_seq = np.zeros((90, 12), dtype=np.float32)
    result = forecast_risk(test_seq)
    print(f"  forecast_risk(90x12) = {result}")
    assert 0 <= result["forecast_30d"] <= 100
    assert 0 <= result["forecast_60d"] <= 100
    assert 0 <= result["forecast_90d"] <= 100
    assert result["trend"] in ("ESCALATING", "DE-ESCALATING", "STABLE")
    print("  OK: predictions in 0-100, trend in ESCALATING/DE-ESCALATING/STABLE.")
    print("Done.")
