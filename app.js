// Accra FloodWatch Application Logic (Full-Stack Integrated)

// --------------------------------------------------
// CONFIG & INITIAL STATE
// --------------------------------------------------

// Default Center: Accra, Ghana
const ACCRA_CENTER = [5.5861, -0.2184];
const DEFAULT_ZOOM = 12.5;

// Mock Safe Zones in Accra (Always rendered client-side)
const DEFAULT_SAFE_ZONES = [
  {
    id: "sz-1",
    name: "Accra Sports Stadium Shelter",
    coords: [5.5490, -0.1915], // Central Accra / Osu
    capacity: "Capacity: 4,000 people",
    phone: "+233 (0) 302-9988-12",
    description: "Central emergency center with disaster relief operations, medical aid, and food supply.",
    supplies: ["Clean Water", "First Aid", "Blankets", "Hot Meals"]
  },
  {
    id: "sz-2",
    name: "Achimota School Pavilion",
    coords: [5.6265, -0.2195], // North Accra / Achimota
    capacity: "Capacity: 800 people",
    phone: "+233 (0) 302-9988-13",
    description: "Northern gathering haven equipped with backup generators and medical staff.",
    supplies: ["Backup Power", "First Aid", "Cots"]
  },
  {
    id: "sz-3",
    name: "Legon Botanical Gardens Haven",
    coords: [5.6660, -0.1880], // North-East Accra / Legon
    capacity: "Capacity: 1,200 people",
    phone: "+233 (0) 302-9988-11",
    description: "High elevation open haven setup with tents, dry food, and sanitary amenities.",
    supplies: ["Tents", "Dry Food", "Sanitation", "Security"]
  }
];

// Fallback Mock Flood Reports (Used only if the backend API server is down)
const DEFAULT_FLOOD_REPORTS = [
  {
    id: "rep-1",
    locationName: "Adabraka Sahara (Near Odaw River)",
    coords: [5.5600, -0.2100],
    severity: "critical",
    description: "Odaw River overflowed. Water levels are up to 1.5 meters deep. Ground floor houses are completely submerged. Emergency services are evacuating residents.",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    source: "Crowdsourced (Verified)"
  },
  {
    id: "rep-2",
    locationName: "Kaneshie Market (Interchange Underpass)",
    coords: [5.5695, -0.2335],
    severity: "critical",
    description: "Severe street flooding. Underpass is completely flooded and impassable for all vehicles. High traffic gridlock stretching back to Graphic Road.",
    timestamp: new Date(Date.now() - 3.5 * 60 * 60 * 1000).toISOString(),
    source: "Official (NADMO)"
  }
];

// --------------------------------------------------
// APP STATE CLASS
// --------------------------------------------------
class AppState {
  constructor() {
    this.reports = [];
    this.safeZones = DEFAULT_SAFE_ZONES;
    this.selectedReportCoords = null;
    this.activeRoutePolyline = null;
    this.activeRouteMarkers = [];
    this.activeSafeZoneId = null;
    this.mapViewMode = "heatmap"; // 'heatmap' or 'markers'
  }

  // Fetch reports from Express API Database
  async loadReports() {
    try {
      const response = await fetch('/api/reports');
      if (!response.ok) throw new Error('API fetch failed');
      const data = await response.json();
      
      // Map SQLite database structure (latitude, longitude) into coords array [lat, lng]
      this.reports = data.map(r => ({
        ...r,
        coords: [r.latitude, r.longitude]
      }));
      return this.reports;
    } catch (e) {
      console.warn("Error loading reports from API, using client local fallbacks:", e);
      this.reports = DEFAULT_FLOOD_REPORTS;
      return this.reports;
    }
  }

  // Submit report to Express API Database
  async submitReport(locationName, coords, severity, description) {
    const payload = {
      locationName,
      latitude: coords[0],
      longitude: coords[1],
      severity,
      description
    };

    const response = await fetch('/api/reports', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to submit report to server');
    }

    const newReport = await response.json();
    // Map SQLite coordinates
    newReport.coords = [newReport.latitude, newReport.longitude];
    
    // Add to the local state cache
    this.reports.unshift(newReport);
    return newReport;
  }

