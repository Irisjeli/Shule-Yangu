// ============================================================
// KENYA SCHOOLS & HEALTHCARE FACILITIES WEBGIS
// Leaflet | GeoJSON | MarkerCluster | OSRM Routing
// ============================================================

// 1. MAP INITIALIZATION (Centered on Kenya)
const map = L.map("map", {
    center: [0.5, 37.8],
    zoom: 7,
    preferCanvas: true,
    zoomControl: true
});

// 2. BASEMAPS
const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
});

const satellite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    attribution: 'Imagery &copy; Esri',
    maxZoom: 19
});

const satelliteLabels = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
    attribution: 'Labels &copy; Esri',
    maxZoom: 19
});

const satelliteWithLabels = L.layerGroup([satellite, satelliteLabels]);
osm.addTo(map);

L.control.layers({
    "OpenStreetMap": osm,
    "Satellite Imagery": satellite,
    "Satellite with Labels": satelliteWithLabels
}, null, { collapsed: true, position: "topright" }).addTo(map);

L.control.scale({ imperial: false, metric: true }).addTo(map);

// 3. GLOBAL DATA VARIABLES
let schoolsData = [];
let healthcareData = [];
let roadsData = [];

// 4. FILTER SELECTIONS
const filterSelections = {
    counties: new Set(),
    schoolStatuses: new Set(),
    facilityTypes: new Set(),
    facilityOwners: new Set(),
    roadClasses: new Set()
};

const filterDefinitions = [
    { key: "counties", container: "countyOptions", summary: "countySummary" },
    { key: "schoolStatuses", container: "schoolStatusOptions", summary: "schoolStatusSummary" },
    { key: "facilityTypes", container: "facilityTypeOptions", summary: "facilityTypeSummary" },
    { key: "facilityOwners", container: "facilityOwnerOptions", summary: "facilityOwnerSummary" },
    { key: "roadClasses", container: "roadClassOptions", summary: "roadClassSummary" }
];

// 5. HELPER FUNCTIONS
function getElement(id) { return document.getElementById(id); }

function cleanValue(value) {
    if (value === null || value === undefined || String(value).trim() === "") return "Unknown";
    return String(value).trim();
}

function getProperty(properties, fieldNames) {
    for (const field of fieldNames) {
        const value = properties?.[field];
        if (value !== null && value !== undefined && String(value).trim() !== "") return value;
    }
    return "Unknown";
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    }[char]));
}

function matchesSelection(selection, value) {
    return selection.size === 0 || selection.has(cleanValue(value));
}

function matchesSearch(properties, fields, searchTerm) {
    if (!searchTerm) return true;
    const searchableText = fields.map(field => properties?.[field] ?? "").join(" ").toLowerCase();
    return searchableText.includes(searchTerm);
}

function uniqueSorted(values) {
    return [...new Set(values.map(cleanValue))].sort((a, b) => a.localeCompare(b));
}

// 6. MARKER CLUSTERS & SUB-LAYERS
function createClusterGroup(className) {
    return L.markerClusterGroup({
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        zoomToBoundsOnClick: true,
        iconCreateFunction: function() {
            return L.divIcon({
                html: '<div></div>',
                className: `custom-cluster ${className}`,
                iconSize: [30, 30]
            });
        }
    });
}

const publicSchoolCluster = createClusterGroup("school-cluster");
const privateSchoolCluster = createClusterGroup("school-cluster");
const unknownSchoolCluster = createClusterGroup("school-cluster");
const healthCluster = createClusterGroup("health-cluster");

// 7. SCHOOL STYLING & MARKERS
function getSchoolCategory(feature) {
    const status = String(getProperty(feature.properties, ["school_status", "Status"])).toLowerCase();
    if (status.includes("public")) return "public";
    if (status.includes("private")) return "private";
    return "unknown";
}

function createSchoolMarker(feature, latlng) {
    const category = getSchoolCategory(feature);
    const color = category === "public" ? "#2563eb" : category === "private" ? "#16a34a" : "#f59e0b";
    return L.circleMarker(latlng, { radius: 5, fillColor: color, color: "#ffffff", weight: 1, opacity: 1, fillOpacity: 0.9 });
}

