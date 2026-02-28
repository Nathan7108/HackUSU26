# Sentinel AI — Live Data Source Fetchers
# Six async fetchers for free, no-auth APIs. Each cached 5 minutes.
# Fire-and-forget: failures return empty results, never block the pipeline.

from __future__ import annotations

import asyncio
import time
from datetime import datetime

import httpx

# ── Cache ────────────────────────────────────────────────────────────────
_cache: dict[str, dict] = {}
_cache_ts: dict[str, float] = {}
CACHE_TTL = 300  # 5 minutes


def _is_fresh(key: str) -> bool:
    return key in _cache_ts and (time.time() - _cache_ts[key]) < CACHE_TTL


def _set_cache(key: str, data: dict) -> dict:
    _cache[key] = data
    _cache_ts[key] = time.time()
    return data


# ── 1. USGS Earthquakes ─────────────────────────────────────────────────

async def fetch_usgs_earthquakes(min_magnitude: float = 4.5, limit: int = 20) -> dict:
    """Fetch recent significant earthquakes from USGS."""
    key = "usgs_earthquakes"
    if _is_fresh(key):
        return _cache[key]
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson"
            )
            resp.raise_for_status()
            data = resp.json()
            events = []
            for f in data.get("features", [])[:limit]:
                props = f.get("properties", {})
                coords = f.get("geometry", {}).get("coordinates", [0, 0, 0])
                events.append({
                    "magnitude": props.get("mag"),
                    "place": props.get("place"),
                    "time": datetime.utcfromtimestamp(props.get("time", 0) / 1000).isoformat() + "Z",
                    "lat": coords[1],
                    "lng": coords[0],
                    "depth_km": coords[2],
                    "url": props.get("url"),
                })
            return _set_cache(key, {"source": "USGS", "count": len(events), "events": events, "fetchedAt": datetime.utcnow().isoformat() + "Z"})
    except Exception:
        return _cache.get(key, {"source": "USGS", "count": 0, "events": [], "error": "fetch_failed"})


# ── 2. GDACS Disaster Alerts ────────────────────────────────────────────

async def fetch_gdacs_alerts(limit: int = 10) -> dict:
    """Fetch multi-hazard disaster alerts from GDACS."""
    key = "gdacs_alerts"
    if _is_fresh(key):
        return _cache[key]
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH",
                params={"alertlevel": "Green;Orange;Red", "limit": limit},
                headers={"Accept": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()
            alerts = []
            for feat in data.get("features", [])[:limit]:
                props = feat.get("properties", {})
                coords = feat.get("geometry", {}).get("coordinates", [0, 0])
                alerts.append({
                    "eventType": props.get("eventtype"),
                    "name": props.get("name") or props.get("htmldescription", "")[:80],
                    "alertLevel": props.get("alertlevel"),
                    "country": props.get("country"),
                    "date": props.get("fromdate"),
                    "severity": props.get("severitydata", {}).get("severity") if isinstance(props.get("severitydata"), dict) else None,
                    "lat": coords[1] if len(coords) > 1 else 0,
                    "lng": coords[0] if len(coords) > 0 else 0,
                })
            return _set_cache(key, {"source": "GDACS", "count": len(alerts), "alerts": alerts, "fetchedAt": datetime.utcnow().isoformat() + "Z"})
    except Exception:
        return _cache.get(key, {"source": "GDACS", "count": 0, "alerts": [], "error": "fetch_failed"})


# ── 3. Frankfurter Exchange Rates ────────────────────────────────────────

async def fetch_exchange_rates(base: str = "USD") -> dict:
    """Fetch latest ECB reference exchange rates via Frankfurter."""
    key = f"exchange_rates_{base}"
    if _is_fresh(key):
        return _cache[key]
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"https://api.frankfurter.dev/v1/latest",
                params={"base": base},
            )
            resp.raise_for_status()
            data = resp.json()
            return _set_cache(key, {
                "source": "Frankfurter/ECB",
                "base": data.get("base", base),
                "date": data.get("date"),
                "rates": data.get("rates", {}),
                "fetchedAt": datetime.utcnow().isoformat() + "Z",
            })
    except Exception:
        return _cache.get(key, {"source": "Frankfurter/ECB", "base": base, "rates": {}, "error": "fetch_failed"})


# ── 4. ReliefWeb Humanitarian Reports ───────────────────────────────────