  getRiskScore() {
    if (this.reports.length === 0) return 10;
    
    let totalScore = 0;
    this.reports.forEach(r => {
      if (r.severity === "critical") totalScore += 20;
      else if (r.severity === "medium") totalScore += 10;
      else totalScore += 3;
    });

    return Math.min(Math.max(Math.round(totalScore), 10), 99);
  }
}

// Instantiate state
const state = new AppState();

// --------------------------------------------------
// LEAFLET MAP INITIALIZATION
// --------------------------------------------------
let map;
let heatmapLayer = null;
let reportMarkersLayer = null;
let safeZoneMarkersLayer = null;
let tempReportMarker = null;

function initMap() {
  map = L.map('map', {
    zoomControl: false,
    attributionControl: true
  }).setView(ACCRA_CENTER, DEFAULT_ZOOM);

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(map);

  reportMarkersLayer = L.layerGroup();
  safeZoneMarkersLayer = L.layerGroup().addTo(map);

  map.on('click', function(e) {
    const lat = parseFloat(e.latlng.lat.toFixed(5));
    const lng = parseFloat(e.latlng.lng.toFixed(5));
    setReportCoords(lat, lng);
  });
}

// --------------------------------------------------
// MAP RENDERING UTILITIES
// --------------------------------------------------

