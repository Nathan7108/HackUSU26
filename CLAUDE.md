# CLAUDE.md — Sentinel AI

## What This Is

Sentinel AI is a real-time geopolitical crisis prediction platform. It predicts where conflict or instability will emerge in the next 30-90 days and tells companies exactly what to do about it. Palantir for the mid-market at $500/month instead of $50M.

## The Goal

This is for HackUSU 2026 (24-hour hackathon, Feb 27-28). The only goal is to win. Build an enterprise product that looks like companies would pay $200K/year for it. Not a hackathon toy. A real product.

Demo is 5 minutes to rotating judges from defense, intelligence, and data infrastructure companies.

## The Demo Company

The app is demoed through the lens of **Pacific Ridge Industries** — a fictional $4.2B logistics company with shipping routes, suppliers, and facilities exposed to geopolitical risk. Every prediction shows their specific dollar exposure and recommended actions.

## Frontend Inspiration

This should look and feel like:
- **demo.transpara.com** — Real-time operational KPI monitoring, dense, professional
- **Palantir Gotham/Foundry** — Dark, map-centric, intelligence-grade
- **Bloomberg Terminal** — Information density, monospace data, no wasted space

It should NOT look like a typical SaaS dashboard, a hackathon project, or anything with rounded corners, pastel colors, or glassmorphism.

## Backend

Already built in `backend/`. FastAPI + 4 ML models (XGBoost, Isolation Forest, FinBERT, LSTM). 98% accuracy. 201 countries. 6 data sources. 75 years of conflict data. Do not rewrite — integrate with it.

## Rules

- Always work on feature branches, never main
- Frontend: Vite + React + TypeScript + Tailwind + shadcn/ui + Mapbox GL JS + Recharts
- Dark mode only
- Prioritize demo-ability over completeness. A polished subset beats a broken whole.

---

## Architecture Overview

### System Architecture

```
Data Sources (GDELT, ACLED, UCDP, World Bank, NewsAPI)
         |
         v
SentinelFeaturePipeline (47 engineered features)
         |
    +-----------+
    |           |
    v           v
Risk Scorer   Anomaly Detection
(XGBoost)     (Isolation Forest x country)
    |           |
    v           v
Risk Score    Anomaly Flag + Severity
(0-100)       (is_anomaly, anomaly_score)
    |
    v
Sentiment Analysis (FinBERT)
    |
    v
LSTM Forecaster --> 30/60/90-day predictions
    |
    v
GPT-4o --> Intelligence Brief (on-demand)
    |
    v
FastAPI Endpoints --> Frontend Dashboard
    |
    v
SQLite Tracker --> Track record & accuracy
```

### Frontend (Next.js — existing HackathonFrontend repo)

| Category | Technology |
|----------|-----------|
| Framework | Next.js 16.1.6 (App Router, React 19) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + CSS variables |
| UI Components | Tremor React 3.18.7 |
| Charting | Recharts 3.7.0, Tremor SparkAreaChart |
| Mapping | Mapbox GL 3.19.0 (3D globe + 2D) |
| State | React Context (ScenarioContext, SidebarContext) |

### Backend (FastAPI — existing HackathonML repo)

| Category | Technology |
|----------|-----------|
| API | FastAPI 0.110.0 + Uvicorn |
| Risk Scoring | XGBoost 2.0.3 (5-class classifier) |
| Anomaly Detection | Scikit-learn Isolation Forest (per-country) |
| Sentiment | HuggingFace Transformers + ProsusAI/FinBERT |
| Forecasting | PyTorch 2.2.1 LSTM (attention, 2-layer) |
| Intelligence | OpenAI GPT-4o (causal chain generation) |
| Data | Pandas, NumPy, SciPy |
| Storage | SQLite (prediction tracking), Pickle/Joblib (models) |

---

## Backend Deep Dive

### ML Models

#### 1. Risk Scorer (XGBoost)
- **Input**: 47 features from SentinelFeaturePipeline
- **Output**: 5-class (LOW/MODERATE/ELEVATED/HIGH/CRITICAL) + score 0-100 + confidence + top drivers
- **Config**: 500 estimators, max_depth=6, learning_rate=0.05, weighted class balancing
- **File**: `backend/ml/risk_scorer.py` (468 lines)
- **Model**: `models/risk_scorer.pkl` (6.3 MB)

