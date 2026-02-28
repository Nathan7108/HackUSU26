/**
 * ISO 3166-1 alpha-2 ↔ alpha-3 mapping for countries in the Sentinel pipeline.
 * Backend uses 2-letter codes; frontend uses 3-letter codes.
 */

const alpha2to3: Record<string, string> = {
  AF: "AFG", AL: "ALB", DZ: "DZA", AO: "AGO", AR: "ARG", AM: "ARM", AU: "AUS",
  AZ: "AZE", BD: "BGD", BY: "BLR", BE: "BEL", BJ: "BEN", BO: "BOL", BA: "BIH",
  BR: "BRA", BG: "BGR", BF: "BFA", BI: "BDI", KH: "KHM", CM: "CMR", CA: "CAN",
  CF: "CAF", TD: "TCD", CL: "CHL", CN: "CHN", CO: "COL", CD: "COD", CG: "COG",
  CR: "CRI", CI: "CIV", HR: "HRV", CU: "CUB", CY: "CYP", CZ: "CZE", DK: "DNK",
  DJ: "DJI", DO: "DOM", EC: "ECU", EG: "EGY", SV: "SLV", GQ: "GNQ", ER: "ERI",
  EE: "EST", SZ: "SWZ", ET: "ETH", FI: "FIN", FR: "FRA", GA: "GAB", GM: "GMB",
  GE: "GEO", DE: "DEU", GH: "GHA", GR: "GRC", GT: "GTM", GN: "GIN", GW: "GNB",
  GY: "GUY", HT: "HTI", HN: "HND", HU: "HUN", IN: "IND", ID: "IDN", IR: "IRN",
  IQ: "IRQ", IE: "IRL", IL: "ISR", IT: "ITA", JM: "JAM", JP: "JPN", JO: "JOR",
  KZ: "KAZ", KE: "KEN", KP: "PRK", KR: "KOR", KW: "KWT", KG: "KGZ", LA: "LAO",
  LV: "LVA", LB: "LBN", LR: "LBR", LY: "LBY", LT: "LTU", MG: "MDG", MW: "MWI",
  MY: "MYS", ML: "MLI", MR: "MRT", MX: "MEX", MD: "MDA", MN: "MNG", ME: "MNE",
  MA: "MAR", MZ: "MOZ", MM: "MMR", NA: "NAM", NP: "NPL", NL: "NLD", NZ: "NZL",
  NI: "NIC", NE: "NER", NG: "NGA", NO: "NOR", OM: "OMN", PK: "PAK", PA: "PAN",
  PG: "PNG", PY: "PRY", PE: "PER", PH: "PHL", PL: "POL", PT: "PRT", QA: "QAT",
  RO: "ROU", RU: "RUS", RW: "RWA", SA: "SAU", SN: "SEN", RS: "SRB", SL: "SLE",
  SG: "SGP", SK: "SVK", SI: "SVN", SO: "SOM", ZA: "ZAF", SS: "SSD", ES: "ESP",
  LK: "LKA", SD: "SDN", SE: "SWE", CH: "CHE", SY: "SYR", TW: "TWN", TJ: "TJK",
  TZ: "TZA", TH: "THA", TL: "TLS", TG: "TGO", TT: "TTO", TN: "TUN", TR: "TUR",
  TM: "TKM", UG: "UGA", UA: "UKR", AE: "ARE", GB: "GBR", US: "USA", UY: "URY",
  UZ: "UZB", VE: "VEN", VN: "VNM", YE: "YEM", ZM: "ZMB", ZW: "ZWE",
}

const alpha3to2: Record<string, string> = Object.fromEntries(
  Object.entries(alpha2to3).map(([k, v]) => [v, k]),
)

export function toAlpha3(code2: string): string {
  return alpha2to3[code2.toUpperCase()] ?? code2
}

export function toAlpha2(code3: string): string {
  return alpha3to2[code3.toUpperCase()] ?? code3
}
