import type {
  AreaPriceFeedResponse,
  CropSpec,
  FarmXrayData,
  ParcelZone,
  RegionalCropPriceQuote,
} from "@/types/ackeriq";

export const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function buildStuttgartParcels(
  lat: number,
  lon: number,
  slopePct: number
): ParcelZone[] {
  const dLat = 0.0046;
  const dLon = 0.0068;

  return [
    {
      id: "parcel-1",
      name: "North Loess Plot",
      sharePct: 30,
      zoneType: "high_retention",
      polygon: [
        [lat + dLat * 0.14, lon - dLon * 1.02],
        [lat + dLat * 1.05, lon - dLon * 0.9],
        [lat + dLat * 0.98, lon - dLon * 0.04],
        [lat + dLat * 0.1, lon - dLon * 0.08],
      ],
      note: "Deep Filder/Neckar silt-loam; holds summer moisture well",
    },
    {
      id: "parcel-2",
      name: "East Slope Plot",
      sharePct: 25,
      zoneType: slopePct >= 3.0 ? "sloped_erosion" : "high_retention",
      polygon: [
        [lat + dLat * 0.1, lon - dLon * 0.01],
        [lat + dLat * 0.96, lon + dLon * 0.03],
        [lat + dLat * 0.85, lon + dLon * 0.95],
        [lat + dLat * 0.04, lon + dLon * 0.84],
      ],
      note:
        slopePct >= 3.0
          ? `${slopePct.toFixed(1)}% slope — spring rain washes away bare soil & N`
          : "Gentle slope; normal spring drainage",
    },
    {
      id: "parcel-3",
      name: "Center Main Block",
      sharePct: 25,
      zoneType: "high_retention",
      polygon: [
        [lat - dLat * 0.86, lon - dLon * 0.98],
        [lat + dLat * 0.07, lon - dLon * 1.01],
        [lat + dLat * 0.04, lon - dLon * 0.07],
        [lat - dLat * 0.9, lon - dLon * 0.11],
      ],
      note: "Main arable cash-crop block; highest yearly Nitrogen demand",
    },
    {
      id: "parcel-4",
      name: "South Keuper Ridge",
      sharePct: 20,
      zoneType: "drought_prone",
      polygon: [
        [lat - dLat * 0.9, lon - dLon * 0.03],
        [lat + dLat * 0.01, lon - dLon * 0.01],
        [lat - dLat * 0.03, lon + dLon * 0.85],
        [lat - dLat * 0.94, lon + dLon * 0.76],
      ],
      note: "Shallower ridge; dries fastest during July heatwaves",
    },
  ];
}