#### 2. Anomaly Detection (Isolation Forest)
- **Input**: 6 GDELT features (goldstein_mean/std/min, mentions_total, avg_tone, event_count) aggregated weekly
- **Output**: anomaly_score (0-1), is_anomaly (bool), severity (LOW/MED/HIGH)
- **Config**: contamination=0.05, 200 trees, StandardScaler per country
- **File**: `backend/ml/anomaly.py` (285 lines)
- **Models**: `models/anomaly_{CC}.pkl` + `models/scaler_{CC}.pkl` (200+ country pairs)

#### 3. Sentiment Analyzer (FinBERT)
- **Input**: List of news headlines
- **Output**: 8 aggregate scores (negative/positive/neutral, headline_volume, escalatory_pct, media_negativity_index, sentiment_trend, dominant_sentiment)
- **Model**: ProsusAI/finbert (441 MB, cached after first download)
- **File**: `backend/ml/sentiment.py` (115 lines)

#### 4. LSTM Forecaster
- **Input**: (batch, 90, 12) — 90 days of 12 sequence features
- **Output**: [score_30d, score_60d, score_90d] with sigmoid scaling to 0-100
- **Architecture**: 2-layer LSTM (hidden=128) + attention + FC, dropout=0.2
- **File**: `backend/ml/forecaster.py` (517 lines)
- **Model**: `models/forecaster.pt` (859 KB)

### Feature Pipeline (47 Features)

| Source | Count | Features |
|--------|-------|----------|
| GDELT | 10 | goldstein_mean/std/min, event_count, avg_tone, conflict_pct, acceleration, mention_weighted_tone, volatility |
| ACLED | 10 | fatalities_30d, battle_count, civilian_violence, explosion_count, protest_count, fatality_rate, event_count_90d, event_acceleration, unique_actors, geographic_spread |
| UCDP | 5 | total_deaths, state_conflict_years, civilian_deaths, conflict_intensity, recurrence_rate |
| World Bank | 10 | GDP growth (latest + trend), inflation, unemployment, debt_pct_gdp, FDI, military_spend, composite_stress |
| Sentiment | 7 | finbert_negative/positive/neutral, headline_volume, escalatory_pct, media_negativity_index, sentiment_trend |
| Derived | 5 | anomaly_score, conflict_composite, political_risk_score, humanitarian_score, economic_stress_score |

### API Endpoints

**Dashboard (pre-computed, fast):**
- `GET /api/dashboard/summary` — globalThreatIndex, activeAnomalies, highPlusCountries, escalationAlerts24h, modelHealth, countries list
- `GET /api/dashboard/kpis` — rich KPI data (threat index, anomalies, distribution)
- `GET /api/dashboard/kpis/history` — time-series for sparklines
- `GET /api/dashboard/sub-scores` — ML feature aggregates (5 risk dimensions)
- `GET /api/dashboard/alerts` — escalation alerts (TIER_CHANGE, SCORE_SPIKE, ANOMALY)
- `GET /api/countries` — all country risk scores + levels
- `GET /api/anomalies` — anomaly flags for all countries

**Analysis (on-demand, heavier):**
- `POST /api/analyze` — full analysis: risk + features + GPT-4o brief (15-min cache)
- `POST /api/risk-score` — just the risk prediction
- `POST /api/forecast` — 30/60/90-day LSTM forecast + trend

**Tracking:**
- `GET /api/track-record` — last 20 predictions + accuracy metrics

### Data Sources & Storage

| Source | Size | Description |
|--------|------|-------------|
| GDELT v2 | 26 MB | Event exports per country (CSV) |
| ACLED | 814 MB | Conflict events per country (CSV) |
| UCDP GED | 478 MB | Armed conflict casualties (CSV) |
| World Bank | 394 KB | 6 economic indicators per country (JSON) |
| Models | 360 MB | All trained model files |
| SQLite | ~1 MB | Prediction tracking DB |

