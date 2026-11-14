# AckerIQ — Orbital Agronomy & Variable-Rate Crop Rotation Planner

**AckerIQ** closes the gap between coarse Earth-observation telemetry and in-cab farm machinery. By fusing live **NASA POWER agroclimatology**, **NASA SMAP L4 root-zone soil moisture**, **NASA MODIS NDVI & Land Surface Temperature**, **NASA SRTM 30 m terrain slope**, **ISRIC SoilGrids v2.0**, and **20 cm orthophoto imagery**, AckerIQ designs 4-year crop rotations and exports georeferenced **ISO 11783-10 (`TASKDATA.XML`)** and **GeoJSON** variable-rate Nitrogen prescriptions ready for tractor spreader terminals.

Licensed under the OSI-approved [MIT License](./LICENSE).

---

## 1. Real-World Problem & Quantified Impact

Arable farmers face three converging pressures:
1. **Drought & Peak Summer Heat:** Falling July root-zone soil moisture (`SMAP L4`) and >30 °C heat waves slash spring cereal and maize yields.
2. **Fertilizer Costs & Nitrate Caps (`Rote Gebiete`):** Synthetic mineral Nitrogen (`KAS 27%`) drives farm input costs while winter bare-soil runoff contaminates drinking-water aquifers (>50 mg $\text{NO}_3^-$/L) and emits nitrous oxide ($\text{N}_2\text{O}$, **273×** the 100-year warming potential of $\text{CO}_2$, IPCC AR6).
3. **Actionability Gap:** Satellite portals display raw raster layers (`NDVI`, `SMAP`), not local crop-contract economics (€/t), CAP/FAKT II eco-scheme eligibility, or tractor-ready prescription files.

For every farm coordinate or imported `.geojson` / `.kml` field boundary, AckerIQ quantifies:
- **Net 4-Year Farm Margin (€/ha & total €)** using regional elevator basis quotes + EU GAP Eco-Scheme 2 & FAKT II cover/legume grants.
- **Mineral Nitrogen Saved (% & €)** via biological $\text{N}_2$ fixation and winter catch-crop scavenging.
- **Climate Footprint Avoided ($\text{t CO}_2\text{e}$)** combining EU Haber-Bosch synthesis emissions, IPCC Tier-1 direct/indirect $\text{N}_2\text{O}$ flux, and winter cover-crop soil organic carbon sequestration.
- **Groundwater $\text{NO}_3^-\text{-N}$ Leaching Prevented ($\text{kg N}$)**, **FAO-56 Soil Water Retained ($\text{m}^3$)**, and **RUSLE Hillside Topsoil Saved ($\text{t}$)**.

---

## 2. System Architecture

```mermaid
flowchart LR
  subgraph EO["Open Space & Earth Science APIs"]
    POWER["NASA POWER Agroclimatology API\n(T2M, PRECTOTCORR, GWETROOT, ALLSKY_SFC_SW_DWN)"]
    GIBS["NASA GIBS WMTS\n(SMAP L4 Root Moisture, MODIS 8-Day NDVI, MODIS LST)"]
    SRTM["NASA SRTM GL1 30m DEM\n(Elevation & Field Slope %)"]
    SOIL["ISRIC SoilGrids v2.0\n(0-30cm Clay, Silt, Sand, SOC, pH, N)"]
    AERIAL["LGL-BW 20cm DOP20 WMS +\nEsri World Imagery"]
    WX["Open-Meteo Forecast\n(7-Day Rain/Wind Spreader Window)"]
  end

  subgraph APP["AckerIQ Next.js Engine"]
    XRAY["/api/farm-xray & /api/farm-aerial\nCoordinate & GeoJSON/KML Ingestion"]
    MODEL["Agronomy & Climate Engine\n(FAO-56 ETc, IPCC AR6 N2O, RUSLE Erosion)"]
    ECON["Regional Market & Subsidy Stacker\n(Eurostat €/t + CAP Öko-Reg. 2 + FAKT II)"]
  end

  subgraph OUT["Farmer & Hardware Outputs"]
    ISOXML["ISO 11783-10 TASKDATA.XML\n(<PFD> & <TZN> WGS84 Polygons)"]
    GEOJSON["RFC 7946 GeoJSON\nVariable-Rate Prescription"]
    PDF["Printable 4-Year Farm &\nSubsidy Compliance Plan"]
  end

  POWER --> XRAY
  GIBS --> XRAY
  SRTM --> XRAY
  SOIL --> XRAY
  AERIAL --> XRAY
  WX --> APP
  XRAY --> MODEL
  ECON --> MODEL
  MODEL --> ISOXML
  MODEL --> GEOJSON
  MODEL --> PDF
```