export const CROPS_STUTTGART: Record<string, CropSpec> = {
  winter_wheat: {
    id: "winter_wheat",
    name: "Winter Wheat",
    germanSub: "Winterweizen (Brotweizen)",
    imageUrl: "/images/crop-wheat.jpg",
    family: "cereal",
    isLegume: false,
    selectableAsBaseline: true,
    bwRecommended: false,
    bwRecommendationTag: "Standard BW Cereal",
    nDemandKgHa: 190,
    nFixedCreditKgHa: 0,
    waterNeedMm: 460,
    heatToleranceScore: 6,
    droughtToleranceScore: 6,
    erosionShieldScore: 7,
    baseYieldTonsHa: 8.3,
    pricePerTonEur: 240,
    seedAndOpsCostEurHa: 640,
    localBuyers: "Port of Stuttgart (Hedelfingen), BayWa Plieningen, Rettenmeier Mühle",
    growingWindow: "Oct – Jul",
    plainRole:
      "Standard bread-wheat crop; needs heavy Nitrogen unless planted after a legume.",
  },
  swabian_spelt: {
    id: "swabian_spelt",
    name: "Swabian Spelt (BW Specialty)",
    germanSub: "Schwäbischer Dinkel",
    imageUrl: "/images/crop-spelt.jpg",
    family: "cereal",
    isLegume: false,
    selectableAsBaseline: true,
    bwRecommended: true,
    bwRecommendationTag: "LTZ BW Recommended · Swabian Heritage",
    nDemandKgHa: 115,
    nFixedCreditKgHa: 0,
    waterNeedMm: 400,
    heatToleranceScore: 8,
    droughtToleranceScore: 8,
    erosionShieldScore: 8,
    baseYieldTonsHa: 6.7,
    pricePerTonEur: 302,
    seedAndOpsCostEurHa: 560,
    localBuyers: "Schwabenkorn, SchapfenMühle Ulm/Stuttgart, Regional Bakeries",
    growingWindow: "Oct – Jul",
    plainRole:
      "Signature Stuttgart & Swabian grain: needs 40% less Nitrogen than Wheat and earns strong regional mill premiums.",
  },
  malting_barley: {
    id: "malting_barley",
    name: "Spring Malting Barley",
    germanSub: "Sommerbraugerste mit Zwischenfrucht",
    imageUrl: "/images/crop-wheat.jpg",
    family: "cereal",
    isLegume: false,
    selectableAsBaseline: true,
    bwRecommended: true,
    bwRecommendationTag: "LTZ BW Recommended · Nitrate-Zone Fit",
    nDemandKgHa: 95,
    nFixedCreditKgHa: 0,
    waterNeedMm: 370,
    heatToleranceScore: 7,
    droughtToleranceScore: 7,
    erosionShieldScore: 8,
    baseYieldTonsHa: 6.5,
    pricePerTonEur: 256,
    seedAndOpsCostEurHa: 520,
    localBuyers: "Stuttgart Breweries (Dinkelacker/Schwaben Bräu) & Malting Pools",
    growingWindow: "Aug (Cover) → Mar – Jul",
    plainRole:
      "Naturally requires low Nitrogen (<11.5% grain protein) for brewing quality—thriving inside -20% Nitrate Restricted Zones.",
    coverCropIncluded: "Mustard-Phacelia Winter Cover",
    coverCropCostEurHa: 74,
    coverCropNRetentionKgHa: 32,
  },
  sugar_beet: {
    id: "sugar_beet",
    name: "Sugar Beet",
    germanSub: "Zuckerrübe",
    imageUrl: "/images/crop-sugarbeet.jpg",
    family: "root",
    isLegume: false,
    selectableAsBaseline: true,
    bwRecommended: false,
    bwRecommendationTag: "Neckar Basin Contract Crop",
    nDemandKgHa: 135,
    nFixedCreditKgHa: 15,
    waterNeedMm: 540,
    heatToleranceScore: 6,
    droughtToleranceScore: 5,
    erosionShieldScore: 3,
    baseYieldTonsHa: 77.5,
    pricePerTonEur: 44,
    seedAndOpsCostEurHa: 1490,
    localBuyers: "Südzucker Ludwigsburg/Kornwestheim Rail & Truck Pool",
    growingWindow: "Mar – Oct",
    plainRole:
      "High-revenue contract crop on Langes Feld loess north of Stuttgart, but bare spring ground erodes.",
  },
  sugar_beet_cover: {
    id: "sugar_beet_cover",
    name: "Sugar Beet + Mulch Cover",
    germanSub: "Zuckerrübe in Phacelia-Mulchsaat",
    imageUrl: "/images/crop-sugarbeet.jpg",
    family: "root",
    isLegume: false,
    selectableAsBaseline: false,
    bwRecommended: true,
    bwRecommendationTag: "LTZ BW Mulch-Sow Standard",
    nDemandKgHa: 125,
    nFixedCreditKgHa: 20,
    waterNeedMm: 505,
    heatToleranceScore: 7,
    droughtToleranceScore: 6,
    erosionShieldScore: 8,
    baseYieldTonsHa: 79.0,
    pricePerTonEur: 44,
    seedAndOpsCostEurHa: 1475,
    localBuyers: "Südzucker Ludwigsburg/Kornwestheim Rail & Truck Pool",
    growingWindow: "Aug (Cover) → Mar – Oct",
    plainRole:
      "Mulch-sowing into frost-killed Phacelia protects Neckar slopes and traps 42 kg/ha of Nitrogen.",
    coverCropIncluded: "Phacelia + Winter Vetch Mulch",
    coverCropCostEurHa: 88,
    coverCropNRetentionKgHa: 42,
  },
  winter_rapeseed: {
    id: "winter_rapeseed",
    name: "Winter Rapeseed",
    germanSub: "Winterraps",
    imageUrl: "/images/crop-rapeseed.jpg",
    family: "oilseed",
    isLegume: false,
    selectableAsBaseline: true,
    bwRecommended: false,
    bwRecommendationTag: "Standard BW Oilseed",
    nDemandKgHa: 185,
    nFixedCreditKgHa: 20,
    waterNeedMm: 480,
    heatToleranceScore: 5,
    droughtToleranceScore: 6,
    erosionShieldScore: 8,
    baseYieldTonsHa: 4.0,
    pricePerTonEur: 442,
    seedAndOpsCostEurHa: 720,
    localBuyers: "Neckarhafen Stuttgart, BayWa Plieningen, ZG Raiffeisen",
    growingWindow: "Aug – Jul",
    plainRole:
      "Deep taproot loosens Filder & Gäu soil, though it requires heavy spring Nitrogen.",
  },
  sunflower_bw: {
    id: "sunflower_bw",
    name: "Oilseed Sunflowers",
    germanSub: "Sonnenblume (HO) mit Zwischenfrucht",
    imageUrl: "/images/crop-sunflower.jpg",
    family: "oilseed",
    isLegume: false,
    selectableAsBaseline: true,
    bwRecommended: true,
    bwRecommendationTag: "LTZ BW Drought Oilseed",
    nDemandKgHa: 70,
    nFixedCreditKgHa: 10,
    waterNeedMm: 340,
    heatToleranceScore: 9,
    droughtToleranceScore: 9,
    erosionShieldScore: 7,
    baseYieldTonsHa: 3.4,
    pricePerTonEur: 418,
    seedAndOpsCostEurHa: 510,
    localBuyers: "Stuttgart Neckar Port Barge Pool & BW Oil Mills",
    growingWindow: "Apr – Sep",
    plainRole:
      "Ideal for warm Remstal & Neckar basins: 1.8m taproot reaches deep water on 62% less Nitrogen than Rapeseed.",
    coverCropIncluded: "Clover-Oat Winter Cover",
    coverCropCostEurHa: 76,
    coverCropNRetentionKgHa: 34,
  },
  winter_barley: {
    id: "winter_barley",
    name: "Winter Barley",
    germanSub: "Wintergerste",
    imageUrl: "/images/crop-wheat.jpg",
    family: "cereal",
    isLegume: false,
    selectableAsBaseline: true,
    bwRecommended: false,
    bwRecommendationTag: "Early-Harvest Feed Grain",
    nDemandKgHa: 165,
    nFixedCreditKgHa: 0,
    waterNeedMm: 410,
    heatToleranceScore: 7,
    droughtToleranceScore: 7,
    erosionShieldScore: 7,
    baseYieldTonsHa: 7.7,
    pricePerTonEur: 204,
    seedAndOpsCostEurHa: 590,
    localBuyers: "Raiffeisen Region Stuttgart & Böblingen Feed Mills",
    growingWindow: "Sep – Jun",
    plainRole:
      "Harvests early in June before peak July heatwaves; moderate feed-grain price.",
  },
  grain_maize: {
    id: "grain_maize",
    name: "Grain Corn (Maize)",
    germanSub: "Körnermais",
    imageUrl: "/images/crop-sorghum.jpg",
    family: "cereal",
    isLegume: false,
    selectableAsBaseline: true,
    bwRecommended: false,
    bwRecommendationTag: "High Water & Erosion Risk",
    nDemandKgHa: 180,
    nFixedCreditKgHa: 0,
    waterNeedMm: 530,
    heatToleranceScore: 7,
    droughtToleranceScore: 5,
    erosionShieldScore: 2,
    baseYieldTonsHa: 10.2,
    pricePerTonEur: 196,
    seedAndOpsCostEurHa: 830,
    localBuyers: "ZG Raiffeisen Ludwigsburg & Rems-Murr Feed Co-ops",
    growingWindow: "Apr – Oct",
    plainRole:
      "High yield in wet years, but vulnerable to May hillside runoff and July drought.",
  },
  soybean_bw: {
    id: "soybean_bw",
    name: "BW Soybeans (000 Tofu/Protein)",
    germanSub: "Sojabohne (000) + Winterbegrünung",
    imageUrl: "/images/crop-soybean.jpg",
    family: "legume",
    isLegume: true,
    selectableAsBaseline: true,
    bwRecommended: true,
    bwRecommendationTag: "Hohenheim / LTZ Flagship Legume",
    nDemandKgHa: 0,
    nFixedCreditKgHa: 65,
    waterNeedMm: 410,
    heatToleranceScore: 9,
    droughtToleranceScore: 7,
    erosionShieldScore: 7,
    baseYieldTonsHa: 3.1,
    pricePerTonEur: 458,
    seedAndOpsCostEurHa: 575,
    localBuyers: "Taifun-Tofu BW Contract, BayWa Stuttgart-Plieningen, ZG Raiffeisen",
    growingWindow: "May – Sep",
    plainRole:
      "Bred & trialed at Univ. Hohenheim (Stuttgart): needs 0 kg fertilizer, leaves +65 kg free N/ha, and earns food-grade contracts.",
    coverCropIncluded: "Rye-Clover Winter Cover",
    coverCropCostEurHa: 78,
    coverCropNRetentionKgHa: 28,
  },
  field_bean: {
    id: "field_bean",
    name: "Field Beans (Ackerbohne)",
    germanSub: "Ackerbohne (Eiweißpflanze)",
    imageUrl: "/images/crop-legume-cover.jpg",
    family: "legume",
    isLegume: true,
    selectableAsBaseline: true,
    bwRecommended: true,
    bwRecommendationTag: "LTZ BW Protein Strategy",
    nDemandKgHa: 0,
    nFixedCreditKgHa: 80,
    waterNeedMm: 420,
    heatToleranceScore: 7,
    droughtToleranceScore: 7,
    erosionShieldScore: 8,
    baseYieldTonsHa: 4.2,
    pricePerTonEur: 308,
    seedAndOpsCostEurHa: 525,
    localBuyers: "Raiffeisen Oberes Gäu & Filder GMO-Free Protein Pool",
    growingWindow: "Feb – Aug",
    plainRole:
      "Fixes +80 kg free Nitrogen/ha on deep Filder & Oberes Gäu soils and unlocks the €60/ha EU legume bonus.",
  },
  field_pea: {
    id: "field_pea",
    name: "Field Peas (Körnererbse)",
    germanSub: "Winter-/Körnererbse mit Zwischenfrucht",
    imageUrl: "/images/crop-legume-cover.jpg",
    family: "legume",
    isLegume: true,
    selectableAsBaseline: true,
    bwRecommended: true,
    bwRecommendationTag: "LTZ BW Early-Harvest Legume",
    nDemandKgHa: 0,
    nFixedCreditKgHa: 70,
    waterNeedMm: 345,
    heatToleranceScore: 7,
    droughtToleranceScore: 8,
    erosionShieldScore: 8,
    baseYieldTonsHa: 3.9,
    pricePerTonEur: 326,
    seedAndOpsCostEurHa: 490,
    localBuyers: "ZG Raiffeisen Region Stuttgart & Württemberg Feed Mills",
    growingWindow: "Mar – Jul",
    plainRole:
      "Grown across Region Stuttgart: harvests early in July before late-summer drought while fixing +70 kg free N/ha.",
    coverCropIncluded: "Mustard-Radish Winter Shield",
    coverCropCostEurHa: 72,
    coverCropNRetentionKgHa: 30,
  },
  grain_sorghum: {
    id: "grain_sorghum",
    name: "Grain Sorghum (Millet)",
    germanSub: "Körnerhirse (Sorghum) + Zwischenfrucht",
    imageUrl: "/images/crop-sorghum.jpg",
    family: "cereal",
    isLegume: false,
    selectableAsBaseline: false,
    bwRecommended: true,
    bwRecommendationTag: "LTZ Heat & Drought Champion",
    nDemandKgHa: 105,
    nFixedCreditKgHa: 0,
    waterNeedMm: 310,
    heatToleranceScore: 10,
    droughtToleranceScore: 9,
    erosionShieldScore: 7,
    baseYieldTonsHa: 7.6,
    pricePerTonEur: 224,
    seedAndOpsCostEurHa: 540,
    localBuyers: "ZG Raiffeisen Feed Mills & Regional Gluten-Free Grain Pools",
    growingWindow: "May – Sep",
    plainRole:
      "C4 drought & 37°C heat champion: needs 42% less water than Maize and thrives when July root moisture drops below 40%.",
    coverCropIncluded: "Clover-Phacelia Winter Mulch",
    coverCropCostEurHa: 74,
    coverCropNRetentionKgHa: 30,
  },
  winter_rye: {
    id: "winter_rye",
    name: "Winter Rye",
    germanSub: "Winterroggen (Brotroggen)",
    imageUrl: "/images/crop-wheat.jpg",
    family: "cereal",
    isLegume: false,
    selectableAsBaseline: false,
    bwRecommended: true,
    bwRecommendationTag: "Drought & Sandy-Soil Cereal",
    nDemandKgHa: 120,
    nFixedCreditKgHa: 0,
    waterNeedMm: 350,
    heatToleranceScore: 8,
    droughtToleranceScore: 9,
    erosionShieldScore: 8,
    baseYieldTonsHa: 7.4,
    pricePerTonEur: 218,
    seedAndOpsCostEurHa: 535,
    localBuyers: "Regional Bread Mills & Raiffeisen Grain Elevators",
    growingWindow: "Sep – Jul",
    plainRole:
      "Deep winter root system handles dry spring spells, sandy/lighter soils, and -20% Nitrogen caps reliably.",
  },
  spring_oats: {
    id: "spring_oats",
    name: "Spring Oats (Flake Quality)",
    germanSub: "Sommerhafer (Schälhafer)",
    imageUrl: "/images/crop-wheat.jpg",
    family: "cereal",
    isLegume: false,
    selectableAsBaseline: false,
    bwRecommended: true,
    bwRecommendationTag: "Cool-Plateau Phytosanitary Grain",
    nDemandKgHa: 95,
    nFixedCreditKgHa: 0,
    waterNeedMm: 430,
    heatToleranceScore: 5,
    droughtToleranceScore: 5,
    erosionShieldScore: 8,
    baseYieldTonsHa: 5.9,
    pricePerTonEur: 262,
    seedAndOpsCostEurHa: 495,
    localBuyers: "Oat-Flake Food Mills (kompakt/regional) & Horse-Feed Co-ops",
    growingWindow: "Aug (Cover) → Mar – Aug",
    plainRole:
      "Healthy root-disease break grain for cooler, moister plateaus (>400m), but suffers kernel shrivel in >33°C dry basins.",
    coverCropIncluded: "Phacelia-Clover Winter Cover",
    coverCropCostEurHa: 72,
    coverCropNRetentionKgHa: 28,
  },
  durum_wheat: {
    id: "durum_wheat",
    name: "Durum Pasta Wheat",
    germanSub: "Hartweizen (Durum)",
    imageUrl: "/images/crop-wheat.jpg",
    family: "cereal",
    isLegume: false,
    selectableAsBaseline: false,
    bwRecommended: true,
    bwRecommendationTag: "Warm Dry-Summer Pasta Grain",
    nDemandKgHa: 155,
    nFixedCreditKgHa: 0,
    waterNeedMm: 380,
    heatToleranceScore: 9,
    droughtToleranceScore: 8,
    erosionShieldScore: 7,
    baseYieldTonsHa: 6.2,
    pricePerTonEur: 318,
    seedAndOpsCostEurHa: 610,
    localBuyers: "Swabian Spätzle & Durum Semolina Mills (Neckar/Rhine)",
    growingWindow: "Oct – Jul",
    plainRole:
      "High-value pasta/Spätzle wheat suited ONLY to warm, dry-harvest wine climates; sprouting risk in cool wet uplands.",
  },
  chickpea: {
    id: "chickpea",
    name: "Chickpeas (Garbanzo)",
    germanSub: "Kichererbse + Winterbegrünung",
    imageUrl: "/images/crop-legume-cover.jpg",
    family: "legume",
    isLegume: true,
    selectableAsBaseline: false,
    bwRecommended: true,
    bwRecommendationTag: "Hot-Summer Dryland Legume",
    nDemandKgHa: 0,
    nFixedCreditKgHa: 55,
    waterNeedMm: 280,
    heatToleranceScore: 10,
    droughtToleranceScore: 10,
    erosionShieldScore: 6,
    baseYieldTonsHa: 2.1,
    pricePerTonEur: 660,
    seedAndOpsCostEurHa: 590,
    localBuyers: "Regional Food-Pulse Cleaners & Direct Hummus/Protein Buyers",
    growingWindow: "Apr – Aug",
    plainRole:
      "Extreme drought & heat legume (280 mm water, 0 kg N); requires warm dry summers and well-drained soil (rots in cold wet clay).",
    coverCropIncluded: "Rye-Vetch Winter Shield",
    coverCropCostEurHa: 74,
    coverCropNRetentionKgHa: 28,
  },
  lentil_ansa: {
    id: "lentil_ansa",
    name: "Food Lentils (Speiselinse)",
    germanSub: "Speiselinse (mit Stützfrucht)",
    imageUrl: "/images/crop-legume-cover.jpg",
    family: "legume",
    isLegume: true,
    selectableAsBaseline: false,
    bwRecommended: true,
    bwRecommendationTag: "Swabian Calcareous Specialty",
    nDemandKgHa: 0,
    nFixedCreditKgHa: 50,
    waterNeedMm: 330,
    heatToleranceScore: 8,
    droughtToleranceScore: 8,
    erosionShieldScore: 8,
    baseYieldTonsHa: 1.75,
    pricePerTonEur: 880,
    seedAndOpsCostEurHa: 640,
    localBuyers: "Swabian Lentil Producer Co-ops & Food-Grade Organic/Regio Hubs",
    growingWindow: "Mar – Aug",
    plainRole:
      "High-margin Swabian heritage pulse intercropped with barley/camelina on calcareous, neutral-to-alkaline soils (pH >= 6.4).",
    coverCropIncluded: "Mustard-Clover Winter Cover",
    coverCropCostEurHa: 72,
    coverCropNRetentionKgHa: 26,
  },
  alfalfa_lucerne: {
    id: "alfalfa_lucerne",
    name: "Alfalfa / Lucerne",
    germanSub: "Luzerne (Kleegras / Eiweißfutter)",
    imageUrl: "/images/crop-legume-cover.jpg",
    family: "legume",
    isLegume: true,
    selectableAsBaseline: false,
    bwRecommended: true,
    bwRecommendationTag: "Deep-Root Soil Builder",
    nDemandKgHa: 0,
    nFixedCreditKgHa: 105,
    waterNeedMm: 440,
    heatToleranceScore: 9,
    droughtToleranceScore: 9,
    erosionShieldScore: 10,
    baseYieldTonsHa: 9.2,
    pricePerTonEur: 175,
    seedAndOpsCostEurHa: 480,
    localBuyers: "Regional Dairy Farms, Dehydration Plants & Cattle Co-ops",
    growingWindow: "Year-round Living Cover",
    plainRole:
      "3m taproot survives severe heatwaves, stops slope erosion 100%, and fixes +105 kg N/ha—requires soil pH >= 6.3.",
    coverCropIncluded: "Perennial Living Sod",
    coverCropCostEurHa: 0,
    coverCropNRetentionKgHa: 45,
  },
  white_lupin: {
    id: "white_lupin",
    name: "Sweet Lupins",
    germanSub: "Süßlupine (Eiweißpflanze)",
    imageUrl: "/images/crop-legume-cover.jpg",
    family: "legume",
    isLegume: true,
    selectableAsBaseline: false,
    bwRecommended: true,
    bwRecommendationTag: "Low-Lime / Acidic-Soil Legume",
    nDemandKgHa: 0,
    nFixedCreditKgHa: 80,
    waterNeedMm: 360,
    heatToleranceScore: 8,
    droughtToleranceScore: 8,
    erosionShieldScore: 7,
    baseYieldTonsHa: 3.0,
    pricePerTonEur: 395,
    seedAndOpsCostEurHa: 530,
    localBuyers: "Plant-Protein Isolates & GMO-Free Dairy Feed Mills",
    growingWindow: "Mar – Aug",
    plainRole:
      "High-protein taproot legume for acidic/neutral sandy-loam soils; sensitive to free lime (chlorosis above pH 7.1).",
    coverCropIncluded: "Oat-Phacelia Winter Cover",
    coverCropCostEurHa: 72,
    coverCropNRetentionKgHa: 28,
  },
  table_potato: {
    id: "table_potato",
    name: "Table Potatoes",
    germanSub: "Speisekartoffeln",
    imageUrl: "/images/crop-sugarbeet.jpg",
    family: "root",
    isLegume: false,
    selectableAsBaseline: false,
    bwRecommended: false,
    bwRecommendationTag: "High Moisture & Low-Slope Needed",
    nDemandKgHa: 140,
    nFixedCreditKgHa: 10,
    waterNeedMm: 515,
    heatToleranceScore: 4,
    droughtToleranceScore: 4,
    erosionShieldScore: 3,
    baseYieldTonsHa: 41.0,
    pricePerTonEur: 145,
    seedAndOpsCostEurHa: 3850,
    localBuyers: "Regional Packhouses & Wholesale Fresh Markets",
    growingWindow: "Apr – Sep",
    plainRole:
      "High gross revenue on deep stone-free loams, but suffers tuber heat stress >29°C, drought yield loss, and ridge runoff on slopes.",
    coverCropIncluded: "Mustard-Phacelia Mulch Bed",
    coverCropCostEurHa: 80,
    coverCropNRetentionKgHa: 30,
  },
  paddy_rice: {
    id: "paddy_rice",
    name: "Paddy Rice",
    germanSub: "Nassreis (Subtropisch)",
    imageUrl: "/images/crop-wheat.jpg",
    family: "cereal",
    isLegume: false,
    selectableAsBaseline: false,
    bwRecommended: false,
    bwRecommendationTag: "Subtropical Flooded Basin Only",
    nDemandKgHa: 150,
    nFixedCreditKgHa: 0,
    waterNeedMm: 950,
    heatToleranceScore: 10,
    droughtToleranceScore: 2,
    erosionShieldScore: 5,
    baseYieldTonsHa: 6.8,
    pricePerTonEur: 410,
    seedAndOpsCostEurHa: 1120,
    localBuyers: "Subtropical Rice Mills (Po Valley / Monsoon / Irrigated Basins)",
    growingWindow: "May – Oct",
    plainRole:
      "Requires >900 mm water/paddy irrigation, flat zero-slope basins (<1.5%), and sustained >24°C summer temperatures.",
  },
  cotton_crop: {
    id: "cotton_crop",
    name: "Upland Cotton",
    germanSub: "Baumwolle (Subtropisch/Arid)",
    imageUrl: "/images/crop-sunflower.jpg",
    family: "oilseed",
    isLegume: false,
    selectableAsBaseline: false,
    bwRecommended: false,
    bwRecommendationTag: "Hot Long-Season Zone Only",
    nDemandKgHa: 130,
    nFixedCreditKgHa: 0,
    waterNeedMm: 620,
    heatToleranceScore: 10,
    droughtToleranceScore: 7,
    erosionShieldScore: 4,
    baseYieldTonsHa: 3.1,
    pricePerTonEur: 740,
    seedAndOpsCostEurHa: 1180,
    localBuyers: "Subtropical Ginning & Fiber Co-ops (>2,200 GDD10)",
    growingWindow: "Apr – Oct",
    plainRole:
      "Requires 180+ frost-free days and >2,100 GDD (base 10°C); cannot mature bolls in Central European climates.",
  },
};

