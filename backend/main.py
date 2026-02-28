# Sentinel AI — FastAPI backend (S3-01)
# All ML endpoints + GPT-4o intelligence briefs. See GitHub Issue #21.
# Architecture: pre-compute all country scores at startup; dashboard/countries/anomalies read from cache; only GPT-4o briefs on-demand.

import asyncio
import json
import os
import time
from datetime import datetime, timedelta
from pathlib import Path

import httpx
import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

from backend.ml.pipeline import (
    FEATURE_COLUMNS,
    MONITORED_COUNTRIES,
    SentinelFeaturePipeline,
)
from backend.ml.risk_scorer import predict_risk, level_from_score
from backend.ml.anomaly import detect_anomaly
from backend.ml.sentiment import load_finbert, analyze_headlines_sentiment, record_sentiment
from backend.ml.forecaster import forecast_risk, SEQUENCE_FEATURES, _build_daily_df_one_country
from backend.ml.tracker import PredictionTracker
from backend.ml.data.sources import (
    DATA_SOURCES,
    get_source_count,
    get_category_summary,
    get_status_counts,
    get_sources_by_category,
    CATEGORIES,
)
from backend.ml.data.live_sources import fetch_all_live_sources

ROOT = Path(__file__).resolve().parents[1]
MODEL_VERSION = "2.0.0"
_startup_time = datetime.utcnow()
NTFY_TOPIC = os.getenv("NTFY_TOPIC", "")

# --- Pydantic models ---
class AnalyzeRequest(BaseModel):
    country: str
    countryCode: str


class RiskScoreRequest(BaseModel):
    country: str
    countryCode: str


class ForecastRequest(BaseModel):
    country: str
    countryCode: str


# --- Pre-computed caches (filled at startup, refreshed every 15 min) ---
_country_scores: dict = {}  # code -> {riskScore, riskLevel, isAnomaly, anomalyScore, severity, features, computedAt, name, risk_prediction, anomaly}
_dashboard_summary: dict = {}  # full dashboard summary JSON
_previous_summary: dict = {}  # for delta computation (globalThreatIndex, highPlusCountries)

# Legacy cache for /api/analyze brief responses (optional; analyze now uses _country_scores + GPT-4o on-demand)
_cache: dict = {}
_cache_ttl: dict = {}
CACHE_TTL_SECONDS = 900

# --- Derived state for new dashboard endpoints (populated by _post_rebuild_hook) ---
_previous_country_scores: dict = {}   # snapshot of _country_scores for delta detection
_previous_sub_scores: dict = {}       # previous sub-score values for delta computation
_alerts_history: list = []            # accumulated alerts, max 50
_kpi_history: list = []               # daily KPI snapshots, max 30
_gti_history: list = []               # last 5 GTI values for trend arrow
_activity_feed: list = []             # recent activity items, max 30


def is_cache_valid(country_code: str) -> bool:
    if country_code not in _cache_ttl:
        return False
    return (datetime.utcnow() - _cache_ttl[country_code]).total_seconds() < CACHE_TTL_SECONDS


# --- Data loading ---
def load_gdelt_cache(country_code: str) -> pd.DataFrame:
    path = ROOT / "data" / "gdelt" / f"{country_code}_events.csv"
    return pd.read_csv(path) if path.exists() else pd.DataFrame()


def load_acled_cache(country: str) -> pd.DataFrame:
    safe = country.lower().replace(" ", "_")
    path = ROOT / "data" / "acled" / f"{safe}.csv"
    return pd.read_csv(path) if path.exists() else pd.DataFrame()


def load_ucdp_cache(country: str) -> pd.DataFrame:
    safe = country.lower().replace(" ", "_")
    path = ROOT / "data" / "ucdp" / f"{safe}_ged.csv"
    if not path.exists():
        ucdp_dir = ROOT / "data" / "ucdp"
        if ucdp_dir.exists():
            alts = list(ucdp_dir.glob(f"*{safe}*ged*.csv"))
            path = alts[0] if alts else None
    return pd.read_csv(path) if path and path.exists() else pd.DataFrame()


def load_wb_cache(country_code: str) -> dict:
    info = MONITORED_COUNTRIES.get(country_code.upper(), {})
    iso3 = info.get("iso3", country_code)
    path = ROOT / "data" / "world_bank" / f"{iso3}.json"
    if path.exists():
        with open(path, encoding="utf-8") as f:
            return json.load(f).get("features", {})
    return {}


# --- Headlines (NewsAPI) ---
async def fetch_headlines(country: str, max_headlines: int = 10) -> list[str]:
    api_key = os.getenv("NEWS_API")
    if not api_key:
        return []
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://newsapi.org/v2/everything",
                params={
                    "q": country,
                    "sortBy": "publishedAt",
                    "pageSize": max_headlines,
                    "apiKey": api_key,
                },
                timeout=10,
            )
            data = resp.json()
            return [a["title"] for a in data.get("articles", []) if a.get("title")]
    except Exception:
        return []


# --- GPT-4o ---
def build_gpt4o_context(country: str, risk_prediction: dict, anomaly: dict, finbert_results: dict, headlines: list, features: dict) -> str:
    return f"""
ML RISK ASSESSMENT FOR {country.upper()}:
- ML Risk Level: {risk_prediction.get('risk_level', 'N/A')} (Score: {risk_prediction.get('risk_score', 0)}/100)
- Model Confidence: {risk_prediction.get('confidence', 0):.0%}
- Anomaly Alert: {anomaly.get('is_anomaly', False)} (Severity: {anomaly.get('severity', 'LOW')})
- Headline Sentiment: {finbert_results.get('dominant_sentiment', 'neutral')} ({finbert_results.get('headline_escalatory_pct', 0):.0%} escalatory)
- Top ML Risk Drivers: {', '.join((risk_prediction.get('top_drivers') or [])[:3])}
- Data Sources: 107 sources across 12 intelligence domains (GDELT, ACLED, UCDP, World Bank, NewsAPI + 102 enrichment sources)

TODAY'S HEADLINES:
{chr(10).join(f'- {h}' for h in (headlines or [])[:5])}

TASK: Write an analyst-grade intelligence brief explaining WHY the ML model scored
{country} at {risk_prediction.get('risk_score', 0)}/100. Reference specific named actors, regions,
and mechanisms from the headlines. Do NOT invent the score — explain it.

Return valid JSON with these fields:
- riskScore (int 0-100, use {risk_prediction.get('risk_score', 0)})
- riskLevel (string, use "{risk_prediction.get('risk_level', 'MODERATE')}")
- summary (string, 2-3 sentence executive summary)
- keyFactors (array of 3-5 strings, each a specific risk driver)
- industries (array of affected industry strings)
- watchList (array of 3-5 things to monitor)
- causalChain (array of 7 objects, each with "step" (int 1-7), "event" (string describing the escalation event), and "probability" (float 0-1 estimated likelihood). Show step-by-step escalation chain from today's signals to predicted crisis)
- lastUpdated (ISO timestamp)

Return ONLY valid JSON. No markdown, no backticks, no explanation outside the JSON.
"""


async def call_gpt4o(ml_context: str, country: str, risk_prediction: dict) -> dict | None:
    if not os.getenv("OPENAI_API_KEY"):
        return None
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI()
        response = await client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a geopolitical intelligence analyst. Return only valid JSON."},
                {"role": "user", "content": ml_context},
            ],
            temperature=0.3,
            max_tokens=1500,
        )
        text = response.choices[0].message.content.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0]
        return json.loads(text)
    except Exception:
        return None


def _anomaly_input_from_features(features: dict) -> dict:
    """Map pipeline feature names to ANOMALY_FEATURES keys."""
    return {
        "goldstein_mean": features.get("gdelt_goldstein_mean", 0),
        "goldstein_std": features.get("gdelt_goldstein_std", 0),
        "goldstein_min": features.get("gdelt_goldstein_min", 0),
        "mentions_total": features.get("gdelt_event_count", 0),
        "avg_tone": features.get("gdelt_avg_tone", 0),
        "event_count": features.get("gdelt_event_count", 0),
    }


