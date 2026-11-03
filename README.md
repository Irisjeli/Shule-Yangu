# Shule Yangu – Schools & Healthcare Facilities WebGIS

## Description
Shule Yangu is an interactive WebGIS for exploring schools, healthcare facilities, and selected road networks across Kenya. The map allows users to locate facilities, explore their distribution, filter locations by different attributes, and plan journeys between places.

## Data Sources
- [Energy Data](https://energydata.info/)
- [Ministry of Education – Kenya](https://www.education.go.ke/)
- [OpenStreetMap](https://www.openstreetmap.org/)

## Tools
- HTML, CSS, JavaScript
- Leaflet.js
- GeoJSON
- OpenStreetMap
- Esri World Imagery
- Leaflet MarkerCluster
- Valhalla Routing API
- Python HTTP Server

## My Inspiration
The inspiration behind Shule Yangu comes from everyday challenges in accessing schools and healthcare facilities.

A teacher transferred to a new school may need to locate the school and plan activities around it. Similarly, someone looking for medical assistance may not know where the nearest healthcare facility is.

Shule Yangu aims to make these locations easier to discover and explore, providing a useful mapping resource for teachers, students, community organizations, and other users.

## How I Made the Map
1. Collected school, healthcare facility, and road datasets.
2. Cleaned and standardized the datasets and converted them into GeoJSON.
3. Integrated the datasets into a Leaflet interactive map.
4. Applied different symbology to distinguish schools, healthcare facilities, and roads.
5. Implemented marker clustering to improve visualization at smaller scales.
6. Added search functionality and filters for counties, school status, healthcare facility types, ownership, and road classes.
7. Integrated multiple basemaps, including OpenStreetMap and satellite imagery.
8. Added popups and map statistics to provide information about mapped features.
9. Integrated a Valhalla routing service to enable journey planning, route visualization, distance calculations, travel-time estimates, and directions.

## Notes
- The road dataset contains selected primary roads classified as A and B roads.
- Routing is based on OpenStreetMap road-network data and the public Valhalla routing service.
- Route results are estimates and may differ from actual travel conditions.
- The map is intended for exploration and visualization of schools, healthcare facilities, and road networks across Kenya.