---

## 3. NASA & Partner Open Datasets Used

| Dataset / Agency | Parameters & Layers | Spatial / Temporal Resolution | Citation / Endpoint |
| :--- | :--- | :--- | :--- |
| **NASA POWER** (LaRC Agroclimatology) | `T2M`, `T2M_MAX`, `PRECTOTCORR`, `GWETROOT`, `GWETTOP`, `ALLSKY_SFC_SW_DWN` | $0.5^\circ \times 0.625^\circ$ (MERRA-2 / CERES), 12-month climatology | `https://power.larc.nasa.gov/api/temporal/climatology/point` · DOI: `10.5067/POWER` |
| **NASA SMAP L4** via **NASA GIBS** | `SMAP_L4_Analyzed_Root_Zone_Soil_Moisture` | 9 km EASE-Grid 2.0, dynamic daily composite | `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/` · DOI: `10.5067/EVKPQZ4AFC4D` |
| **NASA Terra MODIS** via **NASA GIBS** | `MODIS_Terra_NDVI_8Day` (`MOD13Q1`), `MODIS_Terra_Land_Surface_Temp_Day` (`MOD11A1`) | 250 m (NDVI 8-day Julian DOY) / 1 km (LST daily) | `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/` · DOI: `10.5067/MODIS/MOD13Q1.061` |
| **NASA SRTM** Digital Elevation | Elevation ($z$) & orthogonal gradient slope (%) | 1 arc-second (~30 m) | `10.5067/MEaSUREs/SRTM/SRTMGL1.003` (queried via Open-Meteo Elevation API) |
| **ISRIC SoilGrids v2.0** | `clay`, `silt`, `sand`, `soc`, `phh2o`, `nitrogen` (0–30 cm) | 250 m global | `https://rest.isric.org/soilgrids/v2.0/properties/query` · Poggio et al. (2021) |
| **LGL-BW DOP20 & Esri Imagery** | `IMAGES_DOP_20_RGB` orthophotos + global satellite basemap | 20 cm (Baden-Württemberg) / 0.3–1 m global | `WMS_LGL-BW_ATKIS_DOP_20_C` & ArcGIS `World_Imagery` |
| **Open-Meteo & Eurostat** | 7-day precipitation/wind forecast; regional grain & oilseed quotes | Hourly/Daily local point; regional market hubs | `/api/spreader-forecast` & `/api/crop-prices` |

---

## 4. Scientific Methodology & Equations

All calculations are implemented in [`src/lib/rotationEngine.ts`](./src/lib/rotationEngine.ts) and [`src/app/api/farm-xray/route.ts`](./src/app/api/farm-xray/route.ts):

### 4.1 FAO-56 Evapotranspiration & Crop Water Stress ($ET_0$, $ET_c$, $K_y$)
Using NASA POWER surface shortwave solar irradiance (`ALLSKY_SFC_SW_DWN`, converted from $\text{kWh m}^{-2}\text{ d}^{-1}$ to $R_s$ in $\text{MJ m}^{-2}\text{ d}^{-1}$ via $\times 3.6$) and mean air temperature ($T_{\text{mean}}$), growing-season reference evapotranspiration (Apr–Sep) is computed via the Hargreaves–Makkink radiation-temperature formulation:

$$ET_0 = \sum_{m=\text{Apr}}^{\text{Sep}} d_m \cdot 0.0135 \cdot (T_{\text{mean},m} + 17.78) \cdot \frac{R_{s,m}}{2.45}$$

Seasonal crop water demand is $ET_c = K_c \cdot ET_0$, and water-limited yield response follows **FAO Irrigation & Drainage Paper No. 56** (Allen et al., 1998; Doorenbos & Kassam, 1979):