### Startup & Runtime Behavior

1. Pre-computes scores for 15 countries (DASHBOARD_COUNTRY_LIMIT)
2. Loads forecaster model (PyTorch)
3. Starts background refresh task (every 15 minutes)
4. FinBERT loaded on first `/api/analyze` call (441 MB, one-time)
5. GPT-4o called per-country on-demand with 15-min cache

### Environment Variables Required

```
OPENAI_API_KEY=sk-...       # GPT-4o integration (optional — brief omitted if missing)
NEWS_API=...                # NewsAPI headlines (optional — empty headlines if missing)
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1...
```

---

## Frontend Deep Dive

### Pages & Routes

| Route | Status | Description |
|-------|--------|-------------|
| `/dashboard` | Complete | Main KPI overview, watchlist, alerts, analytics |
| `/globe` | Complete | 3D/2D Mapbox globe with conflict zones, facilities, anomalies |
| `/analysis` | Complete | Watchlist country cards linking to detail |
| `/country/[code]` | Complete | Full intelligence brief with causal chains |
| `/alerts` | Stub | Live SIGACT feed |
| `/countries` | Stub | Country rankings table |
| `/forecasts` | Stub | Forecast viewer |
| `/intelligence` | Stub | Intelligence feed |
| `/settings` | Stub | Configuration |

### Key Components

- **KpiStrip** — 5 metric cards with color-coded trends + sparklines
- **WatchlistTable** — Top 5 countries by risk (Tremor BarList)
- **ThreatMap** — SVG world map with trade routes + risk glyphs
- **GlobeMap** — 1400+ line Mapbox component (choropleth, conflict markers, trade routes, anomaly pulses)
- **AlertFeed** — Scrollable alert list sorted by severity
- **CountryAnalysisView** — 7-step causal chain, headlines, forecast charts, assets at risk, sub-scores
- **SigactTicker** — Bottom news ticker with 60s scroll animation

### Design System

- Dark theme via CSS variables (`--shell-bg`, `--content-bg`, `--risk-low` through `--risk-critical`)
- Risk color mapping: Critical (dark red) → Low (green) consistent across all components
- Custom animations: `live-pulse`, `marker-pulse`, `ticker-scroll`, `slide-in-right`, `globe-pulse`
- GPU-optimized with `will-change`, `backface-visibility`, `transform3d`

---

## Improvement Recommendations

### ML Model Robustness

1. **Training data leakage risk** — `build_training_dataset()` aggregates ACLED by month. Ensure no future data leaks into features when computing rolling windows. Use strict temporal splits.

2. **Synthetic data in LSTM** — Countries with <180 real days get synthetic interpolation. This teaches the model fake patterns. Better to exclude sparse countries or use transfer learning from data-rich ones.

3. **Class imbalance** — XGBoost uses inverse weighting but with limited training months per class, consider SMOTE oversampling or reducing to 3 classes (LOW/MODERATE/HIGH) for more reliable predictions.

4. **Anomaly contamination hardcoded at 0.05** — Assumes 5% of weeks are anomalous everywhere. Ukraine vs. Switzerland should have different baselines. Tune per-country or use a validation set.

5. **No uncertainty quantification** — LSTM outputs point forecasts only. Add Monte Carlo dropout or quantile regression for confidence intervals (e.g., "70-85 risk, 90% CI").

6. **No baseline comparison** — Does a linear trend or ARIMA beat the LSTM? Always benchmark complex models against simple ones. If ARIMA gets 90% of the way there, the LSTM isn't adding value.

### API & Performance

7. **No authentication** — Anyone can hit `/api/analyze` and burn OpenAI credits. Add API key auth or rate limiting before demo day.

8. **GPT-4o called synchronously** — Expensive and slow. Pre-generate briefs during background refresh and cache them. During demo, everything should feel instant.

9. **15-min cache is too aggressive** — Geopolitical data doesn't change that fast. Use 1-hour cache with manual refresh to save compute.

10. **No request queuing** — 10 simultaneous `/api/analyze` calls = 10 concurrent FinBERT + GPT-4o invocations. Add `asyncio.Semaphore` or a task queue.