// 8. ROADS CLASSIFICATION & LAYERS (Class A vs Class B)
function getRoadClass(feature) {
    const rawClass = getProperty(feature.properties, ["road_class_code", "ROADCLASS", "road_class", "class"]);
    const upper = String(rawClass).trim().toUpperCase();
    if (upper.includes("A") || upper === "1") return "Class A";
    if (upper.includes("B") || upper === "2") return "Class B";
    return "Class B"; // Default fallback
}

function createRoadLayer(colorHex) {
    return L.geoJSON(null, {
        style: function() {
            const zoom = map.getZoom();
            let weight = zoom > 13 ? 3 : zoom > 10 ? 2 : zoom > 7 ? 1.5 : 1;
            return { color: colorHex, weight: weight, opacity: 0.85 };
        },
        onEachFeature: function (feature, layer) {
            const props = feature.properties || {};
            layer.bindPopup(`
                <div class="map-popup">
                    <h3>Road Information</h3>
                    <b>Road number:</b> ${escapeHTML(getProperty(props, ["road_no"]))}<br>
                    <b>Road class:</b> ${escapeHTML(getRoadClass(feature))}<br>
                    <b>Surface:</b> ${escapeHTML(getProperty(props, ["surface_type"]))}<br>
                    <b>Condition:</b> ${escapeHTML(getProperty(props, ["condition"]))}<br>
                    <b>Length:</b> ${escapeHTML(getProperty(props, ["length_km"]))} km
                </div>
            `);
        }
    });
}

// Class A Roads (#e58b27) & Class B Roads (#777777) matching legend
const classARoadsLayer = createRoadLayer("#e58b27");
const classBRoadsLayer = createRoadLayer("#777777");

// 9. POPUPS & ROUTING
function routePointButtons(lat, lon, label) {
    return `
        <div class="route-popup-actions">
            <button type="button" class="route-set-point" data-route-point="origin" data-lat="${lat}" data-lon="${lon}" data-label="${escapeHTML(label)}">Set as Starting Point</button>
            <button type="button" class="route-set-point" data-route-point="destination" data-lat="${lat}" data-lon="${lon}" data-label="${escapeHTML(label)}">Set as Destination</button>
        </div>
    `;
}

function schoolPopup(properties, lat, lon) {
    const name = getProperty(properties, ["school_name"]);
    return `
        <div class="map-popup">
            <h3>${escapeHTML(name)}</h3>
            <b>School ID:</b> ${escapeHTML(getProperty(properties, ["school_id"]))}<br>
            <b>Level:</b> ${escapeHTML(getProperty(properties, ["school_type"]))}<br>
            <b>Status:</b> ${escapeHTML(getProperty(properties, ["school_status"]))}<br>
            <b>County:</b> ${escapeHTML(getProperty(properties, ["county_standardized", "County"]))}<br>
            <b>Latitude:</b> ${lat.toFixed(6)}<br><b>Longitude:</b> ${lon.toFixed(6)}
            ${routePointButtons(lat, lon, name)}
        </div>
    `;
}

function healthcarePopup(properties, lat, lon) {
    const name = getProperty(properties, ["facility_name"]);
    return `
        <div class="map-popup">
            <h3>${escapeHTML(name)}</h3>
            <b>Facility ID:</b> ${escapeHTML(getProperty(properties, ["facility_id"]))}<br>
            <b>Facility Type:</b> ${escapeHTML(getProperty(properties, ["facility_type"]))}<br>
            <b>Owner:</b> ${escapeHTML(getProperty(properties, ["owner"]))}<br>
            <b>County:</b> ${escapeHTML(getProperty(properties, ["county_standardized", "County"]))}<br>
            <b>Latitude:</b> ${lat.toFixed(6)}<br><b>Longitude:</b> ${lon.toFixed(6)}
            ${routePointButtons(lat, lon, name)}
        </div>
    `;
}

// Routing State & Handlers
let routeOrigin = null;
let routeDestination = null;
let routeOriginMarker = null;
let routeDestinationMarker = null;
let activeRoutePolyline = null;
const routeDisplayLayer = L.layerGroup().addTo(map);