function renderMapLayers() {
  if (heatmapLayer) map.removeLayer(heatmapLayer);
  reportMarkersLayer.clearLayers();
  map.removeLayer(reportMarkersLayer);

  const heatPoints = state.reports.map(r => {
    let intensity = 0.3;
    if (r.severity === "critical") intensity = 1.0;
    else if (r.severity === "medium") intensity = 0.6;
    return [r.coords[0], r.coords[1], intensity];
  });

  heatmapLayer = L.heatLayer(heatPoints, {
    radius: 30,
    blur: 18,
    maxZoom: 14,
    gradient: {
      0.3: 'rgba(24, 151, 255, 0.6)',
      0.6: 'rgba(254, 192, 8, 0.8)',
      1.0: 'rgba(255, 71, 69, 1.0)'
    }
  });

  state.reports.forEach(r => {
    const colorClass = `marker-${r.severity}`;
    const pulseElement = r.severity === 'critical' ? '<div class="marker-pulse"></div>' : '';
    
    const icon = L.divIcon({
      className: `custom-flood-marker ${colorClass}`,
      html: `
        <div class="marker-dot"></div>
        ${pulseElement}
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    const popupContent = `
      <div class="map-popup">
        <span class="popup-eyebrow eyebrow severity-${r.severity}">${r.severity.toUpperCase()} FLOOD</span>
        <h4>${r.locationName}</h4>
        <p>${r.description}</p>
        <span class="popup-time">${formatTimeAgo(r.timestamp)}</span>
      </div>
    `;

    const marker = L.marker(r.coords, { icon }).bindPopup(popupContent);
    reportMarkersLayer.addLayer(marker);
  });

  if (state.mapViewMode === "heatmap") {
    heatmapLayer.addTo(map);
  } else {
    reportMarkersLayer.addTo(map);
  }
}

function renderSafeZoneMarkers() {
  safeZoneMarkersLayer.clearLayers();

  state.safeZones.forEach(sz => {
    const icon = L.divIcon({
      className: "custom-safe-marker",
      html: `
        <div class="safe-marker-inner">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
            <path d="M21 3v5h-5"/>
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
            <path d="M3 21v-5h5"/>
          </svg>
        </div>
      `,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    const popupContent = `
      <div class="map-popup popup-safe">
        <span class="popup-eyebrow eyebrow severity-safe">SAFE HAVEN</span>
        <h4>${sz.name}</h4>
        <p>${sz.description}</p>
        <div class="popup-meta">
          <strong>${sz.capacity}</strong>
          <strong>${sz.phone}</strong>
        </div>
        <button type="button" class="btn-primary btn-popup-route" onclick="triggerNavigation('${sz.id}')" style="padding: 8px 16px; font-size: 11px; margin-top: 10px;">
          Plot Route Here &rarr;
        </button>
      </div>
    `;

    const marker = L.marker(sz.coords, { icon }).bindPopup(popupContent);
    safeZoneMarkersLayer.addLayer(marker);
  });
}

function setReportCoords(lat, lng) {
  state.selectedReportCoords = [lat, lng];
  document.getElementById("location-coords").value = `${lat}, ${lng}`;

  if (tempReportMarker) {
    tempReportMarker.setLatLng(state.selectedReportCoords);
  } else {
    const icon = L.divIcon({
      className: "custom-temp-marker",
      html: `<div class="temp-dot"></div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });
    tempReportMarker = L.marker(state.selectedReportCoords, { icon }).addTo(map);
  }

  if (state.activeSafeZoneId) {
    calculateRoute();
  }
}

// --------------------------------------------------
// ROUTING & SAFE PATH CALCULATION
// --------------------------------------------------

function triggerNavigation(safeZoneId) {
  state.activeSafeZoneId = safeZoneId;
  
  const items = document.querySelectorAll(".safe-zone-item");
  items.forEach(item => {
    item.classList.remove("active");
    if (item.getAttribute("data-id") === safeZoneId) {
      item.classList.add("active");
    }
  });

  calculateRoute();
}

function calculateRoute() {
  if (!state.activeSafeZoneId) return;

  const targetSafeZone = state.safeZones.find(sz => sz.id === state.activeSafeZoneId);
  if (!targetSafeZone) return;

  const startCoords = state.selectedReportCoords || [5.5684, -0.2076];
  const endCoords = targetSafeZone.coords;

  if (state.activeRoutePolyline) map.removeLayer(state.activeRoutePolyline);
  state.activeRouteMarkers.forEach(m => map.removeLayer(m));
  state.activeRouteMarkers = [];

  const waypoints = generateBypassingWaypoints(startCoords, endCoords);

  state.activeRoutePolyline = L.polyline(waypoints, {
    color: '#00BE52',
    weight: 5,
    opacity: 0.8,
    dashArray: '8, 8'
  }).addTo(map);

  const startIcon = L.divIcon({
    className: "route-start-marker",
    html: '<div class="start-dot"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });
  const startMarker = L.marker(startCoords, { icon: startIcon }).addTo(map);
  state.activeRouteMarkers.push(startMarker);

  const bounds = L.latLngBounds([startCoords, endCoords]);
  map.fitBounds(bounds, { padding: [50, 50] });

  updateDirectionsPanel(startCoords, targetSafeZone, waypoints);
}

function generateBypassingWaypoints(start, end) {
  const path = [start];
  const criticalFloods = state.reports.filter(r => r.severity === 'critical');
  const midLat = (start[0] + end[0]) / 2;
  const midLng = (start[1] + end[1]) / 2;
  
  let needsDetour = false;
  let detourPoint = null;
  let blockedAreaName = "";

  for (let flood of criticalFloods) {
    const distToFlood = getDistance(midLat, midLng, flood.coords[0], flood.coords[1]);
    if (distToFlood < 1.2) {
      needsDetour = true;
      blockedAreaName = flood.locationName;
      
      const dy = end[0] - start[0];
      const dx = end[1] - start[1];
      const length = Math.sqrt(dx*dx + dy*dy);
      
      const scale = 0.015;
      const perpLat = -dx / length * scale;
      const perpLng = dy / length * scale;
      
      detourPoint = [midLat + perpLat, midLng + perpLng];
      break;
    }
  }

  if (needsDetour && detourPoint) {
    path.push(detourPoint);
    path.tempDetourReason = `Bypassing heavily flooded ${blockedAreaName} area.`;
  }
  
  path.push(end);
  return path;
}

function updateDirectionsPanel(start, safeZone, waypoints) {
  const panel = document.getElementById("route-details-panel");
  panel.classList.remove("hidden");

  document.getElementById("route-target-name").innerText = `Safe Route to ${safeZone.name}`;
  
  const stepsContainer = document.getElementById("route-directions-steps");
  stepsContainer.innerHTML = "";

  let stepsHtml = `
    <div class="route-step">
      <div class="step-indicator">
        <div class="step-dot"></div>
        <div class="step-line"></div>
      </div>
      <div class="step-text">
        <strong>Departing Location</strong>
        ${state.selectedReportCoords ? `From pinned point (${start[0].toFixed(4)}, ${start[1].toFixed(4)})` : "From central Kwame Nkrumah Interchange"}
      </div>
    </div>
  `;

  if (waypoints.tempDetourReason) {
    stepsHtml += `
      <div class="route-step">
        <div class="step-indicator">
          <div class="step-dot warning"></div>
          <div class="step-line"></div>
        </div>
        <div class="step-text">
          <strong>Flood Avoidance Route</strong>
          ${waypoints.tempDetourReason} Redirecting via bypass route to stay on high-ground streets.
        </div>
      </div>
    `;
  } else {
    stepsHtml += `
      <div class="route-step">
        <div class="step-indicator">
          <div class="step-dot"></div>
          <div class="step-line"></div>
        </div>
        <div class="step-text">
          <strong>Direct Navigation</strong>
          Path clear of current critical flood zones. Proceed with normal speed.
        </div>
      </div>
    `;
  }

  stepsHtml += `
    <div class="route-step">
      <div class="step-indicator">
        <div class="step-dot" style="background-color: var(--color-green);"></div>
      </div>
      <div class="step-text">
        <strong>Arrive at ${safeZone.name}</strong>
        ${safeZone.capacity}. ${safeZone.phone}. Supplies: ${safeZone.supplies.join(", ")}.
      </div>
    </div>
  `;

  stepsContainer.innerHTML = stepsHtml;
}

function clearRoute() {
  state.activeSafeZoneId = null;
  
  const items = document.querySelectorAll(".safe-zone-item");
  items.forEach(item => item.classList.remove("active"));

  if (state.activeRoutePolyline) {
    map.removeLayer(state.activeRoutePolyline);
    state.activeRoutePolyline = null;
  }
  state.activeRouteMarkers.forEach(m => map.removeLayer(m));
  state.activeRouteMarkers = [];

  document.getElementById("route-details-panel").classList.add("hidden");
}

// --------------------------------------------------
// DATA PRESENTATION & UI RENDERING
// --------------------------------------------------

function renderDashboard() {
  const activeCount = state.reports.length;
  document.getElementById("count-active-zones").innerText = activeCount;
  document.getElementById("count-safe-zones").innerText = state.safeZones.length;

  const riskScore = state.getRiskScore();
  document.getElementById("risk-score-val").innerText = riskScore;
  document.getElementById("health-bar-indicator").style.left = `${riskScore}%`;

  const safeZonesList = document.getElementById("safe-zones-list");
  safeZonesList.innerHTML = "";
  
  state.safeZones.forEach(sz => {
    const startPos = state.selectedReportCoords || ACCRA_CENTER;
    const distanceKm = getDistance(startPos[0], startPos[1], sz.coords[0], sz.coords[1]).toFixed(1);
    
    const div = document.createElement("div");
    div.className = `safe-zone-item ${state.activeSafeZoneId === sz.id ? 'active' : ''}`;
    div.setAttribute("data-id", sz.id);
    div.addEventListener("click", () => triggerNavigation(sz.id));

    div.innerHTML = `
      <div class="sz-meta">
        <div class="sz-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
            <path d="M21 3v5h-5"/>
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
            <path d="M3 21v-5h5"/>
          </svg>
        </div>
        <div class="sz-info">
          <h4>${sz.name}</h4>
          <p>${sz.capacity}</p>
        </div>
      </div>
      <div class="sz-distance">${distanceKm} km</div>
    `;
    safeZonesList.appendChild(div);
  });

  const feedList = document.getElementById("updates-feed-list");
  feedList.innerHTML = "";

  state.reports.forEach(r => {
    const item = document.createElement("div");
    item.className = "feed-item";

    let iconSvg = '';
    if (r.severity === 'critical') {
      iconSvg = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      `;
    } else if (r.severity === 'medium') {
      iconSvg = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
      `;
    } else {
      iconSvg = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
      `;
    }

    item.innerHTML = `
      <div class="feed-icon-badge ${r.severity}">
        ${iconSvg}
      </div>
      <div class="feed-content">
        <h3>${r.locationName}</h3>
        <p>${r.description}</p>
        <span class="meta-time">${formatTimeAgo(r.timestamp)} &bull; ${r.source}</span>
      </div>
    `;
    feedList.appendChild(item);
  });
}

// --------------------------------------------------
// EVENT LISTENERS & FORMS HANDLERS
// --------------------------------------------------

function setupEventListeners() {
  // Form Submission via Fetch API (Save to Server Database)
  const form = document.getElementById("report-flood-form");
  form.addEventListener("submit", async function(e) {
    e.preventDefault();
    
    const locationName = document.getElementById("location-name").value.trim();
    const description = document.getElementById("flood-desc").value.trim();
    const severityRadio = document.querySelector('input[name="severity"]:checked');
    
    if (!state.selectedReportCoords) {
      alert("Please click a location on the map to place a pin.");
      return;
    }
    
    if (!severityRadio) {
      alert("Please select a flood severity level.");
      return;
    }

    const severity = severityRadio.value;
    const submitBtn = document.getElementById("btn-submit-report");
    
    try {
      submitBtn.disabled = true;
      submitBtn.innerText = "Submitting Report...";

      // Post data to Express Database API
      const newRep = await state.submitReport(locationName, state.selectedReportCoords, severity, description);

      // Reset form controls
      form.reset();
      state.selectedReportCoords = null;
      document.getElementById("location-coords").value = "";
      
      // Remove temporary target pin
      if (tempReportMarker) {
        map.removeLayer(tempReportMarker);
        tempReportMarker = null;
      }

      // Re-fetch and update UI
      renderDashboard();
      renderMapLayers();
      
      // Pan to new report location
      map.panTo(newRep.coords);
    } catch (err) {
      console.error(err);
      alert("Failed to submit report: " + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Submit Flood Report <span class="arrow">→</span>';
    }
  });

  // Map View Mode Toggles
  document.getElementById("btn-view-heatmap").addEventListener("click", function() {
    setViewMode("heatmap");
  });

  document.getElementById("btn-view-markers").addEventListener("click", function() {
    setViewMode("markers");
  });

  // Geolocation Button
  document.getElementById("btn-current-location").addEventListener("click", function() {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = parseFloat(position.coords.latitude.toFixed(5));
          const lng = parseFloat(position.coords.longitude.toFixed(5));
          
          const distToAccra = getDistance(lat, lng, ACCRA_CENTER[0], ACCRA_CENTER[1]);
          if (distToAccra > 80) {
            console.log("Mocking coordinates near Accra Mall");
            setReportCoords(5.6225, -0.1730);
            map.setView([5.6225, -0.1730], 14);
          } else {
            setReportCoords(lat, lng);
            map.setView([lat, lng], 14);
          }
        },
        (error) => {
          console.warn("Geolocation failed. Mocking coordinates near Accra Mall.", error);
          setReportCoords(5.6225, -0.1730);
          map.setView([5.6225, -0.1730], 14);
        }
      );
    } else {
      setReportCoords(5.6225, -0.1730);
      map.setView([5.6225, -0.1730], 14);
    }
  });

  // Clear route directions button
  document.getElementById("btn-clear-route").addEventListener("click", clearRoute);

}

function setViewMode(mode) {
  state.mapViewMode = mode;
  
  document.getElementById("btn-view-heatmap").classList.remove("active");
  document.getElementById("btn-view-markers").classList.remove("active");
  
  if (mode === "heatmap") {
    document.getElementById("btn-view-heatmap").classList.add("active");
  } else {
    document.getElementById("btn-view-markers").classList.add("active");
  }

  renderMapLayers();
}

// --------------------------------------------------
// MATH & UTILITIES HELPERS
// --------------------------------------------------

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatTimeAgo(isoString) {
  const date = new Date(isoString);
  const seconds = Math.floor((new Date() - date) / 1000);
  
  let interval = Math.floor(seconds / 31536000);
  if (interval >= 1) return interval + "y ago";
  
  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) return interval + "mo ago";
  
  interval = Math.floor(seconds / 86400);
  if (interval >= 1) return interval + "d ago";
  
  interval = Math.floor(seconds / 3600);
  if (interval >= 1) return interval + "h ago";
  
  interval = Math.floor(seconds / 60);
  if (interval >= 1) return interval + "m ago";
  
  return "Just now";
}

// --------------------------------------------------
// ENTRY POINT
// --------------------------------------------------
document.addEventListener("DOMContentLoaded", async function() {
  // Map initialization
  initMap();
  setupEventListeners();
  
  // Async data fetch from the backend database server
  await state.loadReports();
  
  // Dynamic UI bindings
  renderDashboard();
  renderMapLayers();
  renderSafeZoneMarkers();
});