/**
 * Verified local crop cultivation lists per Stuttgart sub-region
 * (Statistisches Landesamt BW / LTZ Augustenberg & Univ. Hohenheim regional arable zones).
 * Ensures AckerIQ NEVER suggests crops that are not commercially grown & bought in that area.
 */
export const AREA_PRODUCED_CROPS: Record<string, string[]> = {
  "filder-plieningen": [
    "winter_wheat",
    "swabian_spelt",
    "malting_barley",
    "winter_barley",
    "winter_rapeseed",
    "soybean_bw",
    "field_pea",
    "field_bean",
    "grain_maize",
    "winter_rye",
    "table_potato",
  ],
  "ludwigsburg-neckar": [
    "sugar_beet",
    "sugar_beet_cover",
    "winter_wheat",
    "swabian_spelt",
    "malting_barley",
    "winter_barley",
    "winter_rapeseed",
    "soybean_bw",
    "field_pea",
    "sunflower_bw",
    "grain_maize",
    "grain_sorghum",
    "winter_rye",
    "durum_wheat",
  ],
  "fellbach-rems": [
    "winter_wheat",
    "swabian_spelt",
    "malting_barley",
    "winter_barley",
    "winter_rapeseed",
    "soybean_bw",
    "sunflower_bw",
    "field_pea",
    "grain_maize",
    "grain_sorghum",
    "winter_rye",
    "durum_wheat",
  ],
  "herrenberg-gaeu": [
    "winter_wheat",
    "swabian_spelt",
    "malting_barley",
    "winter_barley",
    "winter_rapeseed",
    "field_bean",
    "field_pea",
    "grain_maize",
    "lentil_ansa",
    "spring_oats",
    "alfalfa_lucerne",
    "winter_rye",
  ],
};