function setRoutePoint(type, lat, lon, label) {
    const point = { lat: Number(lat), lon: Number(lon), label: label || "Selected Location" };
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lon)) return;

    if (type === "origin") {
        routeOrigin = point;
        if (routeOriginMarker) routeDisplayLayer.removeLayer(routeOriginMarker);
        routeOriginMarker = L.circleMarker([point.lat, point.lon], {
            radius: 8, fillColor: "#2563eb", color: "#ffffff", weight: 2, fillOpacity: 1
        }).bindPopup(`<b>Start:</b> ${escapeHTML(point.label)}`).addTo(routeDisplayLayer);
        if (getElement("originLabel")) getElement("originLabel").textContent = point.label;
        if (getElement("setOriginBtn")) getElement("setOriginBtn").textContent = "Change Start";
    } else if (type === "destination") {
        routeDestination = point;
        if (routeDestinationMarker) routeDisplayLayer.removeLayer(routeDestinationMarker);
        routeDestinationMarker = L.circleMarker([point.lat, point.lon], {
            radius: 8, fillColor: "#dc2626", color: "#ffffff", weight: 2, fillOpacity: 1
        }).bindPopup(`<b>Destination:</b> ${escapeHTML(point.label)}`).addTo(routeDisplayLayer);
        if (getElement("destinationLabel")) getElement("destinationLabel").textContent = point.label;
        if (getElement("setDestinationBtn")) getElement("setDestinationBtn").textContent = "Change Destination";
    }
}

document.addEventListener("click", function(e) {
    if (e.target && e.target.classList.contains("route-set-point")) {
        const type = e.target.getAttribute("data-route-point");
        const lat = e.target.getAttribute("data-lat");
        const lon = e.target.getAttribute("data-lon");
        const label = e.target.getAttribute("data-label");
        setRoutePoint(type, lat, lon, label);
    }
});

async function calculateRoute() {
    const summaryDiv = getElement("routeSummary");
    const instructionsDiv = getElement("routeInstructions");
    const calcBtn = getElement("calculateRouteBtn");

    if (!routeOrigin || !routeDestination) {
        if (summaryDiv) summaryDiv.innerHTML = "<span style='color:red;'>Please select both a Start point and Destination.</span>";
        return;
    }

    try {
        if (calcBtn) { calcBtn.disabled = true; calcBtn.textContent = "Calculating..."; }
        if (summaryDiv) summaryDiv.textContent = "Fetching optimal route...";

        const url = `https://router.project-osrm.org/route/v1/driving/${routeOrigin.lon},${routeOrigin.lat};${routeDestination.lon},${routeDestination.lat}?overview=full&geometries=geojson&steps=true`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("Routing service unavailable.");

        const data = await response.json();
        if (!data.routes || data.routes.length === 0) throw new Error("No navigable route found.");

        const route = data.routes[0];
        const distanceKm = (route.distance / 1000).toFixed(2);
        const durationMin = Math.round(route.duration / 60);

        if (activeRoutePolyline) routeDisplayLayer.removeLayer(activeRoutePolyline);

        const routeCoords = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
        activeRoutePolyline = L.polyline(routeCoords, { color: "#2563eb", weight: 5, opacity: 0.8, lineCap: "round" }).addTo(routeDisplayLayer);
        map.fitBounds(activeRoutePolyline.getBounds(), { padding: [50, 50] });

        if (summaryDiv) {
            summaryDiv.innerHTML = `<h4>Route Summary</h4><b>Distance:</b> ${distanceKm} km<br><b>Est. Time:</b> ${durationMin} mins`;
        }
        if (instructionsDiv && route.legs && route.legs[0].steps) {
            const stepsHtml = route.legs[0].steps.map(step => `<li>${escapeHTML(step.maneuver.type)} on <b>${escapeHTML(step.name || "unnamed road")}</b> (${(step.distance).toFixed(0)}m)</li>`).join("");
            instructionsDiv.innerHTML = `<h4>Directions</h4><ol>${stepsHtml}</ol>`;
        }
    } catch (err) {
        console.error("Routing Error:", err);
        if (summaryDiv) summaryDiv.innerHTML = `<span style='color:red;'>Route error: ${escapeHTML(err.message)}</span>`;
    } finally {
        if (calcBtn) { calcBtn.disabled = false; calcBtn.textContent = "Calculate Route"; }
    }
}

function clearRoute() {
    routeOrigin = null;
    routeDestination = null;
    routeDisplayLayer.clearLayers();
    activeRoutePolyline = null;
    routeOriginMarker = null;
    routeDestinationMarker = null;

    if (getElement("originLabel")) getElement("originLabel").textContent = "Not selected";
    if (getElement("destinationLabel")) getElement("destinationLabel").textContent = "Not selected";
    if (getElement("setOriginBtn")) getElement("setOriginBtn").textContent = "Choose Start on Map";
    if (getElement("setDestinationBtn")) getElement("setDestinationBtn").textContent = "Choose Destination on Map";
    if (getElement("routeSummary")) getElement("routeSummary").innerHTML = "";
    if (getElement("routeInstructions")) getElement("routeInstructions").innerHTML = "";
}