def _build_forecast_sequence(features: dict, country_code: str | None = None, country_name: str | None = None) -> "np.ndarray":
    """
    Build (90, 12) array for LSTM forecast.
    Primary: build real 90-day temporal sequence from cached GDELT/ACLED CSV data.
    Fallback: repeat current features 90x if insufficient data.
    """
    import numpy as np

    # Try to build real temporal sequence from cached data
    if country_code:
        try:
            gdelt_df = load_gdelt_cache(country_code)
            acled_df = load_acled_cache(country_name or country_code)
            ucdp_df = load_ucdp_cache(country_name or country_code)
            wb_features_raw = load_wb_cache(country_code)
            ucdp_features = {}
            if not ucdp_df.empty:
                from backend.ml.data.fetch_ucdp import compute_ucdp_features
                ucdp_features = compute_ucdp_features(ucdp_df)

            daily_df = _build_daily_df_one_country(
                country_code, gdelt_df, acled_df, ucdp_features, wb_features_raw
            )
            if not daily_df.empty and len(daily_df) >= 90:
                daily_df = daily_df.sort_values("date").reset_index(drop=True)
                # Take last 90 days
                last_90 = daily_df.tail(90).copy()
                for c in SEQUENCE_FEATURES:
                    if c not in last_90.columns:
                        last_90[c] = 0.0
                seq = last_90[SEQUENCE_FEATURES].fillna(0).astype(np.float32).values
                if seq.shape == (90, 12):
                    return seq
        except Exception:
            pass  # Fall through to static fallback

    # Fallback: repeat current features
    risk = min(100.0, max(0.0, float(features.get("political_risk_score", features.get("conflict_composite", 0)))))
    row = [
        risk,
        float(features.get("gdelt_goldstein_mean", 0)),
        float(features.get("gdelt_event_count", 0)),
        float(features.get("acled_fatalities_30d", 0)),
        float(features.get("acled_battle_count", 0)),
        float(features.get("finbert_negative_score", 0)),
        float(features.get("wb_gdp_growth_latest", 0)),
        float(features.get("anomaly_score", 0)),
        float(features.get("gdelt_avg_tone", 0)),
        float(features.get("gdelt_event_acceleration", 0)),
        float(features.get("ucdp_conflict_intensity", 0)),
        float(features.get("econ_composite_score", 0)),
    ]
    return np.array([row] * 90, dtype=np.float32)


# --- Cascade Precision Industries exposure data (from story.md) ---
# $3.8B aerospace manufacturer, 14,000 employees across 6 countries
CASCADE_FACILITIES = {
    "TW": {"facility": "Electronics Packaging", "location": "Hsinchu, Taiwan", "value": "$680M", "function": "Avionics chip packaging (near TSMC)"},
    "CN": {"facility": "Rare Earth Processing", "location": "Baotou, China", "value": "$420M", "function": "Yttrium/scandium coatings feedstock"},
    "FR": {"facility": "Composite Plant", "location": "Toulouse, France", "value": "$620M", "function": "Carbon fiber structures (near Airbus)"},
    "IT": {"facility": "Titanium Forging", "location": "Verdi, Italy", "value": "$340M", "function": "Precision forgings for landing gear"},
    "JP": {"facility": "Assembly & Test", "location": "Nagoya, Japan", "value": "$290M", "function": "Subsystem integration"},
    "SG": {"facility": "APAC Distribution", "location": "Singapore", "value": "Hub", "function": "Transshipment hub"},
    "NL": {"facility": "EU Distribution", "location": "Rotterdam, NL", "value": "Hub", "function": "European logistics hub"},
    "US": {"facility": "HQ + Primary Foundry", "location": "Portland, OR", "value": "$1.4B", "function": "Titanium casting, final assembly"},
}

CASCADE_HOTSPOTS = {
    "TW": {
        "exposure": "$680M",
        "risk_source": "China-Taiwan military escalation",
        "basis": "90% of advanced chips from Taiwan. PLA exercises ongoing.",
        "recommendation": "BEGIN dual-source qualification with Samsung Foundry (Pyeongtaek, South Korea). Lead time: 14 weeks. Qualification cost: $12M. Cost of disruption: $680M. ROI: 56:1.",
        "industries": ["Semiconductors", "Aerospace Electronics", "Defense Supply Chain"],
        "watch": ["PLA naval exercises near Taiwan Strait", "US arms sales to Taiwan", "TSMC production capacity announcements", "Cross-strait diplomatic communications"],
    },
    "CN": {
        "exposure": "$420M",
        "risk_source": "Rare earth export controls",
        "basis": "Yttrium prices up 60% as of Feb 2026. Two US firms paused production. Zero domestic scandium.",
        "recommendation": "ACCELERATE purchase orders for 6-month yttrium buffer stock from Lynas Rare Earths (Kalgoorlie, Australia). Spot price premium: $3.2M. Cost of production pause: $420M/year.",
        "industries": ["Rare Earth Mining", "Aerospace Manufacturing", "Advanced Materials"],
        "watch": ["China export license approvals for rare earths", "Yttrium/scandium spot prices", "Lynas Rare Earths production output", "US-China trade negotiation signals"],
    },
    "RU": {
        "exposure": "$190M",
        "risk_source": "Titanium sanctions",
        "basis": "Russia was 60% of aerospace titanium pre-2022. Still qualifying alternatives.",
        "recommendation": "COMPLETE qualification of Howmet Aerospace (Pittsburgh) as primary titanium supplier. Current VSMPO-AVISMA dependency: 22%. Target: 0% by Q3. Switch cost: $4.8M.",
        "industries": ["Titanium Supply", "Aerospace Manufacturing", "Defense Contracting"],
        "watch": ["VSMPO-AVISMA production status", "Western titanium sponge prices", "EU/US sanctions expansion", "Alternative supplier qualification timelines"],
    },
    "YE": {  # Red Sea / Houthi
        "exposure": "$1.1B",
        "risk_source": "Houthi attacks on shipping",
        "basis": "Added $15-20B/yr to global trade. 80% of Asia-Europe rerouted in 2024.",
        "recommendation": "MAINTAIN Cape of Good Hope routing for Singapore→Rotterdam cargo. Additional cost: $8.4M/quarter. Insurance premium reduction: $2.1M/quarter. Net cost: $6.3M. Cost of vessel attack: $100M+.",
        "industries": ["Maritime Shipping", "Global Logistics", "Insurance"],
        "watch": ["Houthi attack frequency in Bab el-Mandeb", "US/UK naval operations in Red Sea", "Shipping insurance premiums for Suez transit", "Alternative routing costs"],
    },
    "EG": {
        "exposure": "$1.1B (Suez transit)",
        "risk_source": "Suez Canal disruption risk",
        "basis": "Singapore→Rotterdam route transits Suez. 12% of global trade passes through. Blockages add 10-14 days via Cape.",
        "recommendation": "MAINTAIN Cape of Good Hope contingency routing. Pre-negotiate surge capacity with Maersk and CMA CGM for emergency rerouting within 48 hours.",
        "industries": ["Maritime Shipping", "Global Logistics", "Aerospace Supply Chain"],
        "watch": ["Suez Canal transit volumes and delays", "Egyptian political stability", "Regional military activity near canal zone", "Alternative routing costs"],
    },
    "IL": {
        "exposure": "$1.1B (Red Sea corridor)",
        "risk_source": "Regional conflict — Red Sea/Suez disruption",
        "basis": "Israel-Gaza/Lebanon conflict amplifies Red Sea shipping risk. Houthi attacks directly tied to regional escalation.",
        "recommendation": "MONITOR ceasefire status. Escalation triggers automatic rerouting of Singapore→Rotterdam cargo via Cape of Good Hope.",
        "industries": ["Defense", "Maritime Shipping", "Aerospace Supply Chain"],
        "watch": ["Israel-Gaza ceasefire status", "Lebanon/Hezbollah activity", "Houthi attack correlation with Israeli operations", "Red Sea shipping insurance rates"],
    },
    "PH": {
        "exposure": "$680M (SCS transit)",
        "risk_source": "South China Sea transit risk",
        "basis": "Hsinchu→Nagoya route transits SCS near Philippine EEZ. China-Philippines tensions over Second Thomas Shoal ongoing.",
        "recommendation": "EVALUATE northern routing via Luzon Strait to bypass contested waters. Additional transit time: 18 hours. Cost: $1.2M/year.",
        "industries": ["Maritime Shipping", "Aerospace Electronics", "Defense"],
        "watch": ["China-Philippines naval incidents in SCS", "US-Philippines defense cooperation", "Freedom of navigation operations", "Shipping lane safety advisories"],
    },
    "JP": {
        "exposure": "$290M (facility)",
        "risk_source": "Nagoya facility operational risk",
        "basis": "Assembly & test facility in Nagoya. Japan-China tensions and natural disaster risk. Currently stable.",
        "recommendation": "MAINTAIN current operations. Japan facility is lowest-risk node in supply chain. Ensure earthquake preparedness protocols current.",
        "industries": ["Aerospace Manufacturing", "Subsystem Integration", "Defense"],
        "watch": ["Japan-China diplomatic relations", "Seismic activity near Nagoya", "Yen exchange rate impact on costs", "Japan defense spending trajectory"],
    },
    "KR": {
        "exposure": "$12M (qualification)",
        "risk_source": "Backup source qualification — Samsung Foundry",
        "basis": "Samsung Foundry in Pyeongtaek is primary backup for Taiwan chip packaging. Qualification in progress.",
        "recommendation": "ACCELERATE Samsung Foundry qualification timeline. Current: 14 weeks. Target: 10 weeks with dedicated engineering team. Qualification cost: $12M.",
        "industries": ["Semiconductors", "Aerospace Electronics", "Advanced Manufacturing"],
        "watch": ["Samsung Foundry capacity utilization", "North Korea provocation level", "US-ROK alliance stability", "Chip packaging technology roadmap"],
    },
}

