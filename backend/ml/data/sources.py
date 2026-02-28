# Sentinel AI — Data Source Registry
# 107 data sources across 12 intelligence domains.
# ML pipeline uses 5 active sources (47 features). Remaining sources enrich
# API responses, intelligence briefs, and live monitoring feeds.

from __future__ import annotations

DATA_SOURCES: list[dict] = [
    # ──────────────────────────────────────────────────────────────────────
    # 1. CONFLICT & SECURITY  (14 sources)
    # ──────────────────────────────────────────────────────────────────────
    {"id": "gdelt", "name": "GDELT Project", "category": "Conflict & Security",
     "description": "Global Database of Events, Language & Tone — real-time event coding from worldwide news media",
     "url": "https://www.gdeltproject.org", "status": "active", "freshness": "15min", "dataType": "events"},
    {"id": "acled", "name": "ACLED", "category": "Conflict & Security",
     "description": "Armed Conflict Location & Event Data — political violence and protest tracking across 200+ countries",
     "url": "https://acleddata.com", "status": "active", "freshness": "weekly", "dataType": "events"},
    {"id": "ucdp", "name": "Uppsala Conflict Data Program", "category": "Conflict & Security",
     "description": "75+ years of armed conflict data — state-based, non-state, and one-sided violence",
     "url": "https://ucdp.uu.se", "status": "active", "freshness": "monthly", "dataType": "historical"},
    {"id": "gtd", "name": "Global Terrorism Database", "category": "Conflict & Security",
     "description": "START consortium terrorism incident database — 200K+ events since 1970",
     "url": "https://www.start.umd.edu/gtd", "status": "registered", "freshness": "annual", "dataType": "historical"},
    {"id": "sipri_arms", "name": "SIPRI Arms Transfers", "category": "Conflict & Security",
     "description": "Stockholm International Peace Research Institute arms trade data",
     "url": "https://www.sipri.org/databases/armstransfers", "status": "registered", "freshness": "annual", "dataType": "trade"},
    {"id": "sipri_milex", "name": "SIPRI Military Expenditure", "category": "Conflict & Security",
     "description": "Military spending data for 170+ countries since 1949",
     "url": "https://www.sipri.org/databases/milex", "status": "registered", "freshness": "annual", "dataType": "economic"},
    {"id": "iiss_milbal", "name": "IISS Military Balance", "category": "Conflict & Security",
     "description": "International Institute for Strategic Studies — force structure and defense economics",
     "url": "https://www.iiss.org/publications/the-military-balance", "status": "registered", "freshness": "annual", "dataType": "assessment"},
    {"id": "janes", "name": "Janes Defence Intelligence", "category": "Conflict & Security",
     "description": "Military capabilities, equipment, and order-of-battle data",
     "url": "https://www.janes.com", "status": "registered", "freshness": "daily", "dataType": "intelligence"},
    {"id": "liveuamap", "name": "LiveUAMap", "category": "Conflict & Security",
     "description": "Real-time conflict mapping — geolocated military and security incidents",
     "url": "https://liveuamap.com", "status": "registered", "freshness": "real-time", "dataType": "geospatial"},
    {"id": "crisis_group", "name": "International Crisis Group", "category": "Conflict & Security",
     "description": "CrisisWatch monthly global conflict tracker and analysis",
     "url": "https://www.crisisgroup.org", "status": "registered", "freshness": "monthly", "dataType": "assessment"},
    {"id": "usgs_earthquakes", "name": "USGS Earthquake Hazards", "category": "Conflict & Security",
     "description": "Real-time seismic event monitoring — magnitude, location, and depth",
     "url": "https://earthquake.usgs.gov", "status": "live", "freshness": "real-time", "dataType": "events"},
    {"id": "gdacs", "name": "GDACS Disaster Alerts", "category": "Conflict & Security",
     "description": "Global Disaster Alerting Coordination System — multi-hazard alerts (earthquakes, floods, cyclones)",
     "url": "https://www.gdacs.org", "status": "live", "freshness": "real-time", "dataType": "alerts"},
    {"id": "iep_gpi", "name": "Global Peace Index", "category": "Conflict & Security",
     "description": "Institute for Economics & Peace — composite peace measurement for 163 countries",
     "url": "https://www.visionofhumanity.org/maps", "status": "registered", "freshness": "annual", "dataType": "index"},
    {"id": "un_peacekeeping", "name": "UN Peacekeeping Missions", "category": "Conflict & Security",
     "description": "Active UN peacekeeping operations, troop deployments, and mandate data",
     "url": "https://peacekeeping.un.org", "status": "registered", "freshness": "monthly", "dataType": "operations"},

    # ──────────────────────────────────────────────────────────────────────
    # 2. ECONOMIC & FINANCIAL  (12 sources)
    # ──────────────────────────────────────────────────────────────────────
    {"id": "world_bank", "name": "World Bank Development Indicators", "category": "Economic & Financial",
     "description": "GDP, inflation, unemployment, debt, FDI, military spending — 200+ countries",
     "url": "https://data.worldbank.org", "status": "active", "freshness": "quarterly", "dataType": "economic"},
    {"id": "imf_weo", "name": "IMF World Economic Outlook", "category": "Economic & Financial",
     "description": "Macroeconomic forecasts and country-level economic assessments",
     "url": "https://www.imf.org/en/Publications/WEO", "status": "registered", "freshness": "biannual", "dataType": "forecasts"},
    {"id": "frankfurter", "name": "Frankfurter Exchange Rates", "category": "Economic & Financial",
     "description": "ECB reference exchange rates — 30+ currency pairs updated daily",
     "url": "https://api.frankfurter.dev", "status": "live", "freshness": "daily", "dataType": "financial"},
    {"id": "bis_stats", "name": "BIS Statistics", "category": "Economic & Financial",
     "description": "Bank for International Settlements — cross-border banking, credit, and FX data",
     "url": "https://www.bis.org/statistics", "status": "registered", "freshness": "quarterly", "dataType": "financial"},
    {"id": "fred", "name": "Federal Reserve Economic Data", "category": "Economic & Financial",
     "description": "FRED — 800K+ economic time series from 100+ sources",
     "url": "https://fred.stlouisfed.org", "status": "registered", "freshness": "daily", "dataType": "economic"},
    {"id": "ecb_data", "name": "ECB Statistical Data Warehouse", "category": "Economic & Financial",
     "description": "European Central Bank monetary, financial, and balance of payments data",
     "url": "https://sdw.ecb.europa.eu", "status": "registered", "freshness": "daily", "dataType": "financial"},
    {"id": "oecd_stats", "name": "OECD Statistics", "category": "Economic & Financial",
     "description": "Comparative economic, social, and environmental data for 38 member countries",
     "url": "https://stats.oecd.org", "status": "registered", "freshness": "quarterly", "dataType": "economic"},
    {"id": "cboe_vix", "name": "CBOE Volatility Index (VIX)", "category": "Economic & Financial",
     "description": "Real-time market fear gauge — S&P 500 implied volatility",
     "url": "https://www.cboe.com/tradable_products/vix", "status": "registered", "freshness": "real-time", "dataType": "financial"},
    {"id": "sovereign_cds", "name": "Sovereign CDS Spreads", "category": "Economic & Financial",
     "description": "Credit default swap spreads for sovereign debt — market-implied default risk",
     "url": "https://www.worldgovernmentbonds.com", "status": "registered", "freshness": "daily", "dataType": "financial"},
    {"id": "swift_rma", "name": "SWIFT Transaction Data", "category": "Economic & Financial",
     "description": "Cross-border payment flow patterns and financial messaging volumes",
     "url": "https://www.swift.com/our-solutions/compliance-and-shared-services/business-intelligence", "status": "registered", "freshness": "monthly", "dataType": "financial"},
    {"id": "crypto_flows", "name": "Chainalysis Crypto Flows", "category": "Economic & Financial",
     "description": "Cross-border cryptocurrency transaction flows and sanctions evasion indicators",
     "url": "https://www.chainalysis.com", "status": "registered", "freshness": "daily", "dataType": "financial"},
    {"id": "trade_economics", "name": "Trading Economics", "category": "Economic & Financial",
     "description": "Economic indicators, forecasts, and market data for 196 countries",
     "url": "https://tradingeconomics.com", "status": "registered", "freshness": "daily", "dataType": "economic"},

    # ──────────────────────────────────────────────────────────────────────
    # 3. POLITICAL & GOVERNANCE  (10 sources)
    # ──────────────────────────────────────────────────────────────────────
    {"id": "vdem", "name": "V-Dem Democracy Index", "category": "Political & Governance",
     "description": "Varieties of Democracy — 500+ governance indicators for 202 countries since 1789",
     "url": "https://www.v-dem.net", "status": "registered", "freshness": "annual", "dataType": "index"},
    {"id": "freedom_house", "name": "Freedom House", "category": "Political & Governance",
     "description": "Freedom in the World and Freedom on the Net — political rights and civil liberties",
     "url": "https://freedomhouse.org", "status": "registered", "freshness": "annual", "dataType": "index"},
    {"id": "polity5", "name": "Polity5 Project", "category": "Political & Governance",
     "description": "Political regime characteristics and transitions for all independent states",
     "url": "https://www.systemicpeace.org/polityproject.html", "status": "registered", "freshness": "annual", "dataType": "index"},
    {"id": "wgi", "name": "World Governance Indicators", "category": "Political & Governance",
     "description": "World Bank governance metrics — rule of law, corruption, government effectiveness",
     "url": "https://info.worldbank.org/governance/wgi", "status": "registered", "freshness": "annual", "dataType": "index"},
    {"id": "cpi", "name": "Corruption Perceptions Index", "category": "Political & Governance",
     "description": "Transparency International — corruption perception scores for 180 countries",
     "url": "https://www.transparency.org/cpi", "status": "registered", "freshness": "annual", "dataType": "index"},
    {"id": "rsf_pressfreedom", "name": "RSF Press Freedom Index", "category": "Political & Governance",
     "description": "Reporters Without Borders — media freedom indicators for 180 countries",
     "url": "https://rsf.org/en/index", "status": "registered", "freshness": "annual", "dataType": "index"},
    {"id": "eiu_democracy", "name": "EIU Democracy Index", "category": "Political & Governance",
     "description": "Economist Intelligence Unit — democracy health across 5 dimensions",
     "url": "https://www.eiu.com/n/campaigns/democracy-index-2023", "status": "registered", "freshness": "annual", "dataType": "index"},
    {"id": "bti", "name": "Bertelsmann Transformation Index", "category": "Political & Governance",
     "description": "Political and economic transformation assessment for 137 developing countries",
     "url": "https://bti-project.org", "status": "registered", "freshness": "biennial", "dataType": "index"},
    {"id": "fragile_states", "name": "Fragile States Index", "category": "Political & Governance",
     "description": "Fund for Peace — 12-indicator composite measuring state fragility for 179 countries",
     "url": "https://fragilestatesindex.org", "status": "registered", "freshness": "annual", "dataType": "index"},
    {"id": "election_guide", "name": "IFES Election Guide", "category": "Political & Governance",
     "description": "International Foundation for Electoral Systems — global election calendar and results",
     "url": "https://www.electionguide.org", "status": "registered", "freshness": "daily", "dataType": "events"},

    # ──────────────────────────────────────────────────────────────────────
    # 4. TRADE & SUPPLY CHAIN  (8 sources)
    # ──────────────────────────────────────────────────────────────────────
    {"id": "un_comtrade", "name": "UN Comtrade", "category": "Trade & Supply Chain",
     "description": "International merchandise trade statistics — bilateral flows by commodity",
     "url": "https://comtrade.un.org", "status": "registered", "freshness": "monthly", "dataType": "trade"},
    {"id": "wto_stats", "name": "WTO Trade Statistics", "category": "Trade & Supply Chain",
     "description": "World Trade Organization — trade profiles, tariff data, and dispute tracker",
     "url": "https://stats.wto.org", "status": "registered", "freshness": "quarterly", "dataType": "trade"},
    {"id": "freightos_fbx", "name": "Freightos Baltic Index", "category": "Trade & Supply Chain",
     "description": "Real-time container shipping rates across 12 major trade lanes",
     "url": "https://fbx.freightos.com", "status": "registered", "freshness": "daily", "dataType": "financial"},
    {"id": "flexport_ocean", "name": "Flexport Ocean Timeliness", "category": "Trade & Supply Chain",
     "description": "Ocean freight transit time tracking and port congestion indicators",
     "url": "https://www.flexport.com/data/ocean-timeliness-indicator", "status": "registered", "freshness": "weekly", "dataType": "logistics"},
    {"id": "drewry_wci", "name": "Drewry World Container Index", "category": "Trade & Supply Chain",
     "description": "Weekly benchmark for container freight rates on 8 major routes",
     "url": "https://www.drewry.co.uk/supply-chain-advisors/world-container-index", "status": "registered", "freshness": "weekly", "dataType": "financial"},
    {"id": "supply_chain_dive", "name": "Supply Chain Dive", "category": "Trade & Supply Chain",
     "description": "Supply chain disruption alerts and industry news intelligence",
     "url": "https://www.supplychaindive.com", "status": "registered", "freshness": "daily", "dataType": "news"},
    {"id": "usitc", "name": "US International Trade Commission", "category": "Trade & Supply Chain",
     "description": "US trade data, tariff schedules, and trade remedy investigations",
     "url": "https://www.usitc.gov", "status": "registered", "freshness": "monthly", "dataType": "trade"},
    {"id": "cepii_baci", "name": "CEPII BACI Trade Database", "category": "Trade & Supply Chain",
     "description": "Reconciled bilateral trade data for 200+ countries at 6-digit HS level",
     "url": "http://www.cepii.fr/CEPII/en/bdd_modele/bdd_modele_item.asp?id=37", "status": "registered", "freshness": "annual", "dataType": "trade"},

    # ──────────────────────────────────────────────────────────────────────
    # 5. ENERGY & COMMODITIES  (9 sources)
    # ──────────────────────────────────────────────────────────────────────
    {"id": "eia", "name": "US Energy Information Administration", "category": "Energy & Commodities",
     "description": "Energy production, consumption, prices, and inventory data worldwide",
     "url": "https://www.eia.gov", "status": "registered", "freshness": "weekly", "dataType": "economic"},
    {"id": "iea", "name": "International Energy Agency", "category": "Energy & Commodities",
     "description": "Global energy outlook, oil market reports, and clean energy tracking",
     "url": "https://www.iea.org", "status": "registered", "freshness": "monthly", "dataType": "assessment"},
    {"id": "opec_momr", "name": "OPEC Monthly Oil Market Report", "category": "Energy & Commodities",
     "description": "Oil supply/demand forecasts, production quotas, and market analysis",
     "url": "https://www.opec.org/opec_web/en/publications/338.htm", "status": "registered", "freshness": "monthly", "dataType": "assessment"},
    {"id": "lme", "name": "London Metal Exchange", "category": "Energy & Commodities",
     "description": "Base metals pricing — copper, aluminum, nickel, zinc, tin, lead",
     "url": "https://www.lme.com", "status": "registered", "freshness": "real-time", "dataType": "financial"},
    {"id": "usgs_minerals", "name": "USGS Mineral Commodity Summaries", "category": "Energy & Commodities",
     "description": "Critical mineral production, reserves, and supply chain data for 90+ commodities",
     "url": "https://www.usgs.gov/centers/national-minerals-information-center", "status": "registered", "freshness": "annual", "dataType": "economic"},
    {"id": "rare_earth_tracker", "name": "Shanghai Metals Market Rare Earth", "category": "Energy & Commodities",
     "description": "Rare earth element pricing — neodymium, dysprosium, terbium, yttrium",
     "url": "https://www.metal.com/Rare-Earth", "status": "registered", "freshness": "daily", "dataType": "financial"},
    {"id": "platts", "name": "S&P Global Platts", "category": "Energy & Commodities",
     "description": "Energy, metals, and agriculture commodity price benchmarks",
     "url": "https://www.spglobal.com/commodityinsights", "status": "registered", "freshness": "daily", "dataType": "financial"},
    {"id": "ice_futures", "name": "ICE Futures", "category": "Energy & Commodities",
     "description": "Brent crude, natural gas, emissions, and soft commodity futures",
     "url": "https://www.ice.com/products/futures", "status": "registered", "freshness": "real-time", "dataType": "financial"},
    {"id": "cobalt_institute", "name": "Cobalt Institute", "category": "Energy & Commodities",
     "description": "Cobalt supply chain data — production, demand, and responsible sourcing",
     "url": "https://www.cobaltinstitute.org", "status": "registered", "freshness": "quarterly", "dataType": "economic"},

    # ──────────────────────────────────────────────────────────────────────
    # 6. MARITIME & SHIPPING  (7 sources)
    # ──────────────────────────────────────────────────────────────────────
    {"id": "ais_global", "name": "AIS Global Ship Tracking", "category": "Maritime & Shipping",
     "description": "Automatic Identification System — real-time vessel positions and maritime traffic",
     "url": "https://www.marinetraffic.com", "status": "registered", "freshness": "real-time", "dataType": "geospatial"},
    {"id": "imb_piracy", "name": "ICC IMB Piracy Reporting Centre", "category": "Maritime & Shipping",
     "description": "Maritime piracy and armed robbery incident reports worldwide",
     "url": "https://www.icc-ccs.org/piracy-reporting-centre", "status": "registered", "freshness": "weekly", "dataType": "events"},
    {"id": "suez_canal", "name": "Suez Canal Authority Traffic", "category": "Maritime & Shipping",
     "description": "Daily vessel transit counts, tonnage, and congestion data for Suez Canal",
     "url": "https://www.suezcanal.gov.eg", "status": "registered", "freshness": "daily", "dataType": "logistics"},
    {"id": "panama_canal", "name": "Panama Canal Authority", "category": "Maritime & Shipping",
     "description": "Transit bookings, draft restrictions, and water level monitoring",
     "url": "https://www.pancanal.com", "status": "registered", "freshness": "daily", "dataType": "logistics"},
    {"id": "lloyd_list", "name": "Lloyd's List Intelligence", "category": "Maritime & Shipping",
     "description": "Maritime risk analytics — sanctions screening, dark fleet tracking, port intelligence",
     "url": "https://www.lloydslist.com", "status": "registered", "freshness": "daily", "dataType": "intelligence"},
    {"id": "port_congestion", "name": "UNCTAD Port Congestion", "category": "Maritime & Shipping",
     "description": "United Nations port call and vessel turnaround time statistics",
     "url": "https://unctad.org/topic/transport-and-trade-logistics/port-call-and-performance-statistics", "status": "registered", "freshness": "quarterly", "dataType": "logistics"},
    {"id": "windward_maritime", "name": "Windward Maritime AI", "category": "Maritime & Shipping",
     "description": "AI-powered maritime risk — deceptive shipping, sanctions evasion, dark activity",
     "url": "https://www.windward.ai", "status": "registered", "freshness": "real-time", "dataType": "intelligence"},

    # ──────────────────────────────────────────────────────────────────────
    # 7. SANCTIONS & REGULATORY  (6 sources)
    # ──────────────────────────────────────────────────────────────────────
    {"id": "ofac_sdn", "name": "OFAC Specially Designated Nationals", "category": "Sanctions & Regulatory",
     "description": "US Treasury SDN list — sanctioned individuals, entities, and vessels",
     "url": "https://sanctionssearch.ofac.treas.gov", "status": "registered", "freshness": "daily", "dataType": "compliance"},
    {"id": "eu_sanctions", "name": "EU Consolidated Sanctions List", "category": "Sanctions & Regulatory",
     "description": "European Union restrictive measures — persons, entities, and countries",
     "url": "https://www.sanctionsmap.eu", "status": "registered", "freshness": "daily", "dataType": "compliance"},
    {"id": "un_sanctions", "name": "UN Security Council Sanctions", "category": "Sanctions & Regulatory",
     "description": "UNSC sanctions committees — arms embargoes, travel bans, asset freezes",
     "url": "https://www.un.org/securitycouncil/sanctions/information", "status": "registered", "freshness": "weekly", "dataType": "compliance"},
    {"id": "fatf", "name": "FATF High-Risk Jurisdictions", "category": "Sanctions & Regulatory",
     "description": "Financial Action Task Force — AML/CFT high-risk and monitored jurisdictions",
     "url": "https://www.fatf-gafi.org/en/countries/black-and-grey-lists.html", "status": "registered", "freshness": "triannual", "dataType": "compliance"},
    {"id": "bis_export", "name": "BIS Export Control List", "category": "Sanctions & Regulatory",
     "description": "Bureau of Industry and Security — dual-use technology export restrictions",
     "url": "https://www.bis.gov/regulations/export-administration-regulations-ear", "status": "registered", "freshness": "monthly", "dataType": "compliance"},
    {"id": "castellum_sanctions", "name": "Castellum.AI Sanctions", "category": "Sanctions & Regulatory",
     "description": "Global sanctions dataset — 35+ jurisdictions, 400K+ entries, daily updates",
     "url": "https://www.castellum.ai", "status": "registered", "freshness": "daily", "dataType": "compliance"},

    # ──────────────────────────────────────────────────────────────────────
    # 8. MEDIA & SENTIMENT  (9 sources)
    # ──────────────────────────────────────────────────────────────────────
    {"id": "newsapi", "name": "NewsAPI.ai", "category": "Media & Sentiment",
     "description": "Real-time headline ingestion — 80K+ sources, sentiment-ready",
     "url": "https://newsapi.org", "status": "active", "freshness": "real-time", "dataType": "news"},
    {"id": "finbert", "name": "FinBERT Sentiment Engine", "category": "Media & Sentiment",
     "description": "ProsusAI/finbert transformer — financial & geopolitical headline sentiment analysis",
     "url": "https://huggingface.co/ProsusAI/finbert", "status": "active", "freshness": "real-time", "dataType": "model"},
    {"id": "event_registry", "name": "Event Registry", "category": "Media & Sentiment",
     "description": "Real-time global event detection from 150K+ news sources in 40 languages",
     "url": "https://eventregistry.org", "status": "registered", "freshness": "real-time", "dataType": "events"},
    {"id": "mediacloud", "name": "Media Cloud", "category": "Media & Sentiment",
     "description": "Open-source media analysis — attention, framing, and narrative tracking",
     "url": "https://mediacloud.org", "status": "registered", "freshness": "daily", "dataType": "analysis"},
    {"id": "gdelt_tv", "name": "GDELT Television Explorer", "category": "Media & Sentiment",
     "description": "TV news monitoring — sentiment and topic trends across global broadcasts",
     "url": "https://television.gdeltproject.org", "status": "registered", "freshness": "15min", "dataType": "media"},
    {"id": "factiva", "name": "Dow Jones Factiva", "category": "Media & Sentiment",
     "description": "Premium news database — 33K+ sources, company and risk intelligence",
     "url": "https://www.dowjones.com/professional/factiva", "status": "registered", "freshness": "real-time", "dataType": "news"},
    {"id": "brandwatch", "name": "Brandwatch Social Listening", "category": "Media & Sentiment",
     "description": "Social media monitoring — geopolitical discourse tracking on X, Reddit, Telegram",
     "url": "https://www.brandwatch.com", "status": "registered", "freshness": "real-time", "dataType": "social"},
    {"id": "meltwater", "name": "Meltwater Media Intelligence", "category": "Media & Sentiment",
     "description": "Media monitoring and social listening across 300K+ online news sources",
     "url": "https://www.meltwater.com", "status": "registered", "freshness": "real-time", "dataType": "news"},
    {"id": "bellingcat", "name": "Bellingcat OSINT", "category": "Media & Sentiment",
     "description": "Open-source investigative journalism — conflict documentation and verification",
     "url": "https://www.bellingcat.com", "status": "registered", "freshness": "weekly", "dataType": "intelligence"},

    # ──────────────────────────────────────────────────────────────────────
    # 9. ENVIRONMENTAL & CLIMATE  (10 sources)
    # ──────────────────────────────────────────────────────────────────────
    {"id": "nasa_eonet", "name": "NASA EONET", "category": "Environmental & Climate",
     "description": "Earth Observatory Natural Event Tracker — wildfires, volcanic eruptions, severe storms",
     "url": "https://eonet.gsfc.nasa.gov", "status": "live", "freshness": "real-time", "dataType": "events"},
    {"id": "noaa_severe", "name": "NOAA Severe Weather", "category": "Environmental & Climate",
     "description": "National Oceanic and Atmospheric Administration — tropical cyclones, storm warnings",
     "url": "https://www.weather.gov/forecastmaps", "status": "registered", "freshness": "hourly", "dataType": "alerts"},
    {"id": "emdat", "name": "EM-DAT International Disaster Database", "category": "Environmental & Climate",
     "description": "Centre for Research on Epidemiology of Disasters — 22K+ events since 1900",
     "url": "https://www.emdat.be", "status": "registered", "freshness": "monthly", "dataType": "historical"},
    {"id": "copernicus_ems", "name": "Copernicus Emergency Management", "category": "Environmental & Climate",
     "description": "EU satellite-based disaster response — flood, fire, and earthquake mapping",
     "url": "https://emergency.copernicus.eu", "status": "registered", "freshness": "daily", "dataType": "geospatial"},
    {"id": "fao_giews", "name": "FAO GIEWS Food Price Monitor", "category": "Environmental & Climate",
     "description": "Food and Agriculture Organization — global food price alerts and crop conditions",
     "url": "https://www.fao.org/giews", "status": "registered", "freshness": "monthly", "dataType": "economic"},
    {"id": "fews_net", "name": "FEWS NET Famine Early Warning", "category": "Environmental & Climate",
     "description": "Famine Early Warning Systems Network — food security outlook for 28 countries",
     "url": "https://fews.net", "status": "registered", "freshness": "monthly", "dataType": "assessment"},
    {"id": "firms_fire", "name": "NASA FIRMS Active Fire Data", "category": "Environmental & Climate",
     "description": "Near real-time satellite fire detection — MODIS and VIIRS sensors",
     "url": "https://firms.modaps.eosdis.nasa.gov", "status": "registered", "freshness": "3-hour", "dataType": "geospatial"},
    {"id": "global_flood", "name": "Global Flood Monitoring System", "category": "Environmental & Climate",
     "description": "University of Maryland satellite-based flood detection and river monitoring",
     "url": "https://flood.umd.edu", "status": "registered", "freshness": "daily", "dataType": "geospatial"},
    {"id": "climate_trace", "name": "Climate TRACE Emissions", "category": "Environmental & Climate",
     "description": "Global greenhouse gas emissions tracking by facility and sector",
     "url": "https://climatetrace.org", "status": "registered", "freshness": "annual", "dataType": "environmental"},
    {"id": "water_stress", "name": "WRI Aqueduct Water Risk Atlas", "category": "Environmental & Climate",
     "description": "World Resources Institute water stress, flood risk, and drought severity data",
     "url": "https://www.wri.org/aqueduct", "status": "registered", "freshness": "annual", "dataType": "index"},

    # ──────────────────────────────────────────────────────────────────────
    # 10. DEMOGRAPHICS & HUMANITARIAN  (9 sources)
    # ──────────────────────────────────────────────────────────────────────
    {"id": "reliefweb", "name": "ReliefWeb", "category": "Demographics & Humanitarian",
     "description": "UN OCHA humanitarian information service — crisis reports, situation updates",
     "url": "https://reliefweb.int", "status": "live", "freshness": "daily", "dataType": "reports"},
    {"id": "unhcr", "name": "UNHCR Refugee Statistics", "category": "Demographics & Humanitarian",
     "description": "Global refugee populations, asylum applications, and displacement data",
     "url": "https://www.unhcr.org/refugee-statistics", "status": "registered", "freshness": "monthly", "dataType": "demographics"},
    {"id": "iom_dtm", "name": "IOM Displacement Tracking Matrix", "category": "Demographics & Humanitarian",
     "description": "International Organization for Migration — population movement and displacement",
     "url": "https://dtm.iom.int", "status": "registered", "freshness": "weekly", "dataType": "demographics"},
    {"id": "who_outbreaks", "name": "WHO Disease Outbreak News", "category": "Demographics & Humanitarian",
     "description": "World Health Organization — infectious disease alerts and pandemic tracking",
     "url": "https://www.who.int/emergencies/disease-outbreak-news", "status": "registered", "freshness": "daily", "dataType": "health"},
    {"id": "unocha_fts", "name": "OCHA Financial Tracking Service", "category": "Demographics & Humanitarian",
     "description": "International humanitarian funding flows — pledges, commitments, contributions",
     "url": "https://fts.unocha.org", "status": "registered", "freshness": "daily", "dataType": "financial"},
    {"id": "inform_risk", "name": "INFORM Risk Index", "category": "Demographics & Humanitarian",
     "description": "Inter-Agency Standing Committee — humanitarian crisis and disaster risk index",
     "url": "https://drmkc.jrc.ec.europa.eu/inform-index", "status": "registered", "freshness": "annual", "dataType": "index"},
    {"id": "un_pop", "name": "UN Population Division", "category": "Demographics & Humanitarian",
     "description": "World population prospects — demographic projections through 2100",
     "url": "https://population.un.org", "status": "registered", "freshness": "biennial", "dataType": "demographics"},
    {"id": "wfp_hunger", "name": "WFP HungerMap LIVE", "category": "Demographics & Humanitarian",
     "description": "World Food Programme — real-time food insecurity monitoring for 90+ countries",
     "url": "https://hungermap.wfp.org", "status": "registered", "freshness": "daily", "dataType": "assessment"},
    {"id": "idmc_displacement", "name": "IDMC Internal Displacement Monitor", "category": "Demographics & Humanitarian",
     "description": "Internal Displacement Monitoring Centre — conflict and disaster displacement data",
     "url": "https://www.internal-displacement.org", "status": "registered", "freshness": "annual", "dataType": "demographics"},

    # ──────────────────────────────────────────────────────────────────────
    # 11. CYBER & TECHNOLOGY  (7 sources)
    # ──────────────────────────────────────────────────────────────────────
    {"id": "ooni", "name": "OONI Internet Censorship", "category": "Cyber & Technology",
     "description": "Open Observatory of Network Interference — internet censorship measurements worldwide",
     "url": "https://ooni.org", "status": "live", "freshness": "daily", "dataType": "measurements"},
    {"id": "cisa_kev", "name": "CISA Known Exploited Vulnerabilities", "category": "Cyber & Technology",
     "description": "Cybersecurity & Infrastructure Security Agency — actively exploited vulnerability catalog",
     "url": "https://www.cisa.gov/known-exploited-vulnerabilities-catalog", "status": "registered", "freshness": "daily", "dataType": "security"},
    {"id": "mandiant_threat", "name": "Mandiant Threat Intelligence", "category": "Cyber & Technology",
     "description": "Advanced threat group tracking — nation-state APTs and cybercrime operations",
     "url": "https://www.mandiant.com/advantage/threat-intelligence", "status": "registered", "freshness": "daily", "dataType": "intelligence"},
    {"id": "netblocks", "name": "NetBlocks Internet Governance", "category": "Cyber & Technology",
     "description": "Real-time internet shutdown monitoring and connectivity disruption alerts",
     "url": "https://netblocks.org", "status": "registered", "freshness": "real-time", "dataType": "events"},
    {"id": "shodan", "name": "Shodan Internet Census", "category": "Cyber & Technology",
     "description": "Internet-connected device search engine — critical infrastructure exposure",
     "url": "https://www.shodan.io", "status": "registered", "freshness": "daily", "dataType": "security"},
    {"id": "isc_sans", "name": "SANS Internet Storm Center", "category": "Cyber & Technology",
     "description": "DShield sensor network — global cyber threat level monitoring",
     "url": "https://isc.sans.edu", "status": "registered", "freshness": "hourly", "dataType": "security"},
    {"id": "nist_nvd", "name": "NIST National Vulnerability Database", "category": "Cyber & Technology",
     "description": "Comprehensive vulnerability database with CVSS scoring and CPE matching",
     "url": "https://nvd.nist.gov", "status": "registered", "freshness": "daily", "dataType": "security"},

    # ──────────────────────────────────────────────────────────────────────
    # 12. DIPLOMATIC & INTERNATIONAL  (6 sources)
    # ──────────────────────────────────────────────────────────────────────
    {"id": "un_votes", "name": "UN General Assembly Voting", "category": "Diplomatic & International",
     "description": "UNGA roll-call votes — alliance patterns, diplomatic alignment tracking",
     "url": "https://digitallibrary.un.org/search?cc=Voting+Data", "status": "registered", "freshness": "session", "dataType": "diplomatic"},
    {"id": "un_security_council", "name": "UN Security Council Resolutions", "category": "Diplomatic & International",
     "description": "UNSC resolutions, vetoes, and presidential statements",
     "url": "https://www.un.org/securitycouncil/content/resolutions-0", "status": "registered", "freshness": "weekly", "dataType": "diplomatic"},
    {"id": "igos", "name": "Correlates of War IGO Data", "category": "Diplomatic & International",
     "description": "Intergovernmental organization membership — alliance networks and institutional ties",
     "url": "https://correlatesofwar.org/data-sets/IGOs", "status": "registered", "freshness": "annual", "dataType": "diplomatic"},
    {"id": "atop", "name": "Alliance Treaty Obligations (ATOP)", "category": "Diplomatic & International",
     "description": "Military alliance commitments — defense pacts, neutrality, and non-aggression",
     "url": "https://atop.rice.edu", "status": "registered", "freshness": "annual", "dataType": "diplomatic"},
    {"id": "icj", "name": "International Court of Justice Cases", "category": "Diplomatic & International",
     "description": "ICJ contentious cases and advisory opinions — state disputes under international law",
     "url": "https://www.icj-cij.org/cases", "status": "registered", "freshness": "monthly", "dataType": "legal"},
    {"id": "diplo_atlas", "name": "Lowy Institute Global Diplomacy Index", "category": "Diplomatic & International",
     "description": "Diplomatic network size — embassies, consulates, and permanent missions by country",
     "url": "https://globaldiplomacyindex.lowyinstitute.org", "status": "registered", "freshness": "annual", "dataType": "diplomatic"},
]