const calcBtn = getElement("calculateRouteBtn");
const clearBtn = getElement("clearRouteBtn");
if (calcBtn) calcBtn.addEventListener("click", calculateRoute);
if (clearBtn) clearBtn.addEventListener("click", clearRoute);

// 10. FILTERS UI
function createCheckboxFilter(definition, values) {
    const container = getElement(definition.container);
    if (!container) return;
    container.innerHTML = "";

    const allLabel = document.createElement("label");
    allLabel.className = "filter-option";
    const allCheckbox = document.createElement("input");
    allCheckbox.type = "checkbox";
    allCheckbox.checked = true;
    const allText = document.createElement("span");
    allText.textContent = "All";
    allLabel.appendChild(allCheckbox);
    allLabel.appendChild(allText);
    container.appendChild(allLabel);

    allCheckbox.addEventListener("change", function () {
        if (this.checked) {
            filterSelections[definition.key].clear();
            updateFilterUI();
            renderLayers(true);
        } else {
            this.checked = true;
        }
    });

    values.forEach(value => {
        const label = document.createElement("label");
        label.className = "filter-option";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = value;
        const text = document.createElement("span");
        text.textContent = value;

        checkbox.addEventListener("change", function () {
            const selection = filterSelections[definition.key];
            if (this.checked) selection.add(value);
            else selection.delete(value);
            updateFilterUI();
            renderLayers(true);
        });

        label.appendChild(checkbox);
        label.appendChild(text);
        container.appendChild(label);
    });
    updateFilterUI();
}

function updateFilterUI() {
    filterDefinitions.forEach(definition => {
        const container = getElement(definition.container);
        const summary = getElement(definition.summary);
        if (!container) return;
        const selection = filterSelections[definition.key];
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        if (checkboxes[0]) checkboxes[0].checked = selection.size === 0;
        checkboxes.forEach((cb, idx) => { if (idx > 0) cb.checked = selection.has(cb.value); });
        if (summary) summary.textContent = selection.size === 0 ? "All" : `${selection.size} selected`;
    });
}

function populateFilters() {
    const counties = uniqueSorted([
        ...schoolsData.map(f => getProperty(f.properties, ["county_standardized", "County"])),
        ...healthcareData.map(f => getProperty(f.properties, ["county_standardized", "County"]))
    ]);
    const schoolStatuses = uniqueSorted(schoolsData.map(f => getProperty(f.properties, ["school_status", "Status"])));
    const facilityTypes = uniqueSorted(healthcareData.map(f => getProperty(f.properties, ["facility_type", "Type"])));
    const facilityOwners = uniqueSorted(healthcareData.map(f => getProperty(f.properties, ["owner", "Owner"])));
    const roadClasses = uniqueSorted(roadsData.map(f => getRoadClass(f)));

    const filterValues = { counties, schoolStatuses, facilityTypes, facilityOwners, roadClasses };
    filterDefinitions.forEach(def => createCheckboxFilter(def, filterValues[def.key]));
}

// 11. STATISTICS & LEGEND DYNAMIC TOGGLES
function updateStatistics(schools, healthcare, roads) {
    getElement("schoolCount").textContent = schools.toLocaleString();
    getElement("healthCount").textContent = healthcare.toLocaleString();
    getElement("roadCount").textContent = roads.toLocaleString();
    getElement("totalCount").textContent = (schools + healthcare + roads).toLocaleString();
}

function updateLegend() {
    const togglePublic = getElement("togglePublicSchools");
    const togglePrivate = getElement("togglePrivateSchools");
    const toggleUnknown = getElement("toggleUnknownSchools");
    const toggleHealthcare = getElement("toggleHealthcare");
    const toggleClassA = getElement("toggleClassARoads");
    const toggleClassB = getElement("toggleClassBRoads");

    if (getElement("schoolPublicLegend")) getElement("schoolPublicLegend").style.display = togglePublic?.checked ? "flex" : "none";
    if (getElement("schoolPrivateLegend")) getElement("schoolPrivateLegend").style.display = togglePrivate?.checked ? "flex" : "none";
    if (getElement("schoolUnknownLegend")) getElement("schoolUnknownLegend").style.display = toggleUnknown?.checked ? "flex" : "none";
    if (getElement("healthLegend")) getElement("healthLegend").style.display = toggleHealthcare?.checked ? "flex" : "none";
    if (getElement("roadALegend")) getElement("roadALegend").style.display = toggleClassA?.checked ? "flex" : "none";
    if (getElement("roadBLegend")) getElement("roadBLegend").style.display = toggleClassB?.checked ? "flex" : "none";
}

