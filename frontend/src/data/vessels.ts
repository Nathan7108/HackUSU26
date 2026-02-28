import type { Vessel } from "@/types"

export const VESSELS: Vessel[] = [
  // ── r1: Baotou → Hsinchu (Taiwan Strait) — rare earth ──────
  // ── r1: Baotou → Hsinchu (Taiwan Strait) — rare earth
  // v1a near Taiwan Strait (conflict zone!), v1b just departed
  {
    id: "v1a", name: "MV Cascade Pioneer", type: "bulk-carrier", routeId: "r1",
    cargo: "Rare Earth Oxides (Yttrium, Dysprosium)", cargoValue: 85, insurancePremium: 4.2,
    departurePort: "Baotou", arrivalPort: "Hsinchu", progressOffset: 0.72, speed: 1.0,
  },
  {
    id: "v1b", name: "MV Pacific Ore", type: "bulk-carrier", routeId: "r1",
    cargo: "Neodymium Concentrate", cargoValue: 62, insurancePremium: 3.1,
    departurePort: "Baotou", arrivalPort: "Hsinchu", progressOffset: 0.25, speed: 1.0,
  },

  // ── r2: Hsinchu → Nagoya (East China Sea) — chips
  {
    id: "v2a", name: "MV Silicon Express", type: "container", routeId: "r2",
    cargo: "Advanced Chip Packages (3nm)", cargoValue: 145, insurancePremium: 7.2,
    departurePort: "Hsinchu", arrivalPort: "Nagoya", progressOffset: 0.35, speed: 1.0,
  },
  {
    id: "v2b", name: "MV Formosa Bridge", type: "container", routeId: "r2",
    cargo: "Semiconductor Wafers", cargoValue: 118, insurancePremium: 5.9,
    departurePort: "Hsinchu", arrivalPort: "Nagoya", progressOffset: 0.78, speed: 1.0,
  },

  // ── r3: Nagoya → Singapore (South China Sea) — avionics
  // v3a in South China Sea conflict zone, v3b past it
  {
    id: "v3a", name: "MV Sakura Maru", type: "ro-ro", routeId: "r3",
    cargo: "Avionics Subsystems", cargoValue: 72, insurancePremium: 3.6,
    departurePort: "Nagoya", arrivalPort: "Singapore", progressOffset: 0.45, speed: 1.0,
  },
  {
    id: "v3b", name: "MV Orient Venture", type: "general-cargo", routeId: "r3",
    cargo: "Inertial Navigation Units", cargoValue: 48, insurancePremium: 2.4,
    departurePort: "Nagoya", arrivalPort: "Singapore", progressOffset: 0.82, speed: 1.0,
  },

  // ── r4: Singapore → Rotterdam (highest value, 3 chokepoints)
  // v4a near Malacca, v4b in Indian Ocean (cleared Malacca), v4c near Suez
  {
    id: "v4a", name: "MV Sentinel Vanguard", type: "container", routeId: "r4",
    cargo: "Integrated Avionics Modules", cargoValue: 210, insurancePremium: 12.6,
    departurePort: "Singapore", arrivalPort: "Rotterdam", progressOffset: 0.08, speed: 1.0,
  },
  {
    id: "v4b", name: "MV Strait Runner", type: "container", routeId: "r4",
    cargo: "Precision Gyroscopes", cargoValue: 165, insurancePremium: 9.9,
    departurePort: "Singapore", arrivalPort: "Rotterdam", progressOffset: 0.35, speed: 1.0,
  },
  {
    id: "v4c", name: "MV Meridian Star", type: "general-cargo", routeId: "r4",
    cargo: "Electronic Warfare Components", cargoValue: 92, insurancePremium: 5.5,
    departurePort: "Singapore", arrivalPort: "Rotterdam", progressOffset: 0.72, speed: 1.0,
  },

  // ── r5: Rotterdam → Toulouse (European inland) — composites
  {
    id: "v5a", name: "MV Rhine Carrier", type: "general-cargo", routeId: "r5",
    cargo: "Carbon Fiber Composites", cargoValue: 78, insurancePremium: 1.6,
    departurePort: "Rotterdam", arrivalPort: "Toulouse", progressOffset: 0.45, speed: 1.0,
  },

  // ── r6: Rotterdam → Portland (Transatlantic) — forgings
  {
    id: "v6a", name: "MV Atlantic Resolve", type: "bulk-carrier", routeId: "r6",
    cargo: "Titanium Forgings", cargoValue: 135, insurancePremium: 4.1,
    departurePort: "Rotterdam", arrivalPort: "Portland", progressOffset: 0.3, speed: 1.0,
  },
  {
    id: "v6b", name: "MV North Sea Trader", type: "bulk-carrier", routeId: "r6",
    cargo: "Nickel Superalloy Billets", cargoValue: 98, insurancePremium: 2.9,
    departurePort: "Rotterdam", arrivalPort: "Portland", progressOffset: 0.7, speed: 1.0,
  },

  // ── r7: Vicenza → Toulouse (European inland) — titanium
  {
    id: "v7a", name: "MV Adriatic Swift", type: "general-cargo", routeId: "r7",
    cargo: "Titanium Turbine Blades", cargoValue: 85, insurancePremium: 1.7,
    departurePort: "Vicenza", arrivalPort: "Toulouse", progressOffset: 0.55, speed: 1.0,
  },

  // ── r8: Baotou → Portland (trans-Pacific) — rare earth
  // Spread across Pacific Ocean
  {
    id: "v8a", name: "MV Great Wall", type: "bulk-carrier", routeId: "r8",
    cargo: "Rare Earth Metals (Mixed)", cargoValue: 95, insurancePremium: 5.7,
    departurePort: "Baotou", arrivalPort: "Portland", progressOffset: 0.2, speed: 1.0,
  },
  {
    id: "v8b", name: "MV Pacific Horizon", type: "tanker", routeId: "r8",
    cargo: "Gallium & Germanium Ingots", cargoValue: 78, insurancePremium: 4.7,
    departurePort: "Baotou", arrivalPort: "Portland", progressOffset: 0.5, speed: 1.0,
  },
  {
    id: "v8c", name: "MV Transpacific Eagle", type: "bulk-carrier", routeId: "r8",
    cargo: "Scandium Oxide Powder", cargoValue: 52, insurancePremium: 3.1,
    departurePort: "Baotou", arrivalPort: "Portland", progressOffset: 0.82, speed: 1.0,
  },

  // ── r9: Toulouse → Portland (Transatlantic) — aerospace
  {
    id: "v9a", name: "MV Airbus Relay", type: "ro-ro", routeId: "r9",
    cargo: "A350 Wing Assemblies", cargoValue: 160, insurancePremium: 8.0,
    departurePort: "Toulouse", arrivalPort: "Portland", progressOffset: 0.35, speed: 1.0,
  },
  {
    id: "v9b", name: "MV Europa Transporter", type: "ro-ro", routeId: "r9",
    cargo: "Landing Gear Assemblies", cargoValue: 112, insurancePremium: 5.6,
    departurePort: "Toulouse", arrivalPort: "Portland", progressOffset: 0.68, speed: 1.0,
  },

  // ── r10: Singapore → Cape of Good Hope → Rotterdam (rerouted) ────
  {
    id: "v10a", name: "MV Cape Sentinel", type: "container", routeId: "r10",
    cargo: "Rerouted Avionics Modules", cargoValue: 180, insurancePremium: 5.4,
    departurePort: "Singapore", arrivalPort: "Rotterdam", progressOffset: 0.15, speed: 1.0,
  },
  {
    id: "v10b", name: "MV Southern Cross", type: "bulk-carrier", routeId: "r10",
    cargo: "Titanium Alloy Ingots", cargoValue: 95, insurancePremium: 2.9,
    departurePort: "Singapore", arrivalPort: "Rotterdam", progressOffset: 0.52, speed: 1.0,
  },
  {
    id: "v10c", name: "MV Good Hope Express", type: "container", routeId: "r10",
    cargo: "Electronic Warfare Subsystems", cargoValue: 105, insurancePremium: 3.2,
    departurePort: "Singapore", arrivalPort: "Rotterdam", progressOffset: 0.78, speed: 1.0,
  },
]