# ── Helper functions ─────────────────────────────────────────────────────

CATEGORIES = [
    "Conflict & Security",
    "Economic & Financial",
    "Political & Governance",
    "Trade & Supply Chain",
    "Energy & Commodities",
    "Maritime & Shipping",
    "Sanctions & Regulatory",
    "Media & Sentiment",
    "Environmental & Climate",
    "Demographics & Humanitarian",
    "Cyber & Technology",
    "Diplomatic & International",
]


def get_sources_by_category() -> dict[str, list[dict]]:
    """Return sources grouped by category."""
    by_cat: dict[str, list[dict]] = {cat: [] for cat in CATEGORIES}
    for s in DATA_SOURCES:
        by_cat.setdefault(s["category"], []).append(s)
    return by_cat


def get_source_count() -> int:
    """Total number of registered data sources."""
    return len(DATA_SOURCES)


def get_category_summary() -> list[dict]:
    """Return category name, count, and status breakdown."""
    by_cat = get_sources_by_category()
    summary = []
    for cat in CATEGORIES:
        sources = by_cat.get(cat, [])
        summary.append({
            "category": cat,
            "total": len(sources),
            "active": sum(1 for s in sources if s["status"] == "active"),
            "live": sum(1 for s in sources if s["status"] == "live"),
            "registered": sum(1 for s in sources if s["status"] == "registered"),
        })
    return summary


def get_active_sources() -> list[dict]:
    """Sources feeding the ML pipeline."""
    return [s for s in DATA_SOURCES if s["status"] == "active"]


def get_live_sources() -> list[dict]:
    """Sources with live API integrations."""
    return [s for s in DATA_SOURCES if s["status"] == "live"]


def get_status_counts() -> dict[str, int]:
    """Return counts by status: active, live, registered, total."""
    counts = {"active": 0, "live": 0, "registered": 0}
    for s in DATA_SOURCES:
        counts[s["status"]] = counts.get(s["status"], 0) + 1
    return {**counts, "total": len(DATA_SOURCES), "categories": len(CATEGORIES)}
