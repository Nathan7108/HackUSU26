export const companyProfile = {
  name: "Cascade Precision Industries",
  ticker: "CSPI",
  ceo: "Margaret Chen",
  founded: 2003,
  hq: "Portland, Oregon",
  sector: "Precision aerospace components — castings, composites, avionics housings",
  revenue: "$3.8B",
  employees: "~14,000 across 6 countries",
  customers: ["Boeing", "Airbus", "Lockheed Martin", "Raytheon"] as const,
  description:
    "Cascade Precision Industries is a Tier 2 aerospace manufacturer specializing in titanium castings, carbon fiber composites, and avionics chip packaging. They supply critical components to the world's largest defense and commercial aviation primes across 8 facilities in 6 countries.",

  supplyChainExposure: {
    total: "$2.4B",
    percentOfRevenue: 63,
    chokepoints: 4,
    summary:
      "63% of revenue ($2.4B) flows through 4 geopolitical chokepoints: Taiwan Strait, South China Sea, Red Sea/Suez Canal, and Russian titanium supply chain.",
  },

  historicalLosses: [
    {
      event: "Russia Sanctions — Titanium Supply Cut",
      year: 2022,
      amount: "$47M",
      description:
        "Russia supplied 60% of aerospace-grade titanium pre-invasion. Sanctions forced emergency requalification of alternative suppliers. Production delays hit Boeing 787 and Airbus A350 programs.",
    },
    {
      event: "Red Sea / Houthi Shipping Disruption",
      year: 2024,
      amount: "$23M",
      description:
        "Houthi attacks forced rerouting of 80% of Asia-Europe shipments around Cape of Good Hope. Added 10-14 days transit time and $15-20B/yr to global shipping costs. Cascade's EU distribution hub in Rotterdam saw 3-week delivery gaps.",
    },
  ],

  keyRisks: [
    {
      hotspot: "Taiwan",
      exposure: "$680M",
      basis:
        "Hsinchu chip packaging facility sits 100 miles from the Taiwan Strait. 90% of advanced semiconductor packaging runs through Taiwan. PLA exercises and rising cross-strait tension threaten production continuity.",
    },
    {
      hotspot: "China",
      exposure: "$420M",
      basis:
        "Baotou rare earth processing facility handles yttrium and scandium coatings feedstock. China controls 70%+ of global rare earth processing. Export license restrictions can halt production within weeks.",
    },
    {
      hotspot: "Red Sea / Suez Canal",
      exposure: "$1.1B",
      basis:
        "Primary shipping corridor for Asia-Europe trade routes. Houthi attacks added $15-20B/yr to global rerouting costs. Affects supply chain between Toulouse, Rotterdam, and Asian facilities.",
    },
    {
      hotspot: "Russia",
      exposure: "$190M",
      basis:
        "Russia was 60% of aerospace titanium pre-2022. Still qualifying alternative sources from Kazakhstan and Japan. Residual exposure through indirect titanium supply chains.",
    },
  ],

  recommendations: [
    {
      category: "Supply Chain Diversification",
      actions: [
        "Dual-source qualification with Samsung Foundry (South Korea) to reduce Taiwan semiconductor dependency — $12M to qualify, protects $680M exposure (56:1 ROI)",
        "Accelerate rare earth sourcing from Lynas (Australia) and MP Materials (USA) to reduce China dependency — stockpile 6 months of yttrium/scandium supply",
        "Complete titanium requalification from VSMPO alternatives in Kazakhstan and Japan — currently 18 months into 24-month program",
      ],
    },
    {
      category: "Real-Time Risk Monitoring",
      actions: [
        "Deploy Sentinel AI platform for continuous 15-minute monitoring of all 4 chokepoints — instant alerts on score threshold breaches",
        "Integrate vessel tracking with AIS data for real-time shipment rerouting decisions — 19 active vessels monitored",
        "Automate scenario modeling for cascade failure analysis across interconnected supply chain nodes",
      ],
    },
    {
      category: "Logistics & Technology",
      actions: [
        "Establish secondary routing via Cape of Good Hope for all Asia-Europe shipments with pre-negotiated carrier contracts",
        "Build 90-day strategic buffer inventory for critical titanium and rare earth inputs at Portland HQ",
        "Deploy predictive ETA models using LSTM forecasting to anticipate and pre-position against disruptions",
      ],
    },
    {
      category: "Strategic Partnerships",
      actions: [
        "Negotiate capacity reservation agreements with 2-3 alternative shipping carriers for Red Sea / Suez corridor",
        "Formalize mutual aid agreements with peer Tier 2 suppliers for emergency material sharing during supply shocks",
        "Establish direct relationships with mining sources to bypass Chinese processing bottleneck for rare earths",
      ],
    },
  ],
} as const
