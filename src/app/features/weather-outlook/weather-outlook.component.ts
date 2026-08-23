import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface HourlyPoint {
  time: string; // ISO
  temperature: number;
  precipProbability: number;
  cloudCover: number;
  weatherCode: number;
}

interface LocationResult {
  label: string;
  lat: number;
  lon: number;
}

// DepEd Leyte Division office — Government Center, Brgy. Candahug, Palo, Leyte.
// Coordinates confirmed via public place listing (not geocoded on the fly),
// used as the default preset so staff don't need to re-search it every time.
const DEPED_LEYTE_OFFICE: LocationResult = {
  label: 'DepEd Leyte Division Office (Government Center, Candahug, Palo)',
  lat: 11.22871,
  lon: 124.99832
};

const WEATHER_ICONS: Record<number, string> = {
  0: '☀️',
  1: '🌤️',
  2: '⛅',
  3: '☁️',
  45: '🌫️',
  48: '🌫️',
  51: '🌦️',
  53: '🌦️',
  55: '🌧️',
  56: '🌧️',
  57: '🌧️',
  61: '🌧️',
  63: '🌧️',
  65: '🌧️',
  66: '🌧️',
  67: '🌧️',
  71: '🌨️',
  73: '🌨️',
  75: '🌨️',
  77: '🌨️',
  80: '🌦️',
  81: '🌧️',
  82: '⛈️',
  85: '🌨️',
  86: '🌨️',
  95: '⛈️',
  96: '⛈️',
  99: '⛈️'
};

function weatherIcon(code: number): string {
  return WEATHER_ICONS[code] ?? '☁️';
}

function weatherLabel(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 48) return 'Foggy';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Rain showers';
  if (code <= 86) return 'Snow showers';
  return 'Thunderstorm';
}

