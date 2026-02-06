import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { City } from './data';

const COLORS = {
  inRange: '#22c55e',   // green
  tooHot: '#ef4444',    // red
  tooCold: '#3b82f6',   // blue
};

const canvasRenderer = L.canvas({ padding: 0.5 });

let map: L.Map;
let markers: { city: City; marker: L.CircleMarker; rainMarker: L.Marker }[] = [];
let onMarkerClick: ((city: City) => void) | null = null;

export function initMap(container: string): L.Map {
  map = L.map(container, {
    center: [20, 0],
    zoom: 2,
    minZoom: 2,
    maxZoom: 12,
    worldCopyJump: true,
  });

  map.createPane('rainPane');
  const rainPane = map.getPane('rainPane');
  if (rainPane) {
    rainPane.style.zIndex = '650';
    rainPane.style.pointerEvents = 'none';
  }

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);

  // Try to center on user's location
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map.setView([pos.coords.latitude, pos.coords.longitude], 4);
      },
      () => { /* keep default view */ }
    );
  }

  return map;
}

export function setMarkerClickHandler(handler: (city: City) => void) {
  onMarkerClick = handler;
}

export function addCities(cities: City[]) {
  for (const city of cities) {
    const marker = L.circleMarker([city.lat, city.lng], {
      renderer: canvasRenderer,
      radius: 6,
      fillColor: COLORS.inRange,
      fillOpacity: 0.8,
      color: '#fff',
      weight: 1,
      opacity: 0.9,
    }).addTo(map);

    marker.on('click', () => {
      if (onMarkerClick) onMarkerClick(city);
    });

    marker.bindTooltip(city.n, {
      permanent: false,
      direction: 'top',
      offset: [0, -8],
    });

    const rainMarker = L.marker([city.lat, city.lng], {
      icon: L.divIcon({
        className: 'rain-drop-marker leaflet-div-icon',
        html: '<span class="rain-drop">💧</span>',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
      pane: 'rainPane',
      interactive: false,
      opacity: 0,
    }).addTo(map);

    markers.push({ city, marker, rainMarker });
  }
}

export function updateMarkerColors(
  month: number,
  minTemp: number,
  maxTemp: number,
  maxRain: number
): number {
  let matchCount = 0;

  for (const { city, marker, rainMarker } of markers) {
    const temp = city.t[month];
    let color: string;

    if (temp >= minTemp && temp <= maxTemp) {
      color = COLORS.inRange;
      matchCount++;
    } else if (temp > maxTemp) {
      color = COLORS.tooHot;
    } else {
      color = COLORS.tooCold;
    }

    marker.setStyle({ fillColor: color });

    const rain = city.r[month];
    rainMarker.setOpacity(rain > maxRain ? 1 : 0);
  }

  return matchCount;
}

export function panToCity(city: City) {
  map.setView([city.lat, city.lng], 8, { animate: true });
}

export function getMap(): L.Map {
  return map;
}

// Adjust marker size based on zoom
export function setupZoomHandler() {
  map.on('zoomend', () => {
    const zoom = map.getZoom();
    let radius: number;
    if (zoom <= 4) radius = 5;
    else if (zoom <= 7) radius = 8;
    else radius = 11;

    for (const { marker } of markers) {
      marker.setRadius(radius);
    }
  });
}
