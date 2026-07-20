# Accra FloodWatch 🌊

Accra FloodWatch is a real-time, crowd-sourced flood zone reporting and safe haven navigation platform designed specifically for **Accra, Ghana**. The application is designed following a premium fintech-inspired design system: it uses a light canvas, generous whitespace, visual restraint, and selective accent coloring to communicate critical crisis data clearly and effectively.

Live server local link: [http://localhost:8000/](http://localhost:8000/)

---

## 🚀 Key Features

*   **Accra, Ghana Centralized Focus**: The map defaults to Accra (latitude `5.5861`, longitude `-0.2184`) and is pre-populated with historical mock reports from Ghana's recent major floods (2024–2026) in areas like **Adabraka Sahara, Kaneshie Market, N1 Highway (Apenkwa), Weija, and Tse Addo**.
*   **Dual-mode Leaflet Map**:
    *   **Heatmap View**: Renders intensity density overlays using `Leaflet.heat` based on the density and severity of flood reports.
    *   **Reports View**: Displays custom-styled HTML markers pulsing on coordinates, color-coded by severity level.
*   **Dynamic Risk Score Indicator**: The top header calculates a live "Accra Flood Risk Score" based on current active reports. The score is paired with a segmented health bar (Blue &rarr; Green &rarr; Yellow &rarr; Orange &rarr; Red) and a sliding indicator.
*   **Interactive Crowdsourced Reporting**: Users can click anywhere on the map to pin precise coordinates, designate the area name/landmark, select the severity level (Low, Medium, Critical), and enter situational details.
*   **Dynamic Geolocation Support**: Integrates browser Geolocation to quickly locate the user, falling back to a coordinate near Accra Mall if blocked or unavailable.
*   **Bypassing Safe Route Engine**:
    *   Lists all designated safe shelters (Accra Sports Stadium, Achimota School ground, Legon Botanical Gardens).
    *   Calculates real-time distance in kilometers using the Haversine formula from the user's pinned location to each shelter.
    *   Clicking a safe zone plots a green dashed route. If the straight-line path crosses any critical flood zones, the routing engine automatically calculates detour waypoints to bypass the flooded streets.
    *   Displays a navigation steps guide with contact numbers and shelter details.
*   **Chronological Live Feed**: Features status updates using flat/duotone colored icon badges and metadata timestamps.

---

## 🛠️ Technology Stack

We chose a lightweight, high-performance, and native tech stack:
1.  **Core**: Semantic HTML5 and Vanilla ES6+ JavaScript.
2.  **Styling**: Vanilla CSS3 utilizing Custom CSS Properties for design tokens. No framework compilers.
3.  **Mapping**: [Leaflet.js](https://leafletjs.com/) for interactive maps and [Leaflet.heat](https://github.com/Leaflet/Leaflet.heat) for gradient heatmap overlays.
4.  **Icons**: Custom SVGs drawn inline for native browser execution and offline capabilities.
5.  **State Management**: Synced directly to browser `localStorage` for data persistence.

---

## 🎨 Design Language Rules Followed

This application implements the visual system specified in the design guide:
*   **Color Neutrals**: Page background is light gray (`#F5F5F5`), cards are white (`#FFFFFF`), primary text is dark ink (`#171717`), and secondary text is muted gray (`#818181`).
*   **Accents**: Used only for critical data and labels:
    *   🔴 **Red** (`#FEECEB` / `#FF4745`): Critical flood severity, urgent warnings.
    *   🟡 **Yellow** (`#FFF9E7` / `#FEC008`): Medium severity, caution advice.
    *   🟢 **Green** (`#E4F9EE` / `#00BE52`): Safe zones, active routing, success states.
    *   🔵 **Blue** (`#E8F6FF` / `#1897FF`): Low severity, information, primary action links.
*   **Whitespace**: Cards use a generous `32px` padding, sections are separated by `48px` gaps, and major numbers (metrics counters, risk score) are given ample breathing room.
*   **Typography**: Styled using the `Outfit` Google Font, scaling weight and size to convey hierarchy rather than using colors for emphasis.
*   **Pills**: Buttons are fully rounded black pill capsules with a sliding trailing arrow (`→`) on hover.

---

## 💻 Getting Started Locally

Since the application requires no compilers or bundlers, running it is simple:

### Option A: Static Web Server (Recommended)
To prevent CORS issues with local asset loading, serve the project using any local web server:

**Using Node (npx):**
```bash
npx http-server -p 8000
```

**Using Python:**
```bash
python -m http-server 8000
```

Open your browser and navigate to: **[http://localhost:8000/](http://localhost:8000/)**

### Option B: Open Directly
Double-click the `index.html` file to open it directly in any modern browser.