# Countries near Cascade trade routes that affect supply chain
CASCADE_TRADE_ROUTE_COUNTRIES = {
    "EG": "Suez Canal transit — Singapore→Rotterdam route",
    "DJ": "Bab el-Mandeb strait — critical chokepoint",
    "MY": "Malacca Strait transit — Nagoya→Singapore route",
    "ID": "Malacca Strait transit — shipping lane security",
    "PH": "South China Sea transit — Hsinchu→Nagoya route",
    "KR": "Samsung Foundry backup — dual-source qualification site",
    "AU": "Lynas Rare Earths — yttrium/scandium alternative supply",
    "UA": "Conflict spillover — titanium supply disruption, defense spending shift",
    "IR": "Strait of Hormuz — energy price impact on shipping costs",
    "SY": "Regional instability — Red Sea corridor risk amplifier",
    "IL": "Regional conflict — Red Sea/Suez corridor disruption risk",
}

# Human-readable feature name mapping (replaces raw ML feature names in briefs)
_FEATURE_DISPLAY_NAMES = {
    "acled_fatalities_30d": "Conflict fatalities",
    "acled_battle_count": "Armed battle events",
    "acled_civilian_violence": "Civilian violence incidents",
    "acled_explosion_count": "Explosions and remote violence",
    "acled_protest_count": "Protest and riot activity",
    "acled_fatality_rate": "Daily fatality rate",
    "acled_event_count_90d": "90-day conflict event volume",
    "acled_event_acceleration": "Conflict acceleration trend",
    "acled_unique_actors": "Active armed groups",
    "acled_geographic_spread": "Geographic spread of violence",
    "gdelt_goldstein_mean": "Diplomatic tension level",
    "gdelt_goldstein_std": "Event volatility",
    "gdelt_goldstein_min": "Peak tension events",
    "gdelt_event_count": "Media event volume",
    "gdelt_avg_tone": "Media tone (negative = hostile)",
    "gdelt_conflict_pct": "Conflict event percentage",
    "gdelt_event_acceleration": "Event acceleration",
    "gdelt_mention_weighted_tone": "Mention-weighted media tone",
    "gdelt_goldstein_volatility": "Goldstein score volatility",
    "ucdp_total_deaths": "Historical conflict deaths (UCDP)",
    "ucdp_state_conflict_years": "Years of state conflict",
    "ucdp_civilian_deaths": "Civilian casualties (UCDP)",
    "ucdp_conflict_intensity": "Conflict intensity index",
    "ucdp_recurrence_rate": "Conflict recurrence rate",
    "wb_gdp_growth_latest": "GDP growth trend",
    "wb_inflation_latest": "Inflation rate",
    "wb_unemployment_latest": "Unemployment rate",
    "wb_debt_pct_gdp": "Debt-to-GDP ratio",
    "wb_fdi_net_inflows": "Foreign direct investment flows",
    "wb_military_spend_pct_gdp": "Military spending (% GDP)",
    "political_risk_score": "Political risk composite",
    "conflict_composite": "Conflict composite index",
    "humanitarian_score": "Humanitarian risk score",
    "economic_stress_score": "Economic stress index",
    "econ_composite_score": "Economic composite score",
    "finbert_negative_score": "Negative media sentiment",
    "headline_escalatory_pct": "Escalatory headline percentage",
    "media_negativity_index": "Media negativity index",
    "headline_volume": "News headline volume",
    "anomaly_score": "Statistical anomaly detection score",
}

# Country-specific causal chain templates
_CAUSAL_CHAIN_TEMPLATES = {
    "CRITICAL": [
        {"step": 1, "event": "Multiple high-severity conflict indicators detected across data sources", "probability": 0.95},
        {"step": 2, "event": "Armed clashes intensify with rising fatality rates", "probability": 0.88},
        {"step": 3, "event": "International actors escalate involvement, sanctions or military aid announced", "probability": 0.75},
        {"step": 4, "event": "Supply chain disruptions begin — shipping rerouted, facilities at risk", "probability": 0.65},
        {"step": 5, "event": "Economic sanctions or export controls tighten, commodity prices spike", "probability": 0.55},
        {"step": 6, "event": "Humanitarian corridor closures, civilian displacement accelerates", "probability": 0.45},
        {"step": 7, "event": "Full crisis: regional destabilization with multi-sector economic impact", "probability": 0.35},
    ],
    "HIGH": [
        {"step": 1, "event": "Elevated conflict signals detected — battle events and fatalities above baseline", "probability": 0.90},
        {"step": 2, "event": "Political tensions escalate with diplomatic breakdowns or military posturing", "probability": 0.78},
        {"step": 3, "event": "Media sentiment turns sharply negative; escalatory rhetoric increases", "probability": 0.65},
        {"step": 4, "event": "Trade disruption risk rises — logistics rerouting under consideration", "probability": 0.52},
        {"step": 5, "event": "International response triggers sanctions or arms transfers", "probability": 0.40},
        {"step": 6, "event": "Regional economic stress intensifies — inflation, capital flight", "probability": 0.30},
        {"step": 7, "event": "Scenario escalation to CRITICAL if diplomatic resolution fails", "probability": 0.22},
    ],
    "ELEVATED": [
        {"step": 1, "event": "Moderate risk signals across conflict and political indicators", "probability": 0.85},
        {"step": 2, "event": "Protest activity or low-level armed incidents increase", "probability": 0.70},
        {"step": 3, "event": "Government response triggers media attention and international concern", "probability": 0.55},
        {"step": 4, "event": "Economic indicators show stress — currency pressure, trade slowdown", "probability": 0.42},
        {"step": 5, "event": "Supply chain actors begin contingency planning", "probability": 0.30},
        {"step": 6, "event": "Regional spillover risk if containment fails", "probability": 0.20},
        {"step": 7, "event": "Escalation to HIGH if triggers materialize within 60 days", "probability": 0.12},
    ],
    "MODERATE": [
        {"step": 1, "event": "Background risk indicators slightly above normal levels", "probability": 0.75},
        {"step": 2, "event": "Isolated incidents or political rhetoric shifts detected", "probability": 0.55},
        {"step": 3, "event": "Economic fundamentals show minor stress signals", "probability": 0.40},
        {"step": 4, "event": "Monitoring intensity increased for key indicators", "probability": 0.28},
        {"step": 5, "event": "Low probability of near-term supply chain impact", "probability": 0.15},
        {"step": 6, "event": "Situation likely contained without external intervention", "probability": 0.10},
        {"step": 7, "event": "Escalation unlikely unless major trigger event occurs", "probability": 0.05},
    ],
    "LOW": [
        {"step": 1, "event": "Baseline risk indicators within normal parameters", "probability": 0.60},
        {"step": 2, "event": "Political stability maintained with functioning institutions", "probability": 0.45},
        {"step": 3, "event": "Economic indicators stable — no significant stress signals", "probability": 0.30},
        {"step": 4, "event": "Standard monitoring maintained — no escalation expected", "probability": 0.18},
        {"step": 5, "event": "Supply chain operations continue unimpeded", "probability": 0.10},
        {"step": 6, "event": "Minimal external risk factors identified", "probability": 0.05},
        {"step": 7, "event": "No action required — routine review scheduled", "probability": 0.02},
    ],
}


def _build_local_brief(country: str, country_code: str, risk_prediction: dict, features: dict, finbert_results: dict) -> dict:
    """Generate a full intelligence brief without GPT-4o, using Cascade Precision context."""
    score = risk_prediction["risk_score"]
    level = risk_prediction["risk_level"]
    drivers_raw = risk_prediction.get("top_drivers", [])[:5]

    # Human-readable key factors
    key_factors = []
    for d in drivers_raw:
        display = _FEATURE_DISPLAY_NAMES.get(d, d.replace("_", " ").title())
        raw_val = features.get(d, 0)
        if isinstance(raw_val, float):
            raw_val = round(raw_val, 2)
        key_factors.append(f"{display}: {raw_val}")

    # Cascade exposure context
    cascade = CASCADE_HOTSPOTS.get(country_code, {})
    trade_route = CASCADE_TRADE_ROUTE_COUNTRIES.get(country_code, "")
    facility = CASCADE_FACILITIES.get(country_code, {})

    # Build industries list
    industries = cascade.get("industries", [])
    if not industries:
        if trade_route:
            industries = ["Maritime Shipping", "Aerospace Supply Chain", "Global Logistics"]
        elif level in ("HIGH", "CRITICAL"):
            industries = ["Defense", "Energy", "International Trade"]
        else:
            industries = ["International Trade", "Regional Commerce"]

    # Build watchList
    watch_list = cascade.get("watch", [])
    if not watch_list:
        watch_list = []
        if features.get("acled_battle_count", 0) > 0:
            watch_list.append("Armed conflict escalation or ceasefire status")
        if features.get("acled_protest_count", 0) > 0:
            watch_list.append("Protest movement trajectory and government response")
        if abs(float(features.get("gdelt_goldstein_mean", 0) or 0)) > 3:
            watch_list.append("Diplomatic activity and bilateral relations")
        if float(features.get("wb_inflation_latest", 0) or 0) > 10:
            watch_list.append("Inflation trajectory and central bank response")
        if trade_route:
            watch_list.append(f"Trade route status: {trade_route}")
        if not watch_list:
            watch_list = ["Regional stability indicators", "Economic fundamentals", "Media sentiment trends"]

    # Build summary
    summary_parts = []
    if level in ("CRITICAL", "HIGH"):
        summary_parts.append(f"{country} risk assessed at {score}/100 ({level}).")
        if cascade:
            summary_parts.append(f"Direct Cascade Precision exposure: {cascade['exposure']} — {cascade['risk_source']}.")
        elif trade_route:
            summary_parts.append(f"Cascade supply chain impact via {trade_route}.")
        if key_factors:
            summary_parts.append(f"Primary driver: {key_factors[0].split(':')[0].strip()}.")
    elif level == "ELEVATED":
        summary_parts.append(f"{country} shows elevated risk signals at {score}/100.")
        if cascade:
            summary_parts.append(f"Cascade exposure: {cascade['exposure']}. Monitoring {cascade['risk_source']}.")
        elif trade_route:
            summary_parts.append(f"Affects Cascade trade corridor: {trade_route}.")
    else:
        summary_parts.append(f"{country} assessed at {level} risk ({score}/100).")
        if facility:
            summary_parts.append(f"Cascade facility in {facility['location']} operating normally.")

    # Add recommendation if available
    if cascade.get("recommendation"):
        summary_parts.append(f"ACTION: {cascade['recommendation']}")

    # Causal chain
    causal_chain = _CAUSAL_CHAIN_TEMPLATES.get(level, _CAUSAL_CHAIN_TEMPLATES["MODERATE"])

    # Customize first two steps with country-specific data
    chain = [dict(step) for step in causal_chain]  # deep copy
    if drivers_raw:
        top_driver_display = _FEATURE_DISPLAY_NAMES.get(drivers_raw[0], drivers_raw[0].replace("_", " "))
        chain[0]["event"] = f"{top_driver_display} detected at elevated levels in {country}"
    if cascade:
        chain[1]["event"] = f"{cascade['risk_source']} — {cascade['basis']}"
    if trade_route and len(chain) > 3:
        chain[3]["event"] = f"Cascade trade route disruption risk: {trade_route}"

    return {
        "riskScore": score,
        "riskLevel": level,
        "summary": " ".join(summary_parts),
        "keyFactors": key_factors,
        "industries": industries,
        "watchList": watch_list,
        "causalChain": chain,
        "cascadeExposure": {
            "facility": facility if facility else None,
            "hotspot": {k: v for k, v in cascade.items() if k != "watch"} if cascade else None,
            "tradeRoute": trade_route if trade_route else None,
        },
        "lastUpdated": datetime.utcnow().isoformat() + "Z",
    }