export function isInsideBadenWuerttemberg(lat: number, lon: number): boolean {
  return lat >= 47.52 && lat <= 49.82 && lon >= 7.5 && lon <= 10.52;
}

export function getLocalizedCropDisplayName(
  crop: CropSpec,
  xray?: Pick<FarmXrayData, "lat" | "lon">,
  lang: "en" | "de" = "en"
): string {
  const inBw = xray ? isInsideBadenWuerttemberg(xray.lat, xray.lon) : true;
  if (!inBw) {
    if (crop.id === "soybean_bw") {
      return lang === "de" ? "Sojabohne (früh)" : "Early Soybeans";
    }
    if (crop.id === "swabian_spelt") {
      return lang === "de" ? "Winterdinkel" : "Winter Spelt";
    }
  }
  return lang === "de"
    ? crop.germanSub.split(" ·")[0].split(" +")[0].split(" mit")[0]
    : crop.name.split(" (")[0];
}

export function getAreaBaselineCrops(xray: FarmXrayData): CropSpec[] {
  const allowed = new Set(xray.producedCropIds);
  const matched = Object.values(CROPS_STUTTGART).filter(
    (c) => c.selectableAsBaseline && allowed.has(c.id)
  );
  if (matched.length > 0) return matched.slice(0, 9);
  return Object.values(CROPS_STUTTGART)
    .filter((c) => c.selectableAsBaseline)
    .slice(0, 8);
}