async def fetch_reliefweb_reports(limit: int = 10) -> dict:
    """Fetch latest humanitarian situation reports from ReliefWeb."""
    key = "reliefweb_reports"
    if _is_fresh(key):
        return _cache[key]
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://api.reliefweb.int/v1/reports",
                params={
                    "appname": "sentinel-ai",
                    "limit": limit,
                    "fields[include][]": ["title", "date.created", "country.name", "source.name", "url_alias"],
                    "sort[]": "date.created:desc",
                },
            )
            resp.raise_for_status()
            data = resp.json()
            reports = []
            for item in data.get("data", []):
                fields = item.get("fields", {})
                countries = [c.get("name") for c in fields.get("country", [])] if isinstance(fields.get("country"), list) else []
                sources = [s.get("name") for s in fields.get("source", [])] if isinstance(fields.get("source"), list) else []
                reports.append({
                    "title": fields.get("title"),
                    "date": fields.get("date", {}).get("created") if isinstance(fields.get("date"), dict) else None,
                    "countries": countries,
                    "sources": sources,
                    "url": fields.get("url_alias"),
                })
            return _set_cache(key, {"source": "ReliefWeb", "count": len(reports), "reports": reports, "fetchedAt": datetime.utcnow().isoformat() + "Z"})
    except Exception:
        return _cache.get(key, {"source": "ReliefWeb", "count": 0, "reports": [], "error": "fetch_failed"})


# ── 5. OONI Internet Censorship ─────────────────────────────────────────

async def fetch_ooni_censorship(limit: int = 10) -> dict:
    """Fetch recent internet censorship measurements from OONI."""
    key = "ooni_censorship"
    if _is_fresh(key):
        return _cache[key]
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://api.ooni.io/api/v1/incidents/search",
                params={"limit": limit},
            )
            resp.raise_for_status()
            data = resp.json()
            incidents = []
            for inc in data.get("incidents", [])[:limit]:
                incidents.append({
                    "title": inc.get("title"),
                    "shortDescription": inc.get("short_description"),
                    "startTime": inc.get("start_time"),
                    "endTime": inc.get("end_time"),
                    "ASNs": inc.get("ASNs", []),
                    "CCs": inc.get("CCs", []),
                    "published": inc.get("published"),
                })
            return _set_cache(key, {"source": "OONI", "count": len(incidents), "incidents": incidents, "fetchedAt": datetime.utcnow().isoformat() + "Z"})
    except Exception:
        return _cache.get(key, {"source": "OONI", "count": 0, "incidents": [], "error": "fetch_failed"})


# ── 6. NASA EONET Natural Events ────────────────────────────────────────

async def fetch_nasa_eonet(limit: int = 15) -> dict:
    """Fetch active natural events from NASA EONET."""
    key = "nasa_eonet"
    if _is_fresh(key):
        return _cache[key]
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://eonet.gsfc.nasa.gov/api/v3/events",
                params={"status": "open", "limit": limit},
            )
            resp.raise_for_status()
            data = resp.json()
            events = []
            for ev in data.get("events", [])[:limit]:
                geo = ev.get("geometry", [{}])
                coords = geo[0].get("coordinates", [0, 0]) if geo else [0, 0]
                categories = [c.get("title") for c in ev.get("categories", [])]
                events.append({
                    "title": ev.get("title"),
                    "categories": categories,
                    "date": geo[0].get("date") if geo else None,
                    "lat": coords[1] if len(coords) > 1 else 0,
                    "lng": coords[0] if len(coords) > 0 else 0,
                    "link": ev.get("link"),
                })
            return _set_cache(key, {"source": "NASA EONET", "count": len(events), "events": events, "fetchedAt": datetime.utcnow().isoformat() + "Z"})
    except Exception:
        return _cache.get(key, {"source": "NASA EONET", "count": 0, "events": [], "error": "fetch_failed"})


# ── Aggregate fetcher ────────────────────────────────────────────────────

async def fetch_all_live_sources() -> dict:
    """Fetch all live sources concurrently. Returns dict keyed by source id."""
    results = await asyncio.gather(
        fetch_usgs_earthquakes(),
        fetch_gdacs_alerts(),
        fetch_exchange_rates(),
        fetch_reliefweb_reports(),
        fetch_ooni_censorship(),
        fetch_nasa_eonet(),
        return_exceptions=True,
    )
    keys = ["usgs_earthquakes", "gdacs_alerts", "exchange_rates", "reliefweb_reports", "ooni_censorship", "nasa_eonet"]
    out = {}
    for key, result in zip(keys, results):
        if isinstance(result, Exception):
            out[key] = {"source": key, "error": str(result)}
        else:
            out[key] = result
    return out