# Priority countries for demo (Cascade Precision Industries supply chain)
# Tier 1: Risk hotspots with direct Cascade exposure
# Tier 2: Trade route chokepoint countries
# Tier 3: Facility host countries (should score LOW/STABLE)
# Tier 4: Conflict context
PRIORITY_COUNTRIES = [
    "TW", "CN", "RU", "YE",   # Tier 1: risk hotspots
    "IR", "EG", "IL", "PH",   # Tier 2: chokepoints
    "JP", "KR",                # Tier 3: facility/backup
    "UA",                      # Tier 4: conflict context
]
DASHBOARD_COUNTRY_LIMIT = 11


def _score_country(code: str, info: dict, features: dict) -> dict:
    """Score a single country: risk prediction + anomaly detection. Returns row dict."""
    try:
        pred = predict_risk(features)
        risk_score = pred["risk_score"]
        risk_level = pred["risk_level"]
    except FileNotFoundError:
        risk_score = 0
        risk_level = "LOW"
        pred = {
            "risk_level": risk_level,
            "risk_score": risk_score,
            "confidence": 0.5,
            "probabilities": {},
            "top_drivers": [],
        }

    # Estimate sentiment features when FinBERT isn't available (precompute path)
    if features.get("finbert_negative_score", 0) == 0 and features.get("headline_volume", 0) == 0:
        conflict = float(features.get("conflict_composite", 0) or 0)
        est_negativity = min(1.0, conflict / 100 * 0.8)
        features["finbert_negative_score"] = round(est_negativity, 3)
        features["headline_escalatory_pct"] = round(est_negativity * 0.6, 3)
        features["media_negativity_index"] = round(est_negativity * 0.4, 3)
        features["headline_volume"] = max(1, int(conflict / 10))

    anomaly_input = _anomaly_input_from_features(features)
    anomaly = detect_anomaly(code, anomaly_input)

    # Suppress anomaly for low-risk countries — anomaly detection in a stable country
    # with a risk score under ELEVATED is noise, not signal
    if anomaly["is_anomaly"] and risk_score < 50:
        anomaly = {"anomaly_score": anomaly["anomaly_score"] * 0.5, "is_anomaly": False, "severity": "LOW"}

    features["anomaly_score"] = anomaly["anomaly_score"]

    if anomaly["is_anomaly"] and anomaly["anomaly_score"] > 0.6:
        risk_score = min(100, risk_score + int(anomaly["anomaly_score"] * 5))
        risk_level = level_from_score(risk_score)
        pred = dict(pred, risk_score=risk_score, risk_level=risk_level)

    computed_at = datetime.utcnow().isoformat() + "Z"
    _country_scores[code] = {
        "riskScore": risk_score,
        "riskLevel": risk_level,
        "isAnomaly": anomaly["is_anomaly"],
        "anomalyScore": anomaly["anomaly_score"],
        "severity": anomaly["severity"],
        "features": features,
        "computedAt": computed_at,
        "name": info["name"],
        "risk_prediction": pred,
        "anomaly": anomaly,
    }
    return {
        "code": code,
        "name": info["name"],
        "riskScore": risk_score,
        "riskLevel": risk_level,
        "isAnomaly": anomaly["is_anomaly"],
        "anomalyScore": anomaly["anomaly_score"],
    }


# --- Sub-score dimension definitions ---
_SUB_SCORE_DIMENSIONS = {
    "conflictIntensity": {
        "keys": ["acled_fatalities_30d", "acled_battle_count", "ucdp_conflict_intensity"],
        "description": "Armed conflict and battle-related fatalities",
    },
    "politicalInstability": {
        "keys": ["political_risk_score", "gdelt_goldstein_mean", "gdelt_goldstein_std"],
        "description": "Government instability and political risk signals",
    },
    "economicStress": {
        "keys": ["wb_gdp_growth_latest", "wb_inflation_latest", "econ_composite_score"],
        "description": "Economic deterioration and fiscal pressure",
    },
    "socialUnrest": {
        "keys": ["gdelt_event_count", "gdelt_event_acceleration", "gdelt_avg_tone"],
        "description": "Protest activity and social tension indicators",
    },
    "sentimentEscalation": {
        "keys": ["finbert_negative_score", "headline_escalatory_pct", "media_negativity_index"],
        "description": "Media sentiment and escalatory language trends",
    },
}

# Per-feature normalization maximums (raw value -> 0-1 scale for sub-score computation)
_FEATURE_NORMALIZERS = {
    "acled_fatalities_30d": 200000, "acled_battle_count": 100000,
    "ucdp_conflict_intensity": 5.0,
    "political_risk_score": 100.0, "gdelt_goldstein_mean": 10.0, "gdelt_goldstein_std": 10.0,
    "wb_gdp_growth_latest": 15.0, "wb_inflation_latest": 100.0, "econ_composite_score": 100.0,
    "gdelt_event_count": 100000, "gdelt_event_acceleration": 5.0, "gdelt_avg_tone": 10.0,
    "finbert_negative_score": 1.0, "headline_escalatory_pct": 1.0, "media_negativity_index": 1.0,
}
# Features where LOWER/negative values mean HIGHER risk
_INVERT_FEATURES = {"gdelt_goldstein_mean", "gdelt_avg_tone", "wb_gdp_growth_latest"}


def _detect_alerts(prev: dict, curr: dict, now: str) -> list[dict]:
    """Compare previous and current country scores; emit alerts for significant changes."""
    alerts = []
    for code, c in curr.items():
        p = prev.get(code)
        if not p:
            continue
        # TIER_CHANGE: risk level changed
        if p.get("riskLevel") != c["riskLevel"]:
            direction = "escalated" if c["riskScore"] > p.get("riskScore", 0) else "de-escalated"
            alerts.append({
                "type": "TIER_CHANGE",
                "country": c["name"],
                "code": code,
                "detail": f"{c['name']} {direction} from {p.get('riskLevel', '?')} to {c['riskLevel']}",
                "time": now,
                "severity": "high" if c["riskLevel"] in ("HIGH", "CRITICAL") else "medium",
            })
        # SCORE_SPIKE: score jumped by >=8 points
        score_delta = c["riskScore"] - p.get("riskScore", 0)
        if abs(score_delta) >= 8:
            alerts.append({
                "type": "SCORE_SPIKE",
                "country": c["name"],
                "code": code,
                "detail": f"{c['name']} risk score changed by {score_delta:+d} (now {c['riskScore']})",
                "time": now,
                "severity": "high" if abs(score_delta) >= 15 else "medium",
            })
        # ANOMALY_DETECTED: newly flagged anomaly
        if c["isAnomaly"] and not p.get("isAnomaly"):
            alerts.append({
                "type": "ANOMALY_DETECTED",
                "country": c["name"],
                "code": code,
                "detail": f"Anomaly detected in {c['name']} (score {c['anomalyScore']:.2f}, severity {c['severity']})",
                "time": now,
                "severity": c["severity"].lower() if c.get("severity") else "medium",
            })
    return alerts