export function getAllBaselineCatalogGroups(xray: FarmXrayData): {
  quickOptions: CropSpec[];
  regionalOptions: CropSpec[];
  otherArableOptions: CropSpec[];
} {
  const producedSet = new Set(xray.producedCropIds);
  const allBaselineCandidates = Object.values(CROPS_STUTTGART).filter(
    (c) => c.id !== "sugar_beet_cover"
  );

  const regionalOptions = allBaselineCandidates.filter((c) =>
    producedSet.has(c.id)
  );
  const otherArableOptions = allBaselineCandidates.filter(
    (c) => !producedSet.has(c.id)
  );

  const quickBase = getAreaBaselineCrops(xray);
  const quickOptions = quickBase.slice(0, 4);

  return {
    quickOptions,
    regionalOptions,
    otherArableOptions,
  };
}

/**
 * Sub-region local price basis (EUR/t) across Region Stuttgart:
 * - Filder (Plieningen / Leinfelden): Stuttgart-Hedelfingen Neckar port + Swabian Spelt & Hohenheim soy hub
 * - Ludwigsburg (Langes Feld): Südzucker rail/truck pool + Neckar waterway grain access
 * - Fellbach (Remstal): Warm Remstal oilseed sunflower & food-grade 000 soybean maturity bonus
 * - Herrenberg (Oberes Gäu): Core Swabian Spelt (Schwabenkorn) & GMO-free pulse hub
 */
export const AREA_BASIS_CONFIG: Record<
  string,
  {
    marketHub: string;
    basisByCrop: Partial<Record<string, { deltaEur: number; reason: string }>>;
  }