$$\frac{Y_a}{Y_m} = 1 - K_y \left(1 - \frac{ET_a}{ET_c}\right)$$

where $ET_a = \min\left(ET_c,\; P_{\text{eff}} + \text{AWC}_{0\text{–}30\text{cm}} \cdot \theta_{\text{SMAP}} + \Delta W_{\text{mulch}}\right)$.

### 4.2 Greenhouse Gas Balance ($\text{CO}_2\text{e}$ via IPCC 2019 Tier-1 & AR6)
Annual net greenhouse gas intensity ($\text{kg CO}_2\text{e ha}^{-1}\text{ yr}^{-1}$) combines:
- **Upstream Haber-Bosch synthesis (EU KAS 27% benchmark):** $3.48\text{ kg CO}_2\text{e per kg synthetic N}$.
- **Direct & indirect field $\text{N}_2\text{O}$ emissions:** IPCC 2019 Refinement Tier-1 emission factor $EF_1 = 0.01\text{ kg N}_2\text{O-N (kg N)}^{-1}$, converted by $\frac{44}{28}$ molecular mass ratio and **IPCC AR6 $\text{GWP}_{100}(\text{N}_2\text{O}) = 273$** plus indirect volatilization/leaching ($5.65\text{ kg CO}_2\text{e per kg synthetic N}$; $2.14\text{ kg CO}_2\text{e per kg biological residue N}$).
- **Winter cover-crop soil organic carbon (SOC) sequestration:** $-440\text{ kg CO}_2\text{e ha}^{-1}\text{ yr}^{-1}$ when winter catch crops replace bare fallow (Poeplau & Don, 2015).

### 4.3 RUSLE Hillside Erosion & Groundwater $\text{NO}_3^-\text{-N}$ Leaching
- **RUSLE ($A = R \cdot K \cdot LS \cdot C$):** Combines May–Aug erosive rainfall ($R$ from NASA POWER), silt/organic-matter soil erodibility ($K$ from ISRIC SoilGrids), slope steepness ($LS$ from NASA SRTM), and ground-cover factor ($C = 0.055$ under winter mulch vs. up to $0.36$ on bare spring slopes).
- **Winter $\text{NO}_3^-\text{-N}$ Percolation:** Scales residual post-harvest mineral N by Nov–Feb percolation (`PRECTOTCORR`), sand/water-holding drainage susceptibility, and winter catch-crop root N scavenging ($-62\%$).

### 4.4 Georeferenced ISO 11783-10 (`TASKDATA.XML`) & GeoJSON Export
Farmers can click-draw a parcel or upload `.geojson` / `.kml` boundaries ([`src/lib/fieldBoundaryGeo.ts`](./src/lib/fieldBoundaryGeo.ts)). [`TractorPrescriptionModal.tsx`](./src/components/TractorPrescriptionModal.tsx) exports:
- **`TASKDATA.XML` (ISO 11783-10 v4.3):** Closed WGS84 exterior `<PFD><PLN><LSG><PNT>` rings and sub-parcel treatment zones `<TZN>` with DDI `0002` application rates ($\text{mg m}^{-2}$).
- **RFC 7946 `.geojson`:** Polygon features carrying `targetNitrogenKgHa`, `zoneType`, `fao56EtcMm`, and `ipccCo2eKgHa` for QGIS or John Deere Operations Center.

---

## 5. Local Development & Deployment

### Prerequisites
- Node.js `>= 20` and `npm`

### Run Locally
```bash
npm install
npm run dev
```
Open `http://localhost:3000` (or `--port 3005` if `3000` is occupied). No proprietary API keys are required—all NASA Earthdata (`POWER`, `GIBS`), ISRIC SoilGrids, LGL-BW WMS, and Open-Meteo endpoints run out of the box with graceful regional fallbacks for offline rural connectivity.

### Production Verification & Docker
```bash
npm run lint
npm run build
```
A multi-stage [`Dockerfile`](./Dockerfile) (`output: "standalone"`) is included for container deployment on Google Cloud Run or any OCI host.