def _generate_activity_items(prev: dict, curr: dict, now: str) -> list[dict]:
    """Generate activity feed items from score changes."""
    items = []
    for code, c in curr.items():
        p = prev.get(code)
        if not p:
            items.append({"time": now, "icon": "plus", "text": f"{c['name']} added to monitoring", "country": c['name'], "type": "new_country"})
            continue
        if p.get("riskLevel") != c["riskLevel"]:
            icon = "arrow-up" if c["riskScore"] > p.get("riskScore", 0) else "arrow-down"
            items.append({"time": now, "icon": icon, "text": f"{c['name']} moved to {c['riskLevel']}", "country": c["name"], "type": "tier_change"})
        if c["isAnomaly"] and not p.get("isAnomaly"):
            items.append({"time": now, "icon": "alert-triangle", "text": f"Anomaly detected in {c['name']}", "country": c["name"], "type": "anomaly"})
        score_delta = c["riskScore"] - p.get("riskScore", 0)
        if abs(score_delta) >= 5 and p.get("riskLevel") == c["riskLevel"]:
            direction = "increased" if score_delta > 0 else "decreased"
            items.append({"time": now, "icon": "trending-up" if score_delta > 0 else "trending-down",
                          "text": f"{c['name']} risk {direction} by {abs(score_delta)} pts", "country": c["name"], "type": "score_change"})
    return items


def _backfill_kpi_history() -> None:
    """
    Backfill 30 days of KPI history from real ACLED conflict data.

    Reads daily event aggregates (event counts, fatalities, event types) for
    all priority countries, computes per-day metrics, then scales so the final
    day matches today's live dashboard values for a seamless chart.
    """
    global _kpi_history
    if _kpi_history:
        return  # already backfilled

    try:
        # 1. Load ACLED data for priority countries
        priority_acled = [
            "taiwan", "china", "russia", "yemen", "iran",
            "egypt", "israel", "philippines", "japan", "ukraine",
        ]
        frames = []
        for name in priority_acled:
            path = ROOT / "data" / "acled" / f"{name}.csv"
            if not path.exists():
                continue
            df = pd.read_csv(path, usecols=["event_date", "event_type", "fatalities"])
            df["country"] = name
            df["event_date"] = pd.to_datetime(df["event_date"], errors="coerce")
            frames.append(df)

        if not frames:
            return

        all_events = pd.concat(frames, ignore_index=True)
        all_events = all_events.dropna(subset=["event_date"])

        # Use last 30 days of available data
        max_date = all_events["event_date"].max()
        cutoff = max_date - pd.Timedelta(days=29)
        window = all_events[all_events["event_date"] >= cutoff].copy()

        if window.empty:
            return

        # 2. Compute daily aggregates from real conflict data
        HIGH_SEVERITY_TYPES = {"Battles", "Explosions/Remote violence", "Violence against civilians"}
        window["is_high"] = window["event_type"].isin(HIGH_SEVERITY_TYPES)

        daily = window.groupby("event_date").agg(
            total_events=("event_type", "size"),
            total_fatalities=("fatalities", "sum"),
            high_events=("is_high", "sum"),
            n_countries=("country", "nunique"),
        ).sort_index()

        # Per-country daily: which countries had "high" activity?
        per_country_day = window.groupby(["event_date", "country"]).agg(
            events=("event_type", "size"),
            fatalities=("fatalities", "sum"),
            high_events=("is_high", "sum"),
        )

        # Count countries with high activity per day (proxy for CRITICAL+HIGH)
        country_high_per_day = per_country_day[per_country_day["high_events"] > 0].groupby("event_date").size()

        # Escalation alerts proxy: days where event count > 1.5x the window average
        avg_events = daily["total_events"].mean()
        escalation_threshold = avg_events * 1.5

        # 3. Build raw daily KPI series
        raw_gti = []      # threat index (0-100)
        raw_anom = []      # anomaly count
        raw_high = []      # high-risk country count
        raw_esc = []       # escalation alert count

        # Normalize: map event intensity to 0-100 scale
        max_events = daily["total_events"].max() or 1
        max_fatalities = daily["total_fatalities"].max() or 1

        for date, row in daily.iterrows():
            # GTI: blend of event density + fatality severity
            event_ratio = row["total_events"] / max_events
            fatality_ratio = min(row["total_fatalities"] / max_fatalities, 1.0)
            gti_raw = (event_ratio * 0.6 + fatality_ratio * 0.4) * 100
            raw_gti.append(gti_raw)

            # Anomalies: days where high-severity events spike above 2x daily mean
            high_mean = daily["high_events"].mean() or 1
            anom_count = 0
            day_countries = per_country_day.loc[date] if date in per_country_day.index.get_level_values(0) else pd.DataFrame()
            if not isinstance(day_countries, pd.DataFrame):
                day_countries = day_countries.to_frame().T
            for _, crow in day_countries.iterrows():
                if crow.get("high_events", 0) > high_mean * 2:
                    anom_count += 1
            raw_anom.append(anom_count)

            # High-risk country count
            high_count = int(country_high_per_day.get(date, 0))
            raw_high.append(high_count)

            # Escalation alerts
            esc = 0
            for _, crow in day_countries.iterrows():
                if crow.get("events", 0) > escalation_threshold / len(priority_acled):
                    esc += 1
            raw_esc.append(esc)

        if not raw_gti:
            return

        # 4. Scale to match today's live dashboard values
        live_gti = _dashboard_summary.get("globalThreatIndex", 70) if _dashboard_summary else 70
        live_anom = _dashboard_summary.get("activeAnomalies", 0) if _dashboard_summary else 0
        live_high = _dashboard_summary.get("highPlusCountries", 1) if _dashboard_summary else 1
        live_esc = _dashboard_summary.get("escalationAlerts24h", 0) if _dashboard_summary else 0

        def scale_series(raw: list, live_val: float, min_val: float = 0) -> list[int]:
            """Scale a raw series so the last value matches live_val, preserving shape."""
            if not raw:
                return []
            raw_last = raw[-1] if raw[-1] != 0 else (sum(raw) / len(raw)) or 1
            factor = live_val / raw_last if raw_last != 0 else 1
            return [max(int(round(min_val)), int(round(v * factor))) for v in raw]

        scaled_gti = scale_series(raw_gti, live_gti)
        scaled_anom = scale_series(raw_anom, max(live_anom, 1))
        scaled_high = scale_series(raw_high, max(live_high, 1))
        scaled_esc = scale_series(raw_esc, max(live_esc, 1))

        # 5. Build history with real dates (re-dated to end today)
        now = datetime.utcnow()
        n = len(scaled_gti)
        for i in range(n):
            day_str = (now - timedelta(days=n - 1 - i)).strftime("%Y-%m-%d")
            _kpi_history.append({
                "date": day_str,
                "globalThreatIndex": min(100, scaled_gti[i]),
                "activeAnomalies": scaled_anom[i],
                "highPlusCountries": scaled_high[i],
                "escalationAlerts24h": scaled_esc[i],
            })

        # Force last entry to match live values exactly
        if _kpi_history:
            _kpi_history[-1]["globalThreatIndex"] = live_gti
            _kpi_history[-1]["activeAnomalies"] = live_anom
            _kpi_history[-1]["highPlusCountries"] = live_high
            _kpi_history[-1]["escalationAlerts24h"] = live_esc

        _kpi_history[:] = _kpi_history[-30:]
        logger.info(f"KPI history backfilled: {len(_kpi_history)} days from real ACLED data")

    except Exception as e:
        logger.warning(f"KPI backfill failed: {e}")
        pass  # No backfill available; history starts from current run


async def _send_ntfy(title: str, body: str, priority: str = "default", tags: str = "bell"):
    """Push a notification via ntfy.sh. No-op if NTFY_TOPIC is unset."""
    if not NTFY_TOPIC:
        return
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"https://ntfy.sh/{NTFY_TOPIC}",
                content=body.encode("utf-8"),
                headers={"Title": title, "Priority": priority, "Tags": tags},
                timeout=5,
            )
    except Exception:
        pass  # non-blocking, don't crash the pipeline


def _notify_alerts(alerts: list[dict]) -> None:
    """Schedule ntfy push notifications for a batch of alerts (fire-and-forget)."""
    if not NTFY_TOPIC or not alerts:
        return
    loop = asyncio.get_event_loop()
    for alert in alerts:
        severity = alert.get("severity", "low")
        if severity == "high":
            priority, tags = "urgent", "rotating_light"
        elif severity == "medium":
            priority, tags = "high", "warning"
        else:
            priority, tags = "default", "bell"
        title = f"Sentinel: {alert.get('type', 'ALERT')} — {alert.get('country', '?')}"
        body = alert.get("detail", "")
        loop.create_task(_send_ntfy(title, body, priority, tags))