> = {
  "filder-plieningen": {
    marketHub: "BayWa Stuttgart-Plieningen & Neckarhafen Hedelfingen",
    basisByCrop: {
      swabian_spelt: {
        deltaEur: 20,
        reason: "Stuttgart & Filder baker/mill contract premium",
      },
      soybean_bw: {
        deltaEur: 22,
        reason: "Filder food-grade 000 Tofu-Soy contract",
      },
      winter_wheat: {
        deltaEur: 9,
        reason: "Short haul to Port of Stuttgart (Hedelfingen) barge terminal",
      },
      malting_barley: {
        deltaEur: 12,
        reason: "Stuttgart regional brewery malting quality bonus",
      },
      field_bean: {
        deltaEur: 12,
        reason: "Filder GMO-free regional dairy protein program",
      },
      field_pea: {
        deltaEur: 10,
        reason: "Local Stuttgart Raiffeisen protein intake",
      },
    },
  },
  "ludwigsburg-neckar": {
    marketHub: "ZG Raiffeisen Ludwigsburg & Stuttgart Neckar Port",
    basisByCrop: {
      sugar_beet: {
        deltaEur: 3,
        reason: "Langes Feld Südzucker rail/truck loading pool",
      },
      sugar_beet_cover: {
        deltaEur: 4,
        reason: "Clean mulch-sown beet tare bonus",
      },
      winter_wheat: {
        deltaEur: 10,
        reason: "Neckar waterway freight advantage",
      },
      soybean_bw: {
        deltaEur: 20,
        reason: "Warm Neckar basin food-grade Tofu quality",
      },
      malting_barley: {
        deltaEur: 10,
        reason: "Langes Feld loess malting barley pool",
      },
      swabian_spelt: {
        deltaEur: 14,
        reason: "Württemberg regional Dinkel mill contract",
      },
    },
  },
  "fellbach-rems": {
    marketHub: "Raiffeisen Remstal-Waiblingen & Stuttgart Port",
    basisByCrop: {
      sunflower_bw: {
        deltaEur: 22,
        reason: "High oil-content bonus in warm Remstal wine climate",
      },
      soybean_bw: {
        deltaEur: 25,
        reason: "High protein maturity (000) on warm Schmidener Feld",
      },
      swabian_spelt: {
        deltaEur: 16,
        reason: "Rems-Murr artisan bakery & mill premium",
      },
      field_pea: {
        deltaEur: 10,
        reason: "Early dry July harvest saves elevator drying fees",
      },
    },
  },
  "herrenberg-gaeu": {
    marketHub: "Raiffeisen Oberes Gäu (Herrenberg) & Schwabenkorn",
    basisByCrop: {
      swabian_spelt: {
        deltaEur: 26,
        reason: "Core Oberes Gäu Schwabenkorn Dinkel contract",
      },
      field_bean: {
        deltaEur: 15,
        reason: "Oberes Gäu GMO-free protein bonus",
      },
      field_pea: {
        deltaEur: 14,
        reason: "Regional GMO-free feed protein contract",
      },
      malting_barley: {
        deltaEur: 12,
        reason: "Gäu limestone-loess malting quality bonus",
      },
      winter_rapeseed: {
        deltaEur: 7,
        reason: "Herrenberg oilseed block-storage pool",
      },
    },
  },
};

export function buildDefaultAreaPriceFeed(areaId: string): AreaPriceFeedResponse {
  const normalizedAreaId = AREA_BASIS_CONFIG[areaId]
    ? areaId
    : "filder-plieningen";
  const cfg = AREA_BASIS_CONFIG[normalizedAreaId];
  const producedSet = new Set(
    AREA_PRODUCED_CROPS[normalizedAreaId] ??
      AREA_PRODUCED_CROPS["filder-plieningen"]
  );
  const quotes: Record<string, RegionalCropPriceQuote> = {};

  for (const crop of Object.values(CROPS_STUTTGART)) {
    const b = cfg.basisByCrop[crop.id];
    const basisEur = b?.deltaEur ?? 0;
    const effective = Math.max(25, Math.round(crop.pricePerTonEur + basisEur));
    quotes[crop.id] = {
      cropId: crop.id,
      cropName: crop.name,
      germanSub: crop.germanSub,
      nationalBenchmarkEurTon: crop.pricePerTonEur,
      localBasisEurTon: basisEur,
      effectiveLocalPriceEurTon: effective,
      basisReason: b?.reason ?? "Standard Region Stuttgart wholesale quote",
      marketHub: cfg.marketHub,
      priceTrendPct: 0,
      producedInArea: producedSet.has(crop.id),
    };
  }

  return {
    areaId: normalizedAreaId,
    areaMarketLabel: cfg.marketHub,
    fertPriceEurKgN: 1.31,
    eurUsdRate: 0.91,
    liveSourcesUsed: [
      "EU Eurostat DE Output Prices",
      "Stuttgart / BW Regional Basis",
    ],
    fetchedAtIso: "2026-11-14T12:00:00Z",
    quotes,
  };
}

export interface PresetFarmConfig {
  id: string;
  shortLabel: string;
  subtitle: string;
  badge: string;
  xray: FarmXrayData;
}

