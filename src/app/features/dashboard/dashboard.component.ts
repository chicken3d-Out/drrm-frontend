import { Component, OnInit, OnDestroy, AfterViewInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { ApiService } from '../../core/services/api.service';
import { SocketService } from '../../core/services/socket.service';
import { DisasterEvent, School, SchoolDetail, AffectedSchool } from '../../core/models/models';
import { Subscription } from 'rxjs';

const DISASTER_ICONS: Record<string, string> = {
  earthquake: '🌎',
  tsunami: '🌊',
  volcano: '🌋',
  rainfall: '🌧',
  tropical_cyclone: '🌪',
  thunderstorm: '⛈',
  flood: '🌊',
  landslide: '⛰',
  wildfire: '🔥',
  storm_surge: '🌊',
  other: '⚠'
};

// RainViewer — free, public, no API key required.
// Docs: https://www.rainviewer.com/api.html
const RAINVIEWER_API = 'https://api.rainviewer.com/public/weather-maps.json';

// Open-Meteo — free, public, no API key required.
// Docs: https://open-meteo.com/en/docs
function openMeteoUrl(lat: number, lon: number): string {
  return `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=precipitation_probability_max,apparent_temperature_max,wind_speed_10m_max&timezone=auto`;
}

function openMeteoHourlyUrl(lat: number, lon: number): string {
  return `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation_probability,cloud_cover,weather_code&timezone=Asia%2FManila&forecast_days=1`;
}

// DepEd Leyte Division Government Center — Brgy. Candahug, Palo, Leyte.
// Coordinates are the barangay centroid (source: PhilAtlas census profile),
// not a surveyed building point — accurate enough for weather purposes.
const DEPED_LEYTE_HQ = { name: 'DepEd Leyte Government Center, Candahug, Palo', lat: 11.1791, lon: 125.0104 };

// WMO weather codes (used by Open-Meteo) mapped to a simple icon + label.
// Reference: https://open-meteo.com/en/docs (WMO Weather interpretation codes)
const WMO_ICON: Record<number, { icon: string; label: string }> = {
  0: { icon: '☀️', label: 'Clear' },
  1: { icon: '🌤', label: 'Mostly clear' },
  2: { icon: '⛅', label: 'Partly cloudy' },
  3: { icon: '☁️', label: 'Overcast' },
  45: { icon: '🌫', label: 'Fog' },
  48: { icon: '🌫', label: 'Fog' },
  51: { icon: '🌦', label: 'Light drizzle' },
  53: { icon: '🌦', label: 'Drizzle' },
  55: { icon: '🌦', label: 'Dense drizzle' },
  61: { icon: '🌧', label: 'Light rain' },
  63: { icon: '🌧', label: 'Rain' },
  65: { icon: '🌧', label: 'Heavy rain' },
  80: { icon: '🌧', label: 'Rain showers' },
  81: { icon: '🌧', label: 'Rain showers' },
  82: { icon: '🌧', label: 'Violent showers' },
  95: { icon: '⛈', label: 'Thunderstorm' },
  96: { icon: '⛈', label: 'Thunderstorm w/ hail' },
  99: { icon: '⛈', label: 'Severe thunderstorm' }
};

function wmoIcon(code: number): { icon: string; label: string } {
  return WMO_ICON[code] ?? { icon: '🌡', label: 'Unknown' };
}

function parseMagnitude(warningLevel: string | null): number | null {
  if (!warningLevel) return null;
  const match = warningLevel.match(/M\s*([\d.]+)/i);
  return match ? parseFloat(match[1]) : null;
}

interface HourlyForecastPoint {
  hourLabel: string;
  icon: string;
  label: string;
  temp: number;
  precipProbability: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard">
      <div class="cards-row">
        <div class="stat-card card">
          <div class="stat-label">Active Alerts</div>
          <div class="stat-value">{{ events().length }}</div>
        </div>
        <div class="stat-card card leyte">
          <div class="stat-label">Leyte Alerts</div>
          <div class="stat-value">{{ leyteEventCount() }}</div>
        </div>
        <div class="stat-card card">
          <div class="stat-label">Affected Schools</div>
          <div class="stat-value">{{ affectedSchoolsCount() }}</div>
        </div>
        <div class="stat-card card">
          <div class="stat-label">Earthquakes</div>
          <div class="stat-value">{{ countByType('earthquake') }}</div>
        </div>
        <div class="stat-card card">
          <div class="stat-label">Weather Alerts</div>
          <div class="stat-value">{{ countByType('rainfall') + countByType('tropical_cyclone') }}</div>
        </div>
      </div>

      <div class="main-row">
        <div class="map-panel card">
          <div class="map-toolbar">
            <button class="btn btn-outline" (click)="toggleRadar()">
              {{ radarOn() ? '☑' : '☐' }} Precipitation Radar
            </button>
            @if (radarOn()) {
              <button class="btn btn-outline" (click)="toggleRadarPlayback()">
                {{ radarPlaying() ? '⏸ Pause' : '▶ Play' }}
              </button>
              <span class="radar-time">{{ radarFrameLabel() }}</span>
              <span class="radar-legend">
                <span class="legend-chip" style="background:#4a90d9"></span> Light
                <span class="legend-chip" style="background:#4ac94a"></span> Moderate
                <span class="legend-chip" style="background:#f2c94c"></span> Heavy
                <span class="legend-chip" style="background:#e05c2e"></span> Intense
                <span class="legend-chip" style="background:#c0392b"></span> Extreme
              </span>
            }
            <span class="hint">Click anywhere on the map for today's weather outlook</span>
          </div>
          <div id="map" style="height: 500px; border-radius: 8px;"></div>

          <button class="btn btn-outline hq-forecast-toggle" (click)="toggleHqForecast()">
            🌤 {{ showHqForecast() ? 'Hide' : 'Show' }} Today's Forecast — DepEd Leyte Government Center
          </button>

          @if (showHqForecast()) {
            <div class="hq-forecast-panel">
              @if (hqForecastLoading()) {
                <div class="hq-forecast-loading">Loading hourly forecast…</div>
              } @else if (hqForecast().length === 0) {
                <div class="hq-forecast-loading">Could not load forecast data.</div>
              } @else {
                <div class="hq-forecast-strip">
                  @for (h of hqForecast(); track h.hourLabel) {
                    <div class="hq-hour">
                      <div class="hq-hour-time">{{ h.hourLabel }}</div>
                      <div class="hq-hour-icon">{{ h.icon }}</div>
                      <div class="hq-hour-temp">{{ h.temp }}°C</div>
                      <div class="hq-hour-precip">💧{{ h.precipProbability }}%</div>
                    </div>
                  }
                </div>
                <div class="hq-forecast-note">
                  Live hourly forecast (Open-Meteo) for Brgy. Candahug, Palo, Leyte — general public forecast data, not an official PAGASA advisory.
                </div>
              }
            </div>
          }
        </div>

        <div class="alerts-panel card">
          <div class="panel-title">ACTIVE ALERTS</div>
          <div class="alerts-list">
            @for (ev of events(); track ev.id) {
              <div class="alert-item">
                <div class="alert-row" (click)="focusEvent(ev)">
                  <div class="alert-icon">{{ icon(ev.disaster_type) }}</div>
                  <div class="alert-body">
                    <div class="alert-title">{{ ev.official_title }}</div>
                    <div class="alert-meta">
                      <span class="badge" [class]="'badge-' + priorityClass(ev)">{{ ev.source_agency }}</span>
                      @if (ev.warning_level) { <span class="level">{{ ev.warning_level }}</span> }
                    </div>
                  </div>
                </div>
                <button class="affected-toggle" (click)="toggleAffectedSchools(ev, $event)">
                  🏫 {{ expandedEventId() === ev.id ? 'Hide' : 'Show' }} affected schools
                </button>
                @if (expandedEventId() === ev.id) {
                  <div class="affected-list">
                    @if (loadingAffected()) {
                      <div class="affected-empty">Loading…</div>
                    } @else if ((affectedSchoolsByEvent().get(ev.id) ?? []).length === 0) {
                      <div class="affected-empty">No schools within range of this event.</div>
                    } @else {
                      @for (s of affectedSchoolsByEvent().get(ev.id); track s.id) {
                        <div class="affected-school-row">
                          <span class="badge" [class]="s.priority === 'high' ? 'badge-critical' : 'badge-moderate'">
                            {{ s.priority === 'high' ? 'High' : 'Potential' }}
                          </span>
                          <span class="affected-name">{{ s.name }}</span>
                          <span class="affected-dist">{{ s.distance_km | number: '1.1-1' }} km</span>
                        </div>
                      }
                    }
                  </div>
                }
              </div>
            } @empty {
              <div class="empty">No active alerts at this time.</div>
            }
          </div>
        </div>
      </div>

      <div class="disclaimer card">
        <strong>Important:</strong> This system aggregates information from official government and public satellite sources for monitoring and disaster risk reduction purposes. Official warnings, advisories, and instructions issued by PAGASA, PHIVOLCS, and other authorized government agencies remain the authoritative source. Always follow official government instructions during emergencies. Precipitation radar (RainViewer) and click-anywhere weather (Open-Meteo) are general public forecast data, not official PAGASA advisories.
      </div>
    </div>
  `,
  styles: [`
    .dashboard { display: flex; flex-direction: column; gap: 1rem; }
    .cards-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; }
    .stat-card { padding: 1rem; }
    .stat-card.leyte { border-left: 4px solid var(--color-primary); }
    .stat-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--color-text-muted); letter-spacing: 0.03em; }
    .stat-value { font-size: 1.9rem; font-weight: 700; color: var(--color-primary); margin-top: 0.25rem; }

    .main-row { display: grid; grid-template-columns: 2.2fr 1fr; gap: 1rem; align-items: start; }
    .map-panel { padding: 0.75rem; }
    .hq-forecast-toggle { width: 100%; margin-top: 0.6rem; font-size: 0.8rem; padding: 0.5rem; }
    .hq-forecast-panel { margin-top: 0.6rem; border-top: 1px solid var(--color-border); padding-top: 0.6rem; }
    .hq-forecast-loading { text-align: center; color: var(--color-text-muted); font-size: 0.85rem; padding: 1rem; }
    .hq-forecast-strip { display: flex; gap: 0.5rem; overflow-x: auto; padding-bottom: 0.4rem; }
    .hq-hour {
      flex: 0 0 auto; width: 64px; text-align: center; padding: 0.5rem 0.3rem; border-radius: 8px;
      background: var(--color-primary-light);
    }
    .hq-hour-time { font-size: 0.68rem; font-weight: 700; color: var(--color-text-muted); }
    .hq-hour-icon { font-size: 1.4rem; margin: 0.15rem 0; }
    .hq-hour-temp { font-size: 0.78rem; font-weight: 700; }
    .hq-hour-precip { font-size: 0.68rem; color: var(--color-text-muted); }
    .hq-forecast-note { font-size: 0.72rem; color: var(--color-text-muted); margin-top: 0.4rem; text-align: center; }
    .map-toolbar { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.6rem; flex-wrap: wrap; }
    .map-toolbar .btn { padding: 0.4rem 0.75rem; font-size: 0.8rem; }
    .radar-time { font-size: 0.78rem; color: var(--color-text-muted); font-weight: 600; }
    .radar-legend { display: flex; align-items: center; gap: 0.3rem; font-size: 0.72rem; color: var(--color-text-muted); }
    .legend-chip { width: 10px; height: 10px; border-radius: 2px; display: inline-block; margin-left: 0.4rem; }
    .hint { font-size: 0.76rem; color: var(--color-text-muted); margin-left: auto; }

    .alerts-panel { padding: 1rem; max-height: 560px; overflow-y: auto; }
    .panel-title { font-size: 0.78rem; font-weight: 700; color: var(--color-text-muted); letter-spacing: 0.03em; margin-bottom: 0.75rem; }

    .alert-item { border-bottom: 1px solid var(--color-border); padding: 0.4rem 0; }
    .alert-item:last-child { border-bottom: none; }
    .alert-row { display: flex; gap: 0.6rem; padding: 0.2rem 0; cursor: pointer; }
    .alert-row:hover { background: var(--color-primary-light); }
    .alert-icon { font-size: 1.3rem; }
    .alert-title { font-size: 0.88rem; font-weight: 600; }
    .alert-meta { display: flex; gap: 0.4rem; align-items: center; margin-top: 0.2rem; }
    .level { font-size: 0.78rem; color: var(--color-text-muted); }
    .empty { color: var(--color-text-muted); font-size: 0.85rem; padding: 1rem 0; text-align: center; }

    .affected-toggle {
      background: none; border: none; color: var(--color-primary); font-size: 0.76rem; font-weight: 600;
      cursor: pointer; padding: 0.2rem 0 0.3rem 2rem;
    }
    .affected-toggle:hover { text-decoration: underline; }
    .affected-list { padding-left: 2rem; padding-bottom: 0.4rem; display: flex; flex-direction: column; gap: 0.3rem; }
    .affected-empty { font-size: 0.78rem; color: var(--color-text-muted); }
    .affected-school-row { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; }
    .affected-name { flex: 1; }
    .affected-dist { color: var(--color-text-muted); font-size: 0.75rem; }

    .disclaimer { padding: 0.85rem 1rem; font-size: 0.78rem; color: var(--color-text-muted); }
  `]
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  events = signal<DisasterEvent[]>([]);
  schools = signal<School[]>([]);
  affectedSchoolsCount = signal(0);
  radarOn = signal(false);
  radarPlaying = signal(false);
  radarFrameLabel = signal('');
  expandedEventId = signal<string | null>(null);
  showHqForecast = signal(false);
  hqForecastLoading = signal(false);
  hqForecast = signal<HourlyForecastPoint[]>([]);
  loadingAffected = signal(false);
  affectedSchoolsByEvent = signal<Map<string, AffectedSchool[]>>(new Map());

  private map: L.Map | null = null;
  private eventsLayer: L.LayerGroup | null = null;
  private schoolsLayer: L.LayerGroup | null = null;
  private radarLayer: L.LayerGroup | null = null;
  private socketSub: Subscription | null = null;

  private radarFrames: { time: number; path: string }[] = [];
  private radarHost = '';
  private radarFrameIndex = 0;
  private radarTimer: ReturnType<typeof setInterval> | null = null;

  private rippleAnimations = new Map<string, ReturnType<typeof setInterval>>();
  private trackAnimations = new Map<string, number>(); // requestAnimationFrame handles

  leyteEventCount = computed(() => this.events().filter((e) => e.is_leyte_priority).length);

  constructor(private api: ApiService, private socket: SocketService) {}

  async ngOnInit(): Promise<void> {
    await this.loadEvents();
    await this.loadSchools();
    await this.loadAffectedSchoolsSummary();

    this.socketSub = this.socket.events$.subscribe((evt) => {
      if (evt.type === 'disaster:new' || evt.type === 'disaster:updated' || evt.type === 'school:affected') {
        this.loadEvents();
        this.loadAffectedSchoolsSummary();
      }
    });
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    this.socketSub?.unsubscribe();
    if (this.radarTimer) clearInterval(this.radarTimer);
    for (const timer of this.rippleAnimations.values()) clearInterval(timer);
    for (const handle of this.trackAnimations.values()) cancelAnimationFrame(handle);
    this.map?.remove();
  }

  private async loadEvents(): Promise<void> {
    const data = await this.api.get<DisasterEvent[]>('/events/active');
    this.events.set(data);
    this.plotEvents();
  }

  private async loadSchools(): Promise<void> {
    const data = await this.api.get<School[]>('/schools', { municipality: '' });
    this.schools.set(data);
    this.plotSchools();
  }

  private async loadAffectedSchoolsSummary(): Promise<void> {
    try {
      const res = await this.api.get<{ count: number }>('/events/affected-schools/summary');
      this.affectedSchoolsCount.set(res.count);
    } catch {
      // Non-critical — leave the previous value rather than showing an error.
    }
  }

  async toggleAffectedSchools(ev: DisasterEvent, mouseEvent: MouseEvent): Promise<void> {
    mouseEvent.stopPropagation(); // don't also trigger focusEvent's map pan/ripple
    if (this.expandedEventId() === ev.id) {
      this.expandedEventId.set(null);
      return;
    }
    this.expandedEventId.set(ev.id);

    if (!this.affectedSchoolsByEvent().has(ev.id)) {
      this.loadingAffected.set(true);
      try {
        const schools = await this.api.get<AffectedSchool[]>(`/events/${ev.id}/affected-schools`);
        const updated = new Map(this.affectedSchoolsByEvent());
        updated.set(ev.id, schools);
        this.affectedSchoolsByEvent.set(updated);
      } finally {
        this.loadingAffected.set(false);
      }
    }
  }

  async toggleHqForecast(): Promise<void> {
    const opening = !this.showHqForecast();
    this.showHqForecast.set(opening);
    if (opening && this.hqForecast().length === 0) {
      await this.loadHqForecast();
    }
  }

  private async loadHqForecast(): Promise<void> {
    this.hqForecastLoading.set(true);
    try {
      const res = await fetch(openMeteoHourlyUrl(DEPED_LEYTE_HQ.lat, DEPED_LEYTE_HQ.lon));
      const data = await res.json();
      const times: string[] = data.hourly?.time ?? [];
      const temps: number[] = data.hourly?.temperature_2m ?? [];
      const precip: number[] = data.hourly?.precipitation_probability ?? [];
      const codes: number[] = data.hourly?.weather_code ?? [];

      const points: HourlyForecastPoint[] = times.map((t, i) => {
        const hour = new Date(t).getHours();
        const { icon, label } = wmoIcon(codes[i]);
        return {
          hourLabel: hour === 0 ? '12AM' : hour < 12 ? `${hour}AM` : hour === 12 ? '12PM' : `${hour - 12}PM`,
          icon,
          label,
          temp: Math.round(temps[i]),
          precipProbability: precip[i] ?? 0
        };
      });
      this.hqForecast.set(points);
    } catch {
      this.hqForecast.set([]);
    } finally {
      this.hqForecastLoading.set(false);
    }
  }

  private initMap(): void {
    // Centered on Leyte Province per spec section 38 (default map priority).
    this.map = L.map('map').setView([10.85, 124.85], 9);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    this.eventsLayer = L.layerGroup().addTo(this.map);
    this.schoolsLayer = L.layerGroup().addTo(this.map);
    this.radarLayer = L.layerGroup();

    L.control.layers(
      undefined,
      {
        'Disaster Events': this.eventsLayer,
        'DepEd Schools': this.schoolsLayer,
        'Precipitation Radar': this.radarLayer
      },
      { position: 'topright', collapsed: false }
    ).addTo(this.map);

    // Click-anywhere weather popup (Open-Meteo).
    this.map.on('click', (e: L.LeafletMouseEvent) => this.showWeatherPopup(e.latlng));

    this.plotEvents();
    this.plotSchools();
  }

  private plotEvents(): void {
    if (!this.map || !this.eventsLayer) return;
    this.eventsLayer.clearLayers();

    for (const ev of this.events()) {
      if (ev.latitude == null || ev.longitude == null) continue;

      const marker = L.circleMarker([ev.latitude, ev.longitude], {
        radius: 8,
        color: ev.is_leyte_priority ? '#02542D' : '#8a8a8a',
        fillColor: ev.is_leyte_priority ? '#02542D' : '#8a8a8a',
        fillOpacity: 0.7
      });
      marker.bindPopup(
        `<strong>${this.icon(ev.disaster_type)} ${ev.official_title}</strong><br/>` +
          `${ev.source_agency}${ev.warning_level ? ' — ' + ev.warning_level : ''}<br/>` +
          `<em>Official government warnings remain authoritative.</em>`
      );

      if (ev.disaster_type === 'earthquake') {
        marker.on('click', () => this.animateEarthquakeRipple(ev));
      }

      marker.addTo(this.eventsLayer);

      // Typhoon track animation, if this event has a stored track.
      if (ev.disaster_type === 'tropical_cyclone' && ev.track && ev.track.length > 1) {
        this.animateStormTrack(ev);
      }
    }
  }

  private plotSchools(): void {
    if (!this.map || !this.schoolsLayer) return;
    this.schoolsLayer.clearLayers();
    for (const s of this.schools()) {
      if (s.latitude == null || s.longitude == null) continue;
      const baseRadius = 7;
      const marker = L.circleMarker([s.latitude, s.longitude], {
        radius: baseRadius,
        color: '#ffffff',
        weight: 1.5,
        fillColor: '#2f6690',
        fillOpacity: 0.85
      });
      // Bind a quick placeholder immediately (so the popup opens instantly),
      // then fetch the full record and swap in the detailed content.
      marker.bindPopup(`🏫 <strong>${s.name}</strong><br/><em>Loading details…</em>`);
      marker.on('popupopen', () => this.loadSchoolDetail(s.id, marker));
      // Slightly grow on hover so small, closely-packed school clusters are
      // easier to target with the mouse.
      marker.on('mouseover', () => marker.setRadius(baseRadius + 3));
      marker.on('mouseout', () => marker.setRadius(baseRadius));
      marker.addTo(this.schoolsLayer);
    }
  }

  private async loadSchoolDetail(schoolId: string, marker: L.CircleMarker): Promise<void> {
    try {
      const detail = await this.api.get<SchoolDetail>(`/schools/${schoolId}`);
      const contactsHtml = (detail.contacts ?? [])
        .map((c) => `${this.contactLabel(c.contact_type)}: ${c.name ?? '—'}${c.phone ? ' · ' + c.phone : ''}`)
        .join('<br/>');

      const content = `
        <strong>🏫 ${detail.name}</strong><br/>
        <span style="color:#5b6b62;font-size:0.85em">${detail.school_id}</span><br/><br/>
        <strong>Type:</strong> ${detail.school_type}<br/>
        <strong>District:</strong> ${detail.district ?? '—'}<br/>
        <strong>Municipality:</strong> ${detail.municipality}<br/>
        <strong>Barangay:</strong> ${detail.barangay ?? '—'}<br/>
        <strong>Status:</strong> ${detail.status}
        ${contactsHtml ? `<br/><br/><strong>Contacts:</strong><br/>${contactsHtml}` : ''}
      `;
      marker.setPopupContent(content);
    } catch {
      marker.setPopupContent('Could not load school details.');
    }
  }

  private contactLabel(type: string): string {
    if (type === 'school_head') return 'School Head';
    if (type === 'drrm_coordinator') return 'DRRM Coordinator';
    return 'Office';
  }

  // ── Earthquake ripple animation ────────────────────────────────────────
  // Expanding, fading ring scaled by reported magnitude — a visual cue only,
  // clearly distinct from the official USGS/PHIVOLCS bulletin shown in the popup.
  private animateEarthquakeRipple(ev: DisasterEvent): void {
    if (!this.map || ev.latitude == null || ev.longitude == null) return;
    const existing = this.rippleAnimations.get(ev.id);
    if (existing) clearInterval(existing);

    const magnitude = parseMagnitude(ev.warning_level) ?? 4;
    const maxRadiusPx = 24 + magnitude * 9;
    const durationMs = 1400;
    const cycles = 3;
    let cycle = 0;
    let t = 0;

    const ring = L.circleMarker([ev.latitude, ev.longitude], {
      radius: 8,
      color: '#c0392b',
      weight: 2,
      fillOpacity: 0,
      opacity: 0.9
    }).addTo(this.map);

    const stepMs = 40;
    const steps = durationMs / stepMs;

    const timer = setInterval(() => {
      t++;
      const progress = t / steps;
      const radius = 8 + (maxRadiusPx - 8) * progress;
      ring.setRadius(radius);
      ring.setStyle({ opacity: 0.9 * (1 - progress) });

      if (t >= steps) {
        t = 0;
        cycle++;
        ring.setRadius(8);
        if (cycle >= cycles) {
          clearInterval(timer);
          this.rippleAnimations.delete(ev.id);
          this.map?.removeLayer(ring);
        }
      }
    }, stepMs);

    this.rippleAnimations.set(ev.id, timer);
  }

  // ── Typhoon track animation ─────────────────────────────────────────────
  // Draws the storm's historical path and animates a marker moving along it.
  private animateStormTrack(ev: DisasterEvent): void {
    if (!this.map || !this.eventsLayer || !ev.track) return;
    const latlngs = ev.track.map((p) => L.latLng(p.lat, p.lon));

    // Bold magenta/red track line (matches standard storm-tracker styling —
    // e.g. Windy/JTWC-style maps) with a white halo underneath for contrast
    // against both dark radar tiles and light basemap.
    L.polyline(latlngs, { color: '#ffffff', weight: 6, opacity: 0.9 }).addTo(this.eventsLayer);
    L.polyline(latlngs, { color: '#d6006e', weight: 3.5, opacity: 0.95 }).addTo(this.eventsLayer);
    for (const pt of latlngs) {
      L.circleMarker(pt, { radius: 5, color: '#ffffff', weight: 1.5, fillColor: '#d6006e', fillOpacity: 1 }).addTo(
        this.eventsLayer!
      );
    }

    const stormIcon = L.divIcon({
      html: '<div style="font-size:26px;filter:drop-shadow(0 0 3px white) drop-shadow(0 0 3px white);">🌀</div>',
      className: 'storm-icon',
      iconSize: [36, 36]
    });
    const movingMarker = L.marker(latlngs[0], { icon: stormIcon, zIndexOffset: 1000 }).addTo(this.eventsLayer);

    const totalDurationMs = 4000;
    const segmentCount = latlngs.length - 1;
    let startTime: number | null = null;

    const animate = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / totalDurationMs, 1);
      const segmentProgress = progress * segmentCount;
      const segmentIndex = Math.min(Math.floor(segmentProgress), segmentCount - 1);
      const localProgress = segmentProgress - segmentIndex;

      const from = latlngs[segmentIndex];
      const to = latlngs[segmentIndex + 1] ?? from;
      const lat = from.lat + (to.lat - from.lat) * localProgress;
      const lng = from.lng + (to.lng - from.lng) * localProgress;
      movingMarker.setLatLng([lat, lng]);

      if (progress < 1) {
        const handle = requestAnimationFrame(animate);
        this.trackAnimations.set(ev.id, handle);
      } else {
        // Loop the animation for as long as the event stays active.
        startTime = null;
        const handle = requestAnimationFrame(animate);
        this.trackAnimations.set(ev.id, handle);
      }
    };

    const handle = requestAnimationFrame(animate);
    this.trackAnimations.set(ev.id, handle);
  }

  // ── Precipitation radar (RainViewer) ────────────────────────────────────
  async toggleRadar(): Promise<void> {
    if (!this.map || !this.radarLayer) return;
    const turningOn = !this.radarOn();
    this.radarOn.set(turningOn);

    if (turningOn) {
      if (this.radarFrames.length === 0) {
        await this.loadRadarFrames();
      }
      this.showRadarFrame(this.radarFrames.length - 1); // start on most recent frame
      this.map.addLayer(this.radarLayer);
    } else {
      this.stopRadarPlayback();
      this.map.removeLayer(this.radarLayer);
    }
  }

  toggleRadarPlayback(): void {
    if (this.radarPlaying()) {
      this.stopRadarPlayback();
    } else {
      this.radarPlaying.set(true);
      this.radarTimer = setInterval(() => {
        this.radarFrameIndex = (this.radarFrameIndex + 1) % this.radarFrames.length;
        this.showRadarFrame(this.radarFrameIndex);
      }, 700);
    }
  }

  private stopRadarPlayback(): void {
    if (this.radarTimer) {
      clearInterval(this.radarTimer);
      this.radarTimer = null;
    }
    this.radarPlaying.set(false);
  }

  private async loadRadarFrames(): Promise<void> {
    try {
      const res = await fetch(RAINVIEWER_API);
      const data = await res.json();
      this.radarHost = data.host;
      // Combine recent past frames with nowcast (forecast) frames for a
      // fuller animation window.
      this.radarFrames = [...(data.radar?.past ?? []), ...(data.radar?.nowcast ?? [])];
    } catch {
      this.radarFrames = [];
      this.radarFrameLabel.set('Radar unavailable');
    }
  }

  private showRadarFrame(index: number): void {
    if (!this.radarLayer || !this.radarFrames[index]) return;
    this.radarFrameIndex = index;
    const frame = this.radarFrames[index];

    this.radarLayer.clearLayers();
    // Color scheme 4 = "The Weather Channel" palette (blue → green → yellow →
    // orange → red), matching the legend shown in the toolbar. RainViewer
    // supports schemes 0-8 if a different palette is ever preferred —
    // see https://www.rainviewer.com/api.html for the full list.
    //
    // maxNativeZoom caps the zoom level actually requested from RainViewer's
    // tile server — beyond that, Leaflet upscales the highest available tile
    // client-side instead of requesting a zoom level RainViewer doesn't serve.
    // Per RainViewer's own docs, 7 is the actual maximum — confirmed via
    // https://www.rainviewer.com/api/weather-maps-api.html (previously set to
    // 8 here, which was one level too high and caused the "zoom level not
    // supported" tile error).
    // 512px tiles (vs 256) roughly double the pixel density for the same
    // geographic coverage per tile — noticeably less blocky when the map is
    // zoomed in, since the underlying radar data isn't being stretched as far.
    // (RainViewer's own reference client does the same: same {z}/{x}/{y}
    // scheme, just a bigger PNG per tile — no zoomOffset needed.)
    const tileLayer = L.tileLayer(`${this.radarHost}${frame.path}/512/{z}/{x}/{y}/4/1_1.png`, {
      tileSize: 512,
      opacity: 0.75,
      maxNativeZoom: 7,
      minNativeZoom: 0,
      attribution: 'Radar &copy; RainViewer'
    });
    tileLayer.on('tileerror', () => {
      // Non-fatal — a handful of edge tiles failing shouldn't break the layer.
    });
    tileLayer.addTo(this.radarLayer);

    const label = new Date(frame.time * 1000).toLocaleString('en-PH', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    this.radarFrameLabel.set(label);
  }

  // ── Click-anywhere weather (Open-Meteo) ─────────────────────────────────
  private async showWeatherPopup(latlng: L.LatLng): Promise<void> {
    if (!this.map) return;
    const popup = L.popup()
      .setLatLng(latlng)
      .setContent('<em>Loading today\'s weather outlook…</em>')
      .openOn(this.map);

    try {
      const res = await fetch(openMeteoUrl(latlng.lat, latlng.lng));
      const data = await res.json();
      const precip = data.daily?.precipitation_probability_max?.[0];
      const heatIndex = data.daily?.apparent_temperature_max?.[0];
      const wind = data.daily?.wind_speed_10m_max?.[0];

      popup.setContent(
        `<strong>Today's Weather Outlook</strong><br/>` +
          `Precipitation chance: ${precip != null ? precip + '%' : '—'}<br/>` +
          `Feels like (heat index): ${heatIndex != null ? heatIndex + '°C' : '—'}<br/>` +
          `Max wind speed: ${wind != null ? wind + ' km/h' : '—'}<br/>` +
          `<em style="font-size:0.75em">General forecast (Open-Meteo), not an official PAGASA advisory.</em>`
      );
    } catch {
      popup.setContent('Could not load weather data for this location.');
    }
  }

  focusEvent(ev: DisasterEvent): void {
    if (!this.map || ev.latitude == null || ev.longitude == null) return;
    this.map.setView([ev.latitude, ev.longitude], 11);
    if (ev.disaster_type === 'earthquake') this.animateEarthquakeRipple(ev);
  }

  icon(type: string): string {
    return DISASTER_ICONS[type] ?? '⚠';
  }

  countByType(type: string): number {
    return this.events().filter((e) => e.disaster_type === type).length;
  }

  priorityClass(ev: DisasterEvent): string {
    if (ev.disaster_type === 'earthquake' || ev.disaster_type === 'tsunami') return 'critical';
    if (ev.is_leyte_priority) return 'high';
    return 'information';
  }
}