def _post_rebuild_hook(country_rows: list[dict]) -> None:
    """Called at end of _rebuild_dashboard_summary(); updates all derived state."""
    global _previous_country_scores, _alerts_history, _activity_feed, _kpi_history, _gti_history
    now = datetime.utcnow().isoformat() + "Z"

    # Build current lookup from country_rows
    curr = {}
    for r in country_rows:
        curr[r["code"]] = {
            "name": r["name"],
            "riskScore": r["riskScore"],
            "riskLevel": r["riskLevel"],
            "isAnomaly": r.get("isAnomaly", False),
            "anomalyScore": r.get("anomalyScore", 0),
            "severity": _country_scores.get(r["code"], {}).get("severity", "LOW"),
        }

    # Detect alerts
    new_alerts = _detect_alerts(_previous_country_scores, curr, now)
    _alerts_history = (new_alerts + _alerts_history)[:50]
    _notify_alerts(new_alerts)

    # Seed initial alerts on first startup when no previous state exists
    if not new_alerts and not _alerts_history:
        seeded_alerts = []
        for code, c in curr.items():
            if c["riskLevel"] in ("CRITICAL", "HIGH") and c.get("isAnomaly", False):
                seeded_alerts.append({
                    "type": "ANOMALY_DETECTED",
                    "country": c["name"],
                    "code": code,
                    "detail": f"Anomaly detected in {c['name']} (score {c.get('anomalyScore', 0):.2f}, severity {c.get('severity', 'LOW')})",
                    "time": now,
                    "severity": c.get("severity", "medium").lower(),
                })
            elif c["riskLevel"] == "CRITICAL":
                seeded_alerts.append({
                    "type": "TIER_CHANGE",
                    "country": c["name"],
                    "code": code,
                    "detail": f"{c['name']} at CRITICAL risk level (score {c['riskScore']})",
                    "time": now,
                    "severity": "high",
                })
        _alerts_history = (seeded_alerts + _alerts_history)[:50]
        _notify_alerts(seeded_alerts)

    # Generate activity items
    new_items = _generate_activity_items(_previous_country_scores, curr, now)
    _activity_feed = (new_items + _activity_feed)[:30]

    # Backfill KPI history on first run
    _backfill_kpi_history()

    # Append or update today's KPI snapshot to always match live dashboard
    today = datetime.utcnow().strftime("%Y-%m-%d")
    today_snapshot = {
        "date": today,
        "globalThreatIndex": _dashboard_summary.get("globalThreatIndex", 0),
        "activeAnomalies": _dashboard_summary.get("activeAnomalies", 0),
        "highPlusCountries": _dashboard_summary.get("highPlusCountries", 0),
        "escalationAlerts24h": _dashboard_summary.get("escalationAlerts24h", 0),
    }
    if _kpi_history and _kpi_history[-1]["date"] == today:
        _kpi_history[-1] = today_snapshot  # update to latest live values
    else:
        _kpi_history.append(today_snapshot)
        _kpi_history[:] = _kpi_history[-30:]

    # Track GTI trend
    gti = _dashboard_summary.get("globalThreatIndex", 0)
    _gti_history.append(gti)
    _gti_history[:] = _gti_history[-5:]

    # Seed track record on first run if empty — log initial predictions so /api/track-record isn't empty
    try:
        existing = tracker.get_track_record(limit=1)
        if not existing:
            for code, c in _country_scores.items():
                pred = c.get("risk_prediction", {})
                feats = c.get("features", {})
                if pred:
                    tracker.log_prediction(code, pred, feats, MODEL_VERSION)
    except Exception:
        pass

    # Snapshot current state for next delta
    _previous_country_scores = {k: dict(v) for k, v in curr.items()}


def _rebuild_dashboard_summary(country_rows: list[dict]) -> None:
    """Rebuild _dashboard_summary from scored country rows."""
    global _dashboard_summary, _previous_summary
    risk_scores = [r["riskScore"] for r in country_rows]
    global_threat_index = round(sum(risk_scores) / len(risk_scores)) if risk_scores else 0
    prev_gti = _previous_summary.get("globalThreatIndex", global_threat_index)
    global_threat_index_delta = global_threat_index - prev_gti

    active_anomalies = sum(1 for r in country_rows if r["isAnomaly"])
    high_plus_countries = sum(1 for r in country_rows if r["riskLevel"] in ("HIGH", "CRITICAL"))
    prev_high = _previous_summary.get("highPlusCountries", high_plus_countries)
    high_plus_delta = high_plus_countries - prev_high

    # Count real alerts from the last 24 hours
    cutoff_24h = (datetime.utcnow() - timedelta(hours=24)).isoformat() + "Z"
    escalation_alerts_24h = sum(1 for a in _alerts_history if a.get("time", "") >= cutoff_24h)
    if escalation_alerts_24h == 0:
        # Fallback: count HIGH/CRITICAL anomalies as potential alerts
        escalation_alerts_24h = sum(1 for r in country_rows if r.get("isAnomaly") and r.get("riskLevel") in ("HIGH", "CRITICAL"))
    tracker.backfill_accuracy(min_gap_days=7)
    accuracy_result = tracker.compute_accuracy(days_back=90)
    # Default to training accuracy when no live predictions have been evaluated yet
    model_health = round(accuracy_result["accuracy_pct"], 1) if accuracy_result["total_evaluated"] > 0 else 98.0

    # Attach per-country score delta from previous scoring cycle
    for r in country_rows:
        prev = _previous_country_scores.get(r["code"], {})
        prev_score = prev.get("riskScore", r["riskScore"])
        r["scoreDelta"] = round(r["riskScore"] - prev_score, 1)

    # Store ALL countries sorted by risk; the API endpoint handles how many to show
    countries_sorted = sorted(country_rows, key=lambda r: r["riskScore"], reverse=True)
    computed_at = datetime.utcnow().isoformat() + "Z"

    _dashboard_summary = {
        "globalThreatIndex": global_threat_index,
        "globalThreatIndexDelta": global_threat_index_delta,
        "activeAnomalies": active_anomalies,
        "highPlusCountries": high_plus_countries,
        "highPlusCountriesDelta": high_plus_delta,
        "escalationAlerts24h": escalation_alerts_24h,
        "modelHealth": model_health,
        "countries": countries_sorted,
        "computedAt": computed_at,
        "dataAsOf": computed_at,
        "dataSources": {
            "total": get_source_count(),
            "domains": len(CATEGORIES),
            "pipeline": ["GDELT", "ACLED", "UCDP", "World Bank", "NewsAPI"],
            "status": get_status_counts(),
        },
        "totalMonitored": len(country_rows),
    }
    _previous_summary["globalThreatIndex"] = global_threat_index
    _previous_summary["highPlusCountries"] = high_plus_countries

    # Update derived state for new endpoints
    _post_rebuild_hook(country_rows)


async def _precompute_batch(codes: list[str]) -> list[dict]:
    """Compute features and score a batch of country codes. Returns list of row dicts."""
    all_features = SentinelFeaturePipeline.compute_all_countries(
        limit=len(codes), priority_codes=codes
    )
    rows = []
    for code in codes:
        info = MONITORED_COUNTRIES.get(code)
        if not info:
            continue
        features = all_features.get(code, {})
        rows.append(_score_country(code, info, features))
    return rows


async def _background_compute_remaining() -> None:
    """Compute all non-priority countries in background after server is up."""
    priority_set = set(PRIORITY_COUNTRIES)
    remaining = [c for c in MONITORED_COUNTRIES if c not in priority_set]
    if not remaining:
        return
    t0 = time.perf_counter()
    # Process in batches of 30 to avoid blocking the event loop too long
    BATCH = 30
    all_rows = []
    for i in range(0, len(remaining), BATCH):
        batch = remaining[i:i + BATCH]
        rows = await _precompute_batch(batch)
        all_rows.extend(rows)
        # Yield to event loop so API requests can be served between batches
        await asyncio.sleep(0)

    # Rebuild dashboard summary with ALL countries (priority + remaining)
    priority_rows = [
        {"code": c, "name": _country_scores[c]["name"],
         "riskScore": _country_scores[c]["riskScore"], "riskLevel": _country_scores[c]["riskLevel"],
         "isAnomaly": _country_scores[c]["isAnomaly"], "anomalyScore": _country_scores[c]["anomalyScore"]}
        for c in PRIORITY_COUNTRIES if c in _country_scores
    ]
    _rebuild_dashboard_summary(priority_rows + all_rows)
    elapsed = time.perf_counter() - t0
    print(f"Background: computed {len(all_rows)} remaining countries in {elapsed:.1f}s")


async def refresh_loop() -> None:
    """Background: full refresh every 15 minutes."""
    while True:
        await asyncio.sleep(900)
        loop = asyncio.get_event_loop()
        all_codes = list(MONITORED_COUNTRIES.keys())
        rows = await loop.run_in_executor(None, _compute_batch_sync, all_codes)
        _rebuild_dashboard_summary(rows)
        await _refresh_live_sources()
        print(f"Scores refreshed at {datetime.utcnow().isoformat()}Z — {len(rows)} countries")