11. **External API calls can fail silently** — GDELT/ACLED/UCDP fetches need retry logic with exponential backoff and health checks on data freshness.

### Data Pipeline

12. **No data freshness tracking** — CSVs are read from disk with no timestamp metadata. The dashboard should show "data as of X" so analysts trust the output.

13. **GDELT fetcher downloads ~2880 files** — Slow and fragile. GDELT BigQuery (free tier) is faster and more reliable.

14. **World Bank data is annual** — Cache for days/weeks, not minutes. No need to recompute in the 15-min refresh cycle.

15. **No pipeline orchestration** — Data fetching, feature computation, and inference are all inline. Separate into scheduled ETL vs. real-time inference.

16. **CSV storage is slow** — Convert GDELT/ACLED/UCDP CSVs to Parquet for 5-10x faster reads and ~3x compression.

### LSTM Forecaster

17. **Only 859 KB model** — Suggests limited training data. ACLED goes back to 1997, use longer history.

18. **No cross-country transfer learning** — Train on all countries jointly, then fine-tune per-country. This gives sparse countries better priors.

19. **12 sequence features may be noisy** — Run ablation studies: which features actually improve forecasts? Removing noisy features often improves performance.

### Frontend

20. **Several pages are stubs** — `/alerts`, `/countries`, `/forecasts`, `/intelligence` all show placeholders. Prioritize `/alerts` and `/forecasts` since backend data already exists.

21. **No real-time push** — Dashboard fetches on mount. Add Server-Sent Events for live alert pushes during demo.

22. **No error states** — If backend is down, frontend shows blank cards. Add loading skeletons and error boundaries.

23. **Mapbox token in `.env.local`** — Ensure this is in `.gitignore` and not committed.

### DevOps & Production Readiness

24. **No Docker** — Add `docker-compose.yml` (backend + frontend) for one-command deployment. Critical for demo reliability.

25. **No tests** — Zero test files in either repo. Add at minimum: API endpoint integration tests and feature pipeline unit tests.

26. **360 MB of models in repo** — Use Git LFS or host models externally (S3/GCS) and download at startup.

27. **No CI/CD** — Add GitHub Actions for linting, type checking, and basic smoke tests.

28. **SQLite won't scale** — Fine for hackathon, but note this for any post-hackathon pitch.

### Quick Wins for Demo Day

29. **Pre-warm everything** — Run all country analyses before the demo so every click is instant from cache.

30. **Add `/api/health` with model timestamps** — Shows judges the system is production-grade.

31. **Add request logging** — Latency per endpoint, cache hit rate. Judges from data infra companies will ask about this.

32. **Pacific Ridge overlay** — Ensure every prediction surfaces dollar exposure and recommended actions specific to the demo company. This is what makes it feel like a $200K/year product, not a school project.

---

## Best Practices

### Git Workflow
- Always branch from `main`: `git checkout -b feature/description`
- Keep commits atomic and descriptive
- PR into main, never push directly
- Use conventional commits: `feat:`, `fix:`, `chore:`, `docs:`

### Code Quality
- TypeScript strict mode — no `any` types
- All API responses typed in `lib/types.ts`
- Components in dedicated folders with co-located types
- Hooks in `lib/hooks/` — one hook per data concern
- Constants and magic numbers in `lib/constants.ts`

### API Integration
- All fetch calls go through `lib/api.ts` (centralized error handling)
- Use `AbortController` for request cancellation on unmount
- Cache responses client-side where appropriate
- Always handle loading, error, and empty states

### Performance
- Lazy load heavy components (Mapbox, Recharts) with `next/dynamic`
- Use `React.memo` for expensive renders in lists
- Debounce search inputs and map interactions
- Pre-compute dashboard data on backend startup

### Demo Priorities
1. Dashboard loads instantly with real data
2. Globe interaction is smooth and responsive
3. Country drill-down shows causal chain + forecast
4. Every screen shows Pacific Ridge's specific exposure
5. Nothing crashes. Nothing shows "loading" for more than 1 second.