const BASE_STUTTGART_CLIMATE = [
  { month: "Jan", monthIndex: 0, tempAvgC: 1.9, tempMaxC: 5.1, precipMm: 52, rootMoistureIdx: 0.79, surfaceMoistureIdx: 0.82, solarKwhM2: 1.2, bareSoilBaseline: true, stressFlag: "leaching" as const },
  { month: "Feb", monthIndex: 1, tempAvgC: 3.1, tempMaxC: 7.5, precipMm: 46, rootMoistureIdx: 0.77, surfaceMoistureIdx: 0.78, solarKwhM2: 2.0, bareSoilBaseline: true, stressFlag: "leaching" as const },
  { month: "Mar", monthIndex: 2, tempAvgC: 6.9, tempMaxC: 12.4, precipMm: 54, rootMoistureIdx: 0.72, surfaceMoistureIdx: 0.69, solarKwhM2: 3.2, bareSoilBaseline: true, stressFlag: "erosion" as const },
  { month: "Apr", monthIndex: 3, tempAvgC: 10.9, tempMaxC: 17.1, precipMm: 50, rootMoistureIdx: 0.62, surfaceMoistureIdx: 0.55, solarKwhM2: 4.5, bareSoilBaseline: false, stressFlag: "erosion" as const },
  { month: "May", monthIndex: 4, tempAvgC: 15.3, tempMaxC: 21.8, precipMm: 78, rootMoistureIdx: 0.59, surfaceMoistureIdx: 0.53, solarKwhM2: 5.4, bareSoilBaseline: false, stressFlag: "erosion" as const },
  { month: "Jun", monthIndex: 5, tempAvgC: 19.0, tempMaxC: 26.2, precipMm: 74, rootMoistureIdx: 0.50, surfaceMoistureIdx: 0.44, solarKwhM2: 5.9, bareSoilBaseline: false, stressFlag: "drought" as const },
  { month: "Jul", monthIndex: 6, tempAvgC: 21.4, tempMaxC: 30.2, precipMm: 66, rootMoistureIdx: 0.40, surfaceMoistureIdx: 0.34, solarKwhM2: 5.8, bareSoilBaseline: false, stressFlag: "heat" as const },
  { month: "Aug", monthIndex: 7, tempAvgC: 20.8, tempMaxC: 29.5, precipMm: 60, rootMoistureIdx: 0.39, surfaceMoistureIdx: 0.35, solarKwhM2: 5.0, bareSoilBaseline: true, stressFlag: "heat" as const },
  { month: "Sep", monthIndex: 8, tempAvgC: 15.9, tempMaxC: 22.6, precipMm: 54, rootMoistureIdx: 0.49, surfaceMoistureIdx: 0.47, solarKwhM2: 3.6, bareSoilBaseline: false, stressFlag: "none" as const },
  { month: "Oct", monthIndex: 9, tempAvgC: 10.9, tempMaxC: 16.0, precipMm: 56, rootMoistureIdx: 0.61, surfaceMoistureIdx: 0.63, solarKwhM2: 2.3, bareSoilBaseline: false, stressFlag: "none" as const },
  { month: "Nov", monthIndex: 10, tempAvgC: 5.8, tempMaxC: 9.6, precipMm: 58, rootMoistureIdx: 0.71, surfaceMoistureIdx: 0.75, solarKwhM2: 1.3, bareSoilBaseline: false, stressFlag: "none" as const },
  { month: "Dec", monthIndex: 11, tempAvgC: 2.7, tempMaxC: 5.6, precipMm: 60, rootMoistureIdx: 0.78, surfaceMoistureIdx: 0.81, solarKwhM2: 1.0, bareSoilBaseline: true, stressFlag: "leaching" as const },
];