// 12. MAIN RENDERING FUNCTION
function renderLayers(zoomToFit = false) {
    const searchInput = getElement("searchInput");
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : "";

    const filteredSchools = schoolsData.filter(feature => {
        const props = feature.properties || {};
        return matchesSelection(filterSelections.counties, getProperty(props, ["county_standardized", "County"])) &&
               matchesSelection(filterSelections.schoolStatuses, getProperty(props, ["school_status", "Status"])) &&
               matchesSearch(props, ["school_name", "school_id", "sub_county", "ward"], searchTerm);
    });

    const filteredHealthcare = healthcareData.filter(feature => {
        const props = feature.properties || {};
        return matchesSelection(filterSelections.counties, getProperty(props, ["county_standardized", "County"])) &&
               matchesSelection(filterSelections.facilityTypes, getProperty(props, ["facility_type", "Type"])) &&
               matchesSelection(filterSelections.facilityOwners, getProperty(props, ["owner", "Owner"])) &&
               matchesSearch(props, ["facility_name", "facility_id", "sub_county"], searchTerm);
    });

    const filteredRoads = roadsData.filter(feature => {
        return matchesSelection(filterSelections.roadClasses, getRoadClass(feature)) &&
               matchesSearch(feature.properties || {}, ["road_no", "surface_type", "condition"], searchTerm);
    });

    publicSchoolCluster.clearLayers();
    privateSchoolCluster.clearLayers();
    unknownSchoolCluster.clearLayers();
    healthCluster.clearLayers();
    classARoadsLayer.clearLayers();
    classBRoadsLayer.clearLayers();

    let publicCount = 0, privateCount = 0, unknownCount = 0;
    let classACount = 0, classBCount = 0;
    const bounds = L.latLngBounds();
    let hasPoints = false;

    filteredSchools.forEach(feature => {
        if (!feature.geometry || feature.geometry.type !== "Point") return;
        const [lon, lat] = feature.geometry.coordinates;
        bounds.extend([lat, lon]);
        hasPoints = true;

        const category = getSchoolCategory(feature);
        const marker = createSchoolMarker(feature, [lat, lon]);
        marker.bindPopup(schoolPopup(feature.properties, lat, lon));

        if (category === "public") { publicSchoolCluster.addLayer(marker); publicCount++; }
        else if (category === "private") { privateSchoolCluster.addLayer(marker); privateCount++; }
        else { unknownSchoolCluster.addLayer(marker); unknownCount++; }
    });

    filteredHealthcare.forEach(feature => {
        if (!feature.geometry || feature.geometry.type !== "Point") return;
        const [lon, lat] = feature.geometry.coordinates;
        bounds.extend([lat, lon]);
        hasPoints = true;

        const healthcareIcon = L.divIcon({
            className: "custom-point-icon",
            html: `<div style="width: 11px; height: 11px; background: #dc2626; border: 1px solid #ffffff; border-radius: 2px; box-shadow: 0 0 2px #555;"></div>`,
            iconSize: [11, 11], iconAnchor: [5, 5]
        });
        const marker = L.marker([lat, lon], { icon: healthcareIcon });
        marker.bindPopup(healthcarePopup(feature.properties, lat, lon));
        healthCluster.addLayer(marker);
    });

    filteredRoads.forEach(feature => {
        const rClass = getRoadClass(feature);
        if (rClass === "Class A") {
            classARoadsLayer.addData(feature);
            classACount++;
        } else {
            classBRoadsLayer.addData(feature);
            classBCount++;
        }
    });

    const totalSchools = publicCount + privateCount + unknownCount;
    updateStatistics(totalSchools, filteredHealthcare.length, filteredRoads.length);
    updateLayerVisibility();

    if (zoomToFit && hasPoints && bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14, animate: true });
    }

    getElement("status").textContent = `Displaying ${totalSchools.toLocaleString()} schools, ${filteredHealthcare.length.toLocaleString()} healthcare facilities, and ${filteredRoads.length.toLocaleString()} roads.`;
}