@Component({
  selector: 'app-weather-outlook',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <h2>Today's Weather Outlook</h2>
      <p class="subtitle">
        Hourly forecast for a specific address — general public forecast data (Open-Meteo),
        not an official PAGASA advisory.
      </p>

      <div class="search-row card">
        <button class="btn btn-outline" (click)="loadPreset()">
          🏢 DepEd Leyte Division Office
        </button>
        <input
          [(ngModel)]="searchQuery"
          placeholder="Or search another address, e.g. a specific school…"
          (keyup.enter)="search()"
        />
        <button class="btn btn-primary" (click)="search()" [disabled]="searching()">
          {{ searching() ? 'Searching…' : 'Search' }}
        </button>
      </div>

      @if (error()) {
        <div class="card error-card">{{ error() }}</div>
      }

      @if (location()) {
        <div class="location-label">📍 {{ location()!.label }}</div>

        @if (loadingForecast()) {
          <div class="card empty-card">Loading forecast…</div>
        } @else if (hourly().length > 0) {
          <div class="card timeline-card">
            <div class="timeline">
              @for (h of hourly(); track h.time) {
                <div class="hour-block">
                  <div class="hour-label">{{ formatHour(h.time) }}</div>
                  <div class="hour-icon">{{ weatherIcon(h.weatherCode) }}</div>
                  <div class="hour-temp">{{ h.temperature | number: '1.0-0' }}°C</div>
                  <div class="hour-rain" [class.rain-high]="h.precipProbability >= 60">
                    💧{{ h.precipProbability }}%
                  </div>
                </div>
              }
            </div>
            <div class="condition-summary">
              {{ weatherLabel(hourly()[currentHourIndex()].weatherCode) }} right now — check back later
              in the day for changing conditions.
            </div>
          </div>
        }
      }
    </div>
  `,
  styles: [`
    h2 { color: var(--color-primary); margin-bottom: 0.25rem; }
    .subtitle { color: var(--color-text-muted); font-size: 0.85rem; margin-bottom: 1.25rem; max-width: 600px; }

    .search-row { display: flex; gap: 0.6rem; padding: 1rem; margin-bottom: 1rem; align-items: center; }
    .search-row input { flex: 1; }

    .error-card { padding: 1rem; color: var(--color-critical); }
    .empty-card { padding: 1.5rem; text-align: center; color: var(--color-text-muted); }

    .location-label { font-weight: 600; margin-bottom: 0.75rem; color: var(--color-text); }

    .timeline-card { padding: 1.25rem; }
    .timeline { display: flex; gap: 0.5rem; overflow-x: auto; padding-bottom: 0.5rem; }
    .hour-block {
      flex: 0 0 auto; width: 84px; text-align: center; padding: 0.75rem 0.4rem;
      border-radius: 8px; background: var(--color-bg);
    }
    .hour-label { font-size: 0.72rem; color: var(--color-text-muted); font-weight: 600; }
    .hour-icon { font-size: 1.8rem; margin: 0.4rem 0; }
    .hour-temp { font-size: 0.95rem; font-weight: 700; color: var(--color-text); }
    .hour-rain { font-size: 0.72rem; color: var(--color-info); margin-top: 0.2rem; }
    .hour-rain.rain-high { color: var(--color-critical); font-weight: 700; }
    .condition-summary { margin-top: 1rem; font-size: 0.85rem; color: var(--color-text-muted); }
  `]
})
export class WeatherOutlookComponent {
  searchQuery = '';
  searching = signal(false);
  loadingForecast = signal(false);
  error = signal<string | null>(null);
  location = signal<LocationResult | null>(null);
  hourly = signal<HourlyPoint[]>([]);
  currentHourIndex = signal(0);

  weatherIcon = weatherIcon;
  weatherLabel = weatherLabel;

  async loadPreset(): Promise<void> {
    this.location.set(DEPED_LEYTE_OFFICE);
    await this.fetchForecast(DEPED_LEYTE_OFFICE.lat, DEPED_LEYTE_OFFICE.lon);
  }

  async search(): Promise<void> {
    const query = this.searchQuery.trim();
    if (!query) return;
    this.error.set(null);
    this.searching.set(true);
    try {
      // Nominatim (OpenStreetMap) — free, public geocoding, no API key.
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ', Leyte, Philippines')}&format=json&limit=1`
      );
      const results = await res.json();
      if (!results || results.length === 0) {
        this.error.set('Could not find that address. Try a more specific query.');
        return;
      }
      const loc: LocationResult = {
        label: results[0].display_name,
        lat: parseFloat(results[0].lat),
        lon: parseFloat(results[0].lon)
      };
      this.location.set(loc);
      await this.fetchForecast(loc.lat, loc.lon);
    } catch {
      this.error.set('Address search failed. Please try again.');
    } finally {
      this.searching.set(false);
    }
  }

  private async fetchForecast(lat: number, lon: number): Promise<void> {
    this.loadingForecast.set(true);
    this.error.set(null);
    try {
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&hourly=temperature_2m,precipitation_probability,cloud_cover,weather_code` +
        `&forecast_days=1&timezone=Asia%2FManila`;
      const res = await fetch(url);
      const data = await res.json();

      const times: string[] = data.hourly?.time ?? [];
      const temps: number[] = data.hourly?.temperature_2m ?? [];
      const rain: number[] = data.hourly?.precipitation_probability ?? [];
      const clouds: number[] = data.hourly?.cloud_cover ?? [];
      const codes: number[] = data.hourly?.weather_code ?? [];

      const points: HourlyPoint[] = times.map((t, i) => ({
        time: t,
        temperature: temps[i],
        precipProbability: rain[i],
        cloudCover: clouds[i],
        weatherCode: codes[i]
      }));

      // Show every 3rd hour across the day (00:00, 03:00, ... 21:00) to keep
      // the timeline compact rather than showing all 24 hourly points.
      const compact = points.filter((_, i) => i % 3 === 0);
      this.hourly.set(compact);

      const nowHour = new Date().getHours();
      const closestIndex = points.reduce(
        (best, p, i) => (Math.abs(new Date(p.time).getHours() - nowHour) < Math.abs(new Date(points[best].time).getHours() - nowHour) ? i : best),
        0
      );
      this.currentHourIndex.set(Math.floor(closestIndex / 3));
    } catch {
      this.error.set('Could not load the forecast for this location.');
    } finally {
      this.loadingForecast.set(false);
    }
  }

  formatHour(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', hour12: true });
  }
}