export const STUTTGART_FARMS: PresetFarmConfig[] = [
  {
    id: "filder-plieningen",
    shortLabel: "Plieningen (Stuttgart Filder)",
    subtitle: "Prime Filderlöss fields near Univ. Hohenheim",
    badge: "165 ha · Filder Plain",
    xray: {
      id: "filder-plieningen",
      name: "Filder Plain Farm — Stuttgart-Plieningen",
      subRegionTag: "South Stuttgart · Filder Loess Plain",
      regionLabel: "70599 Plieningen / Hohenheim, Stuttgart",
      heroImageUrl: "/images/farm-offenau.jpg",
      lat: 48.706,
      lon: 9.215,
      defaultAreaHa: 165,
      elevationM: 392,
      slopePct: 2.2,
      isNitrateRestricted: true,
      defaultCurrentCropIds: [
        "winter_wheat",
        "winter_barley",
        "winter_rapeseed",
        "winter_wheat",
      ],
      producedCropIds: AREA_PRODUCED_CROPS["filder-plieningen"],
      localProductionNote:
        "Deep Stuttgart Filderlöss belt: Winter Wheat, Swabian Spelt, Malting Barley, Rapeseed, 000 Soybeans, Field Beans & Field Peas.",
      bareSoilMonthsPerYear: 3.1,
      estimatedNLossPct: 28,
      plainSummary:
        "Located in a Nitrate Restricted Zone (-20% cap): back-to-back Filder cereals need heavy mineral N, whereas Hohenheim-trialed 000 Soybeans & Spelt cut N bills ~45%.",
      monthlyClimate: BASE_STUTTGART_CLIMATE,
      soil: {
        soilName: "Deep Stuttgart Filderlöss",
        textureClass: "Silt Loam (Filderlöss)",
        clayPct: 21,
        siltPct: 65,
        sandPct: 14,
        organicMatterPct: 2.2,
        ph: 7.0,
        totalNitrogenGkg: 1.41,
        waterHoldingMm: 204,
        drainageSummary:
          "Top-tier German loess water storage, but crusts when left bare in spring",
        sourceLabel: "ISRIC SoilGrids + BW Soil Survey",
      },
      parcels: buildStuttgartParcels(48.706, 9.215, 2.2),
      liveSourcesUsed: [
        "NASA POWER Weather",
        "NASA SRTM Slope",
        "ISRIC SoilGrids",
        "NASA GIBS Satellite",
      ],
      fetchedAtIso: "2026-11-14T12:00:00Z",
    },
  },
  {
    id: "ludwigsburg-neckar",
    shortLabel: "Ludwigsburg (Langes Feld)",
    subtitle: "Warm Neckar loess basin north of Stuttgart",
    badge: "195 ha · Beet & Grain",
    xray: {
      id: "ludwigsburg-neckar",
      name: "Langes Feld Farm — Ludwigsburg",
      subRegionTag: "North Stuttgart · Neckar Basin",
      regionLabel: "71636 Ludwigsburg / Kornwestheim, Region Stuttgart",
      heroImageUrl: "/images/farm-neuenstadt.jpg",
      lat: 48.882,
      lon: 9.162,
      defaultAreaHa: 195,
      elevationM: 276,
      slopePct: 2.9,
      isNitrateRestricted: true,
      defaultCurrentCropIds: [
        "sugar_beet",
        "winter_wheat",
        "winter_barley",
        "winter_wheat",
      ],
      producedCropIds: AREA_PRODUCED_CROPS["ludwigsburg-neckar"],
      localProductionNote:
        "Langes Feld loess basin (Ludwigsburg/Kornwestheim): Sugar Beet, Wheat, Spelt, Malting Barley, Rapeseed, 000 Soybeans, Sunflowers & Peas.",
      bareSoilMonthsPerYear: 3.4,
      estimatedNLossPct: 30,
      plainSummary:
        "Inside a -20% Nitrate Zone: leaving Langes Feld soil bare for 3.4 months ahead of Sugar Beet loses ~30% of applied Nitrogen.",
      monthlyClimate: BASE_STUTTGART_CLIMATE.map((m) => ({
        ...m,
        tempMaxC: Number((m.tempMaxC + 0.6).toFixed(1)),
      })),
      soil: {
        soilName: "Langes Feld Neckar Loess",
        textureClass: "Silt Loam",
        clayPct: 20,
        siltPct: 64,
        sandPct: 16,
        organicMatterPct: 2.1,
        ph: 7.2,
        totalNitrogenGkg: 1.38,
        waterHoldingMm: 198,
        drainageSummary:
          "Deep fertile loess; needs Phacelia mulch cover before spring Sugar Beet",
        sourceLabel: "ISRIC SoilGrids + BW Soil Survey",
      },
      parcels: buildStuttgartParcels(48.882, 9.162, 2.9),
      liveSourcesUsed: [
        "NASA POWER Weather",
        "NASA SRTM Slope",
        "ISRIC SoilGrids",
        "NASA GIBS Satellite",
      ],
      fetchedAtIso: "2026-11-14T12:00:00Z",
    },
  },
  {
    id: "fellbach-rems",
    shortLabel: "Fellbach (Remstal Basin)",
    subtitle: "Warm sloped basin east of Stuttgart (31°C+ Julys)",
    badge: "140 ha · Warm Slopes (4.6%)",
    xray: {
      id: "fellbach-rems",
      name: "Schmidener Feld Estate — Fellbach",
      subRegionTag: "East Stuttgart · Rems-Murr",
      regionLabel: "70736 Fellbach / Waiblingen, Region Stuttgart",
      heroImageUrl: "/images/farm-eppingen.jpg",
      lat: 48.826,
      lon: 9.292,
      defaultAreaHa: 140,
      elevationM: 286,
      slopePct: 4.6,
      isNitrateRestricted: true,
      defaultCurrentCropIds: [
        "grain_maize",
        "winter_wheat",
        "winter_barley",
        "winter_wheat",
      ],
      producedCropIds: AREA_PRODUCED_CROPS["fellbach-rems"],
      localProductionNote:
        "Warm Remstal & Schmidener Feld wine-climate zone: Wheat, Spelt, Malting Barley, 000 Soybeans, Oilseed Sunflowers & early Field Peas.",
      bareSoilMonthsPerYear: 3.9,
      estimatedNLossPct: 34,
      plainSummary:
        "Warmest Stuttgart sub-basin: 4.6% slopes lose ~34% N in May storms, while July root moisture drops to 35% during 31.5°C heatwaves.",
      monthlyClimate: BASE_STUTTGART_CLIMATE.map((m) =>
        m.monthIndex >= 5 && m.monthIndex <= 7
          ? {
              ...m,
              tempMaxC: Number((m.tempMaxC + 1.3).toFixed(1)),
              rootMoistureIdx: Number((m.rootMoistureIdx - 0.05).toFixed(2)),
            }
          : m
      ),
      soil: {
        soilName: "Remstal Keuper-Loess Loam",
        textureClass: "Clay-Silt Loam",
        clayPct: 23,
        siltPct: 57,
        sandPct: 20,
        organicMatterPct: 1.9,
        ph: 7.2,
        totalNitrogenGkg: 1.28,
        waterHoldingMm: 174,
        drainageSummary:
          "Warms early in spring; sloped edges erode without winter cover mulch",
        sourceLabel: "ISRIC SoilGrids + BW Soil Survey",
      },
      parcels: buildStuttgartParcels(48.826, 9.292, 4.6),
      liveSourcesUsed: [
        "NASA POWER Weather",
        "NASA SRTM Slope",
        "ISRIC SoilGrids",
        "NASA GIBS Satellite",
      ],
      fetchedAtIso: "2026-11-14T12:00:00Z",
    },
  },
  {
    id: "herrenberg-gaeu",
    shortLabel: "Herrenberg (Oberes Gäu)",
    subtitle: "Higher Swabian Spelt & pulse plateau SW of Stuttgart",
    badge: "220 ha · Spelt & Grain",
    xray: {
      id: "herrenberg-gaeu",
      name: "Oberes Gäu Arable Farm — Herrenberg",
      subRegionTag: "SW Stuttgart · Böblingen / Gäu",
      regionLabel: "71083 Herrenberg / Böblingen, Region Stuttgart",
      heroImageUrl: "/images/farm-brackenheim.jpg",
      lat: 48.598,
      lon: 8.868,
      defaultAreaHa: 220,
      elevationM: 445,
      slopePct: 3.8,
      isNitrateRestricted: true,
      defaultCurrentCropIds: [
        "winter_wheat",
        "winter_barley",
        "winter_rapeseed",
        "swabian_spelt",
      ],
      producedCropIds: AREA_PRODUCED_CROPS["herrenberg-gaeu"],
      localProductionNote:
        "Oberes Gäu Muschelkalk-loess plateau (445m): Winter Wheat, Swabian Spelt (Schwabenkorn), Malting Barley, Rapeseed, Field Beans & Field Peas.",
      bareSoilMonthsPerYear: 2.8,
      estimatedNLossPct: 29,
      plainSummary:
        "Grain-and-Rapeseed cycle spends heavily on mineral Nitrogen and misses €60/ha EU legume bonuses—Field Beans & Swabian Spelt thrive at 445m.",
      monthlyClimate: BASE_STUTTGART_CLIMATE.map((m) => ({
        ...m,
        tempAvgC: Number((m.tempAvgC - 0.6).toFixed(1)),
        tempMaxC: Number((m.tempMaxC - 0.7).toFixed(1)),
      })),
      soil: {
        soilName: "Oberes Gäu Muschelkalk-Loess",
        textureClass: "Silty Clay Loam",
        clayPct: 26,
        siltPct: 56,
        sandPct: 18,
        organicMatterPct: 2.3,
        ph: 7.1,
        totalNitrogenGkg: 1.44,
        waterHoldingMm: 188,
        drainageSummary:
          "Calcium-rich loam; ideal pH for Field Bean (+80 kg N) root nodules",
        sourceLabel: "ISRIC SoilGrids + BW Soil Survey",
      },
      parcels: buildStuttgartParcels(48.598, 8.868, 3.8),
      liveSourcesUsed: [
        "NASA POWER Weather",
        "NASA SRTM Slope",
        "ISRIC SoilGrids",
        "NASA GIBS Satellite",
      ],
      fetchedAtIso: "2026-11-14T12:00:00Z",
    },
  },
];

export function resolveNearestStuttgartPreset(
  lat: number,
  lon: number
): PresetFarmConfig {
  let nearest = STUTTGART_FARMS[0];
  let bestDist = Infinity;
  for (const preset of STUTTGART_FARMS) {
    const d =
      Math.pow(preset.xray.lat - lat, 2) +
      Math.pow(preset.xray.lon - lon, 2);
    if (d < bestDist) {
      bestDist = d;
      nearest = preset;
    }
  }
  return nearest;
}

// Aliases so all callers resolve cleanly
export const CROPS_HEILBRONN = CROPS_STUTTGART;
export const HEILBRONN_FARMS = STUTTGART_FARMS;
export const buildHeilbronnParcels = buildStuttgartParcels;
export const resolveNearestHeilbronnPreset = resolveNearestStuttgartPreset;