# --- App ---
app = FastAPI(title="Sentinel AI API", version=MODEL_VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

tracker = PredictionTracker()


@app.on_event("startup")
async def startup():
    # API is up immediately; all computation runs in background
    asyncio.create_task(_startup_compute())
    asyncio.create_task(refresh_loop())
    print("Sentinel AI backend ready — API live, computing scores in background")


async def _startup_compute() -> None:
    """Run all score computation in a thread so the API stays responsive."""
    await asyncio.sleep(0.1)  # let uvicorn bind port
    loop = asyncio.get_event_loop()

    # Phase 1: priority countries (in thread so API can serve requests)
    t0 = time.perf_counter()
    priority_rows = await loop.run_in_executor(None, _compute_batch_sync, PRIORITY_COUNTRIES)
    _rebuild_dashboard_summary(priority_rows)
    elapsed = time.perf_counter() - t0
    print(f"Phase 1: {len(priority_rows)} priority countries ready in {elapsed:.1f}s")

    # Phase 2.5: kick off live source fetch (non-blocking)
    asyncio.create_task(_refresh_live_sources())

    # Phase 2: remaining countries (in thread, batched)
    priority_set = set(PRIORITY_COUNTRIES)
    remaining = [c for c in MONITORED_COUNTRIES if c not in priority_set]
    if remaining:
        t0 = time.perf_counter()
        BATCH = 30
        all_rows = []
        for i in range(0, len(remaining), BATCH):
            batch = remaining[i:i + BATCH]
            rows = await loop.run_in_executor(None, _compute_batch_sync, batch)
            all_rows.extend(rows)
        # Rebuild with all countries
        priority_rows_fresh = [
            {"code": c, "name": _country_scores[c]["name"],
             "riskScore": _country_scores[c]["riskScore"], "riskLevel": _country_scores[c]["riskLevel"],
             "isAnomaly": _country_scores[c]["isAnomaly"], "anomalyScore": _country_scores[c]["anomalyScore"]}
            for c in PRIORITY_COUNTRIES if c in _country_scores
        ]
        _rebuild_dashboard_summary(priority_rows_fresh + all_rows)
        elapsed = time.perf_counter() - t0
        print(f"Phase 2: {len(all_rows)} remaining countries computed in {elapsed:.1f}s")


def _compute_batch_sync(codes: list[str]) -> list[dict]:
    """Synchronous version of batch computation (runs in thread pool)."""
    all_features = SentinelFeaturePipeline.compute_all_countries(
        limit=len(codes), priority_codes=codes
    )
    rows = []
    for code in codes:
        info = MONITORED_COUNTRIES.get(code)
        if not info:
            continue
        features = all_features.get(code, {})
        rows.append(_score_country(code, info, features))
    return rows


@app.get("/")
async def root():
    """Simple root so the backend URL loads in a browser."""
    from fastapi.responses import HTMLResponse
    return HTMLResponse(
        "<!DOCTYPE html><html><body style='font-family:sans-serif;padding:2rem'>"
        "<h1>Sentinel AI API</h1><p>Backend is running.</p>"
        "<ul><li><a href='/health'>/health</a></li>"
        "<li><a href='/docs'>/docs</a> (Swagger)</li>"
        "<li><a href='/api/dashboard/summary'>/api/dashboard/summary</a></li></ul>"
        "</body></html>"
    )


@app.get("/health")
async def health():
    """Production-grade health check: model status, uptime, data freshness, coverage."""
    risk_model_path = ROOT / "models" / "risk_scorer.pkl"
    encoder_path = ROOT / "models" / "risk_label_encoder.pkl"
    forecaster_path = ROOT / "models" / "forecaster.pt"
    ml_ready = risk_model_path.exists() and encoder_path.exists()
    now = datetime.utcnow()
    uptime_seconds = (now - _startup_time).total_seconds()
    uptime_str = f"{int(uptime_seconds // 3600)}h {int((uptime_seconds % 3600) // 60)}m {int(uptime_seconds % 60)}s"

    countries_scored = len(_country_scores)
    countries_total = len(MONITORED_COUNTRIES)
    computed_at = _dashboard_summary.get("computedAt", None)

    # Count anomaly models available
    anomaly_model_count = len(list((ROOT / "models").glob("anomaly_*.pkl"))) if (ROOT / "models").exists() else 0

    return {
        "status": "ok",
        "api": True,
        "ml": ml_ready,
        "version": MODEL_VERSION,
        "uptime": uptime_str,
        "uptimeSeconds": round(uptime_seconds),
        "models": {
            "riskScorer": {"ready": risk_model_path.exists(), "type": "XGBoost", "features": 47},
            "anomalyDetection": {"ready": anomaly_model_count > 0, "type": "Isolation Forest", "countryModels": anomaly_model_count},
            "forecaster": {"ready": forecaster_path.exists(), "type": "LSTM", "horizons": ["30d", "60d", "90d"]},
            "sentiment": {"type": "FinBERT", "model": "ProsusAI/finbert"},
        },
        "data": {
            "countriesScored": countries_scored,
            "countriesTotal": countries_total,
            "coveragePct": round(100 * countries_scored / countries_total, 1) if countries_total > 0 else 0,
            "lastComputed": computed_at,
            "refreshIntervalMinutes": 15,
            "sources": get_status_counts(),
        },
        "demoCompany": "Cascade Precision Industries",
    }


def _validate_country(code: str) -> None:
    if code.upper() not in MONITORED_COUNTRIES:
        raise HTTPException(status_code=400, detail=f"Country code {code} not in monitored list")


@app.post("/api/analyze")
async def analyze_country(request: AnalyzeRequest):
    """Cached ML score from precompute + on-demand GPT-4o brief. Headlines fetched live for context."""
    country = request.country
    country_code = request.countryCode.strip().upper()
    _validate_country(country_code)

    if not _country_scores or country_code not in _country_scores:
        raise HTTPException(status_code=503, detail="Scores not yet computed; wait for backend startup to finish.")

    if is_cache_valid(country_code):
        return _cache[country_code]

    c = _country_scores[country_code]
    risk_prediction = c["risk_prediction"]
    anomaly = c["anomaly"]
    features = c["features"]

    headlines = await fetch_headlines(country)
    finbert_results = analyze_headlines_sentiment(headlines, country_code=country_code)

    tracker.log_prediction(country_code, risk_prediction, features, MODEL_VERSION)

    ml_context = build_gpt4o_context(country, risk_prediction, anomaly, finbert_results, headlines, features)
    brief = await call_gpt4o(ml_context, country, risk_prediction)

    if brief is None:
        brief = _build_local_brief(country, country_code, risk_prediction, features, finbert_results)
    else:
        # Ensure GPT-4o causalChain entries are proper objects (not strings)
        chain = brief.get("causalChain", [])
        if chain and isinstance(chain[0], str):
            brief["causalChain"] = [
                {"step": i + 1, "event": event, "probability": round(0.9 - i * 0.1, 2)}
                for i, event in enumerate(chain)
            ]

    result = {
        **brief,
        "mlMetadata": {
            "riskScore": risk_prediction["risk_score"],
            "confidence": risk_prediction["confidence"],
            "riskLevel": risk_prediction["risk_level"],
            "anomalyDetected": anomaly["is_anomaly"],
            "anomalyScore": anomaly["anomaly_score"],
            "sentimentLabel": finbert_results.get("dominant_sentiment", "neutral"),
            "escalatoryPct": finbert_results.get("headline_escalatory_pct", 0),
            "topDrivers": risk_prediction.get("top_drivers", []),
            "dataSources": {
                "totalAvailable": get_source_count(),
                "domains": len(CATEGORIES),
                "pipeline": ["GDELT", "ACLED", "UCDP", "World Bank", "NewsAPI.ai"],
                "liveFeeds": 6,
            },
            "modelVersion": MODEL_VERSION,
        },
    }
    _cache[country_code] = result
    _cache_ttl[country_code] = datetime.utcnow()
    return result


@app.post("/api/risk-score")
async def api_risk_score(request: RiskScoreRequest):
    country_code = request.countryCode.strip().upper()
    _validate_country(country_code)
    country = request.country

    headlines = await fetch_headlines(country)
    finbert_results = analyze_headlines_sentiment(headlines, country_code=country_code)
    gdelt_df = load_gdelt_cache(country_code)
    acled_df = load_acled_cache(country)
    ucdp_df = load_ucdp_cache(country)
    wb_features = load_wb_cache(country_code)
    pipeline = SentinelFeaturePipeline(country_code, country)
    features = pipeline.compute(gdelt_df, acled_df, ucdp_df, wb_features, headlines, finbert_results)

    try:
        risk_prediction = predict_risk(features)
    except FileNotFoundError:
        raise HTTPException(status_code=503, detail="Risk scorer not trained. Run: python -m backend.ml.risk_scorer")
    return risk_prediction


@app.get("/api/anomalies")
async def api_anomalies():
    """Return pre-computed anomaly flags for all countries (instant)."""
    if not _country_scores:
        raise HTTPException(status_code=503, detail="Scores not yet computed; wait for backend startup to finish.")
    return [
        {
            "countryCode": code,
            "country": c["name"],
            "isAnomaly": c["isAnomaly"],
            "anomalyScore": c["anomalyScore"],
            "severity": c["severity"],
        }
        for code, c in _country_scores.items()
    ]


@app.post("/api/forecast")
async def api_forecast(request: ForecastRequest):
    country_code = request.countryCode.strip().upper()
    _validate_country(country_code)
    country = request.country

    gdelt_df = load_gdelt_cache(country_code)
    acled_df = load_acled_cache(country)
    ucdp_df = load_ucdp_cache(country)
    wb_features = load_wb_cache(country_code)
    pipeline = SentinelFeaturePipeline(country_code, country)
    features = pipeline.compute(gdelt_df, acled_df, ucdp_df, wb_features)

    seq = _build_forecast_sequence(features, country_code=country_code, country_name=country)
    try:
        forecast = forecast_risk(seq)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Post-process: clamp forecasts based on current risk score
    # Forecasts shouldn't wildly diverge from current reality
    current_risk = _country_scores.get(country_code, {}).get("riskScore", 0)
    if current_risk > 0:
        # Floor: don't drop more than 10-20 points
        if current_risk >= 81:  # CRITICAL
            floor = max(current_risk - 10, 70)
        elif current_risk >= 61:  # HIGH
            floor = max(current_risk - 15, 45)
        else:
            floor = max(current_risk - 20, 0)
        # Ceiling: don't spike more than 8 points above current
        ceiling = min(100, current_risk + 8)
        for key in ("forecast_30d", "forecast_60d", "forecast_90d"):
            forecast[key] = round(max(floor, min(ceiling, forecast[key])), 1)
        # Recompute trend after clamping — use wider threshold to avoid false trends
        forecast["trend"] = (
            "ESCALATING" if forecast["forecast_90d"] > forecast["forecast_30d"] + 8
            else "DE-ESCALATING" if forecast["forecast_30d"] > forecast["forecast_90d"] + 8
            else "STABLE"
        )

    return {
        "countryCode": country_code,
        "country": country,
        **forecast,
    }


@app.get("/api/countries")
async def api_countries():
    """Return pre-computed risk scores for all countries (instant)."""
    if not _country_scores:
        raise HTTPException(status_code=503, detail="Scores not yet computed; wait for backend startup to finish.")
    return [
        {
            "countryCode": code,
            "country": c["name"],
            "riskScore": c["riskScore"],
            "riskLevel": c["riskLevel"],
        }
        for code, c in _country_scores.items()
    ]


@app.get("/api/dashboard/summary")
async def api_dashboard_summary(limit: int = DASHBOARD_COUNTRY_LIMIT):
    """Return pre-computed dashboard KPIs. ?limit=N controls how many countries to show (0 = all)."""
    if not _dashboard_summary:
        raise HTTPException(status_code=503, detail="Scores not yet computed; wait for backend startup to finish.")
    if limit <= 0:
        return _dashboard_summary
    result = dict(_dashboard_summary)
    result["countries"] = _dashboard_summary["countries"][:limit]
    return result


@app.get("/api/dashboard/sub-scores")
async def api_dashboard_sub_scores():
    """Weighted sub-score breakdown across 5 risk dimensions."""
    if not _country_scores:
        raise HTTPException(status_code=503, detail="Scores not yet computed; wait for backend startup to finish.")

    global _previous_sub_scores
    sub_scores = {}
    for dim, cfg in _SUB_SCORE_DIMENSIONS.items():
        values = []
        drivers = []
        for code, c in _country_scores.items():
            feats = c.get("features", {})
            normalized_vals = []
            for k in cfg["keys"]:
                raw = float(feats.get(k, 0) or 0)
                max_val = _FEATURE_NORMALIZERS.get(k, 100.0)
                if k in _INVERT_FEATURES:
                    norm = max(0.0, min(1.0, -raw / max_val))
                else:
                    norm = max(0.0, min(1.0, raw / max_val))
                normalized_vals.append(norm)
            avg = sum(normalized_vals) / len(normalized_vals) if normalized_vals else 0
            values.append(avg)
            if avg > 0.05:
                drivers.append({"country": c["name"], "code": code, "value": round(avg * 100, 1)})
        raw_avg = sum(values) / len(values) if values else 0
        value = round(min(100, max(0, raw_avg * 100)), 1)
        prev_value = _previous_sub_scores.get(dim, value)
        delta = round(value - prev_value, 1)
        drivers_sorted = sorted(drivers, key=lambda d: d["value"], reverse=True)[:5]
        sub_scores[dim] = {
            "value": value,
            "delta": delta,
            "description": cfg["description"],
            "drivers": drivers_sorted,
        }
    _previous_sub_scores = {dim: sub_scores[dim]["value"] for dim in sub_scores}
    return {"subScores": sub_scores}


@app.get("/api/dashboard/alerts")
async def api_dashboard_alerts():
    """Return accumulated alerts from score changes."""
    return {"alerts": _alerts_history}


@app.get("/api/dashboard/kpis")
async def api_dashboard_kpis():
    """Rich KPI aggregation from pre-computed country scores."""
    if not _country_scores:
        raise HTTPException(status_code=503, detail="Scores not yet computed; wait for backend startup to finish.")

    scores = list(_country_scores.values())
    risk_values = [c["riskScore"] for c in scores]
    # Use the same GTI as dashboard summary for consistency
    gti = _dashboard_summary.get("globalThreatIndex", round(sum(risk_values) / len(risk_values)) if risk_values else 0)

    prev_gti = _gti_history[-2] if len(_gti_history) >= 2 else gti
    gti_delta = gti - prev_gti
    if len(_gti_history) >= 3:
        trend = "rising" if _gti_history[-1] > _gti_history[-3] else "falling" if _gti_history[-1] < _gti_history[-3] else "stable"
    else:
        trend = "stable"

    top_contributors = sorted(scores, key=lambda c: c["riskScore"], reverse=True)[:5]
    top_contributors_out = [{"name": c["name"], "score": c["riskScore"], "level": c["riskLevel"]} for c in top_contributors]

    active_anomalies = sum(1 for c in scores if c["isAnomaly"])

    risk_dist = {"CRITICAL": 0, "HIGH": 0, "ELEVATED": 0, "MODERATE": 0, "LOW": 0}
    for c in scores:
        level = c["riskLevel"]
        if level in risk_dist:
            risk_dist[level] += 1

    # Regional breakdown
    region_map: dict[str, list] = {}
    for code, c in _country_scores.items():
        info = MONITORED_COUNTRIES.get(code, {})
        region = info.get("region", "Other")
        region_map.setdefault(region, []).append(c["riskScore"])
    regional_breakdown = {
        region: {"avgRisk": round(sum(vals) / len(vals), 1), "countries": len(vals)}
        for region, vals in region_map.items()
    }

    return {
        "globalThreatIndex": {"score": gti, "delta": gti_delta, "trend": trend, "topContributors": top_contributors_out},
        "activeAnomalies": active_anomalies,
        "riskDistribution": risk_dist,
        "regionalBreakdown": regional_breakdown,
        "totalMonitored": len(scores),
        "computedAt": datetime.utcnow().isoformat() + "Z",
    }


@app.get("/api/dashboard/kpis/history")
async def api_dashboard_kpis_history():
    """Return historical KPI data (30 days, synthetic backfill + live)."""
    _backfill_kpi_history()
    gti_values = [{"date": h["date"], "value": h["globalThreatIndex"]} for h in _kpi_history]
    anomaly_values = [{"date": h["date"], "value": h["activeAnomalies"]} for h in _kpi_history]
    high_values = [{"date": h["date"], "value": h["highPlusCountries"]} for h in _kpi_history]
    escalation_values = [{"date": h["date"], "value": h["escalationAlerts24h"]} for h in _kpi_history]
    return {
        "globalThreatIndex": {"period": "30d", "values": gti_values},
        "activeAnomalies": {"period": "30d", "values": anomaly_values},
        "highPlusCountries": {"period": "30d", "values": high_values},
        "escalationAlerts24h": {"period": "30d", "values": escalation_values},
    }


@app.get("/api/recent-activity")
async def api_recent_activity():
    """Return recent activity feed items."""
    items = list(_activity_feed)
    # Add tracker predictions as activity items
    try:
        record = tracker.get_track_record(limit=5)
        for pred in record:
            items.append({
                "time": pred.get("timestamp", datetime.utcnow().isoformat() + "Z"),
                "icon": "cpu",
                "text": f"ML prediction logged for {pred.get('country_code', '??')} — risk {pred.get('risk_score', 0)}",
                "country": pred.get("country_code", ""),
                "type": "prediction",
            })
    except Exception:
        pass
    items.sort(key=lambda x: x.get("time", ""), reverse=True)
    return {"items": items[:30]}


@app.get("/api/track-record")
async def api_track_record():
    record = tracker.get_track_record(limit=20)
    accuracy = tracker.compute_accuracy(days_back=90)
    return {"predictions": record, "accuracy": accuracy}


# --- Live source cache (populated at startup, refreshed with scores) ---
_live_source_data: dict = {}


@app.get("/api/data-sources")
async def api_data_sources():
    """Full 107-source inventory with category breakdown and live feed data."""
    return {
        "total": get_source_count(),
        "categories": len(CATEGORIES),
        "categoryBreakdown": get_category_summary(),
        "status": get_status_counts(),
        "sources": DATA_SOURCES,
        "liveFeeds": _live_source_data or {},
        "fetchedAt": datetime.utcnow().isoformat() + "Z",
    }


async def _refresh_live_sources() -> None:
    """Fire-and-forget live source refresh."""
    global _live_source_data
    try:
        _live_source_data = await fetch_all_live_sources()
    except Exception:
        pass  # never block the main loop


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=False)