// 13. LAYER VISIBILITY CONTROLS
const togglePublicSchools = getElement("togglePublicSchools");
const togglePrivateSchools = getElement("togglePrivateSchools");
const toggleUnknownSchools = getElement("toggleUnknownSchools");
const toggleHealthcare = getElement("toggleHealthcare");
const toggleClassARoads = getElement("toggleClassARoads");
const toggleClassBRoads = getElement("toggleClassBRoads");

function updateLayerVisibility() {
    if (togglePublicSchools) {
        if (togglePublicSchools.checked) { if (!map.hasLayer(publicSchoolCluster)) map.addLayer(publicSchoolCluster); }
        else { map.removeLayer(publicSchoolCluster); }
    }
    if (togglePrivateSchools) {
        if (togglePrivateSchools.checked) { if (!map.hasLayer(privateSchoolCluster)) map.addLayer(privateSchoolCluster); }
        else { map.removeLayer(privateSchoolCluster); }
    }
    if (toggleUnknownSchools) {
        if (toggleUnknownSchools.checked) { if (!map.hasLayer(unknownSchoolCluster)) map.addLayer(unknownSchoolCluster); }
        else { map.removeLayer(unknownSchoolCluster); }
    }
    if (toggleHealthcare) {
        if (toggleHealthcare.checked) { if (!map.hasLayer(healthCluster)) map.addLayer(healthCluster); }
        else { map.removeLayer(healthCluster); }
    }
    if (toggleClassARoads) {
        if (toggleClassARoads.checked) { if (!map.hasLayer(classARoadsLayer)) map.addLayer(classARoadsLayer); }
        else { map.removeLayer(classARoadsLayer); }
    }
    if (toggleClassBRoads) {
        if (toggleClassBRoads.checked) { if (!map.hasLayer(classBRoadsLayer)) map.addLayer(classBRoadsLayer); }
        else { map.removeLayer(classBRoadsLayer); }
    }
    updateLegend();
}

[togglePublicSchools, togglePrivateSchools, toggleUnknownSchools, toggleHealthcare, toggleClassARoads, toggleClassBRoads].forEach(cb => {
    if (cb) cb.addEventListener("change", updateLayerVisibility);
});

// 14. EVENT LISTENERS & DATA LOAD
let searchTimer;
getElement("searchInput").addEventListener("input", function () {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { renderLayers(true); }, 300);
});

getElement("resetFilters").addEventListener("click", function() {
    getElement("searchInput").value = "";
    Object.values(filterSelections).forEach(s => s.clear());
    [togglePublicSchools, togglePrivateSchools, toggleUnknownSchools, toggleHealthcare, toggleClassARoads, toggleClassBRoads].forEach(cb => { if(cb) cb.checked = true; });
    updateLayerVisibility();
    updateFilterUI();
    renderLayers(false);
    map.setView([0.5, 37.8], 7);
});

async function loadData() {
    const status = getElement("status");
    try {
        status.textContent = "Loading WebGIS data...";
        const [schoolsRes, healthcareRes, roadsRes] = await Promise.all([
            fetch("data/kenya_schools_cleaned.geojson"),
            fetch("data/kenya_healthcare_cleaned.geojson"),
            fetch("data/kenya_roads_cleaned.geojson")
        ]);

        if (!schoolsRes.ok || !healthcareRes.ok || !roadsRes.ok) {
            throw new Error("Could not load GeoJSON files.");
        }

        const [schoolsGeoJSON, healthcareGeoJSON, roadsGeoJSON] = await Promise.all([
            schoolsRes.json(),
            healthcareRes.json(),
            roadsRes.json()
        ]);

        schoolsData = schoolsGeoJSON.features || [];
        healthcareData = healthcareGeoJSON.features || [];
        roadsData = roadsGeoJSON.features || [];

        console.log(`Loaded: ${schoolsData.length} schools, ${healthcareData.length} healthcare, ${roadsData.length} roads.`);

        populateFilters();
        renderLayers(false);
        updateLayerVisibility();

        setTimeout(() => { map.invalidateSize(); }, 200);

        status.textContent = "WebGIS data loaded successfully.";
    } catch (error) {
        console.error("Data loading error:", error);
        status.textContent = `Error loading data: ${error.message}`;
    }
}

loadData();