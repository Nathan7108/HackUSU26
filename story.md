# Sentinel AI — Demo Story (Locked)

## The Company: Cascade Precision Industries

| | |
|---|---|
| **Name** | Cascade Precision Industries |
| **Revenue** | $3.8B |
| **Sector** | Precision aerospace components — castings, composites, avionics housings |
| **Customers** | Boeing, Airbus, Lockheed Martin, Raytheon (Tier 2 supplier) |
| **Employees** | ~14,000 across 6 countries |
| **Problem** | 63% of revenue ($2.4B) flows through geopolitical chokepoints. Got blindsided by Russia sanctions in 2022 ($47M loss) and Red Sea rerouting in 2024 ($23M in added shipping). Now uses Sentinel. |

## Facilities (Globe Markers)

| Facility | Location | Lat | Lng | Function | Annual Value |
|----------|----------|-----|-----|----------|-------------|
| HQ + Primary Foundry | Portland, OR | 45.52 | -122.68 | Titanium casting, final assembly | $1.4B |
| Composite Plant | Toulouse, France | 43.60 | 1.44 | Carbon fiber structures (near Airbus) | $620M |
| Titanium Forging | Verdi, Italy | 45.44 | 10.99 | Precision forgings for landing gear | $340M |
| Electronics Packaging | Hsinchu, Taiwan | 24.80 | 120.97 | Avionics chip packaging (near TSMC) | $680M |
| Rare Earth Processing | Baotou, China | 40.66 | 109.84 | Yttrium/scandium coatings feedstock | $420M |
| Assembly & Test | Nagoya, Japan | 35.18 | 136.91 | Subsystem integration | $290M |
| APAC Distribution | Singapore | 1.35 | 103.82 | Transshipment hub | — |
| EU Distribution | Rotterdam, NL | 51.92 | 4.48 | European logistics hub | — |

## Trade Routes (Globe Arcs)

| # | From → To | Chokepoint | Risk | Annual Cargo |
|---|-----------|------------|------|-------------|
| 1 | Baotou → Hsinchu | Taiwan Strait | HIGH | $420M |
| 2 | Hsinchu → Nagoya | East China Sea | ELEVATED | $680M |
| 3 | Nagoya → Singapore | South China Sea | ELEVATED | $290M |
| 4 | Singapore → Rotterdam | Malacca + Suez + Bab el-Mandeb | HIGH | $1.1B |
| 5 | Rotterdam → Toulouse | European inland | LOW | $620M |
| 6 | Rotterdam → Portland | Transatlantic | LOW | $540M |
| 7 | Verdi → Toulouse | European inland | LOW | $340M |
| 8 | Baotou → Portland | Trans-Pacific | ELEVATED | $420M |
| 9 | Toulouse → Portland | Transatlantic | LOW | $620M |

## Risk Exposure by Hotspot

| Hotspot | Risk Source | Exposure | Real-World Basis |
|---------|-----------|----------|-----------------|
| Taiwan | China-Taiwan military escalation | $680M | 90% of advanced chips from Taiwan. PLA exercises ongoing. |
| China | Rare earth export controls | $420M | Yttrium prices up 60% as of Feb 26 2026. Two US firms paused production. Zero domestic scandium. |
| Red Sea / Suez | Houthi attacks on shipping | $1.1B | Added $15-20B/yr to global trade. 80% of Asia-Europe rerouted in 2024. |
| Russia | Titanium sanctions | $190M | Russia was 60% of aerospace titanium pre-2022. Still qualifying alternatives. |
| **TOTAL** | | **$2.4B** (63% of revenue) | |

## Actionable Recommendations

**Taiwan escalates to HIGH (score 78+):**
> BEGIN dual-source qualification with Samsung Foundry (Pyeongtaek, South Korea). Lead time: 14 weeks. Qualification cost: $12M. Cost of disruption: $680M. ROI: 56:1.

**China rare earth export controls tighten:**
> ACCELERATE purchase orders for 6-month yttrium buffer stock from Lynas Rare Earths (Kalgoorlie, Australia). Spot price premium: $3.2M. Cost of production pause: $420M/year.

**Red Sea risk remains ELEVATED:**
> MAINTAIN Cape of Good Hope routing for Singapore→Rotterdam cargo. Additional cost: $8.4M/quarter. Insurance premium reduction: $2.1M/quarter. Net cost: $6.3M. Cost of vessel attack: $100M+.

**Russia titanium alternatives:**
> COMPLETE qualification of Howmet Aerospace (Pittsburgh) as primary titanium supplier. Current VSMPO-AVISMA dependency: 22%. Target: 0% by Q3. Switch cost: $4.8M.

## 90-Second Demo Script

### [0-12s] THE HOOK
> "Two days ago, yttrium prices spiked 60%. Two aerospace manufacturers paused production because China blocked export licenses. They didn't see it coming. Their competitor did."

*Globe slowly rotates with arcs visible*

### [12-25s] THE COMPANY
> "Cascade Precision is a $3.8 billion aerospace manufacturer. Titanium castings, composites, avionics. They supply Boeing and Lockheed. $2.4 billion of their supply chain runs through four geopolitical chokepoints. This is their Sentinel dashboard."

*Press `1` — globe overview with all arcs, KPI numbers count up*

### [25-45s] THE ALERT
> "This morning, Sentinel flagged Taiwan at 71 and escalating."

*Press `2` — globe flies to Taiwan, IntelPanel slides in, score ticks up, causal chain reveals*

> "PLA naval exercises. 180% spike in tension events. $1.8 billion US arms package approved. Our LSTM model says this hits 78 within 60 days. For Cascade, that's $680 million in chip packaging at risk."

### [45-60s] THE RECOMMENDATION
> "Sentinel doesn't just detect — it tells you what to do. Dual-source with Samsung Foundry in South Korea. $12 million to qualify. $680 million if you don't."

*Panel scrolls to EXPOSURE & RECOMMENDATIONS section*

### [60-75s] THE SCALE
> "We do this for every country on Earth."

*Press `3` — flies to China, shows rare earth alert, then press `0` — zooms back to full globe*

> "201 countries. Four ML models. 47 features. Six real-time data sources. 75 years of conflict data. Updated every 15 minutes."

### [75-90s] THE CLOSE
> "Palantir does this for $50 million a year. We do it for $500 a month. Sentinel AI — geopolitical intelligence for the companies that actually need it."

*Full globe, all arcs and markers pulsing, "SENTINEL AI" visible*

## Keyboard Mapping

| Key | Action |
|-----|--------|
| `1` | Globe overview — all arcs, all markers, KPIs animate |
| `2` | Fly to Taiwan — open IntelPanel, animate score + causal chain |
| `3` | Fly to China — show rare earth alert |
| `4` | Fly to Red Sea region — show shipping risk |
| `0` | Reset to full globe view, close panels |
| `Esc` | Close IntelPanel |
