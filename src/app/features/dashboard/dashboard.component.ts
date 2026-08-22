import { Component, OnInit, OnDestroy, AfterViewInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { ApiService } from '../../core/services/api.service';
import { SocketService } from '../../core/services/socket.service';
import { DisasterEvent, School } from '../../core/models/models';
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

function parseMagnitude(warningLevel: string | null): number | null {
  if (!warningLevel) return null;
  const match = warningLevel.match(/M\s*([\d.]+)/i);
  return match ? parseFloat(match[1]) : null;
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
            }
            <span class="hint">Click anywhere on the map for today's weather outlook</span>
          </div>
          <div id="map" style="height: 500px; border-radius: 8px;"></div>
        </div>

        <div class="alerts-panel card">
          <div class="panel-title">ACTIVE ALERTS</div>
          <div class="alerts-list">
            @for (ev of events(); track ev.id) {
              <div class="alert-item" (click)="focusEvent(ev)">
                <div class="alert-icon">{{ icon(ev.disaster_type) }}</div>
                <div class="alert-body">
                  <div class="alert-title">{{ ev.official_title }}</div>
                  <div class="alert-meta">
                    <span class="badge" [class]="'badge-' + priorityClass(ev)">{{ ev.source_agency }}</span>
                    @if (ev.warning_level) { <span class="level">{{ ev.warning_level }}</span> }
                  </div>
                </div>
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
    .map-toolbar { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.6rem; flex-wrap: wrap; }
    .map-toolbar .btn { padding: 0.4rem 0.75rem; font-size: 0.8rem; }
    .radar-time { font-size: 0.78rem; color: var(--color-text-muted); font-weight: 600; }
    .hint { font-size: 0.76rem; color: var(--color-text-muted); margin-left: auto; }

    .alerts-panel { padding: 1rem; max-height: 560px; overflow-y: auto; }
    .panel-title { font-size: 0.78rem; font-weight: 700; color: var(--color-text-muted); letter-spacing: 0.03em; margin-bottom: 0.75rem; }

    .alert-item { display: flex; gap: 0.6rem; padding: 0.6rem 0; border-bottom: 1px solid var(--color-border); cursor: pointer; }
    .alert-item:hover { background: var(--color-primary-light); }
    .alert-item:last-child { border-bottom: none; }
    .alert-icon { font-size: 1.3rem; }
    .alert-title { font-size: 0.88rem; font-weight: 600; }
    .alert-meta { display: flex; gap: 0.4rem; align-items: center; margin-top: 0.2rem; }
    .level { font-size: 0.78rem; color: var(--color-text-muted); }
    .empty { color: var(--color-text-muted); font-size: 0.85rem; padding: 1rem 0; text-align: center; }

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

    this.socketSub = this.socket.events$.subscribe((evt) => {
      if (evt.type === 'disaster:new' || evt.type === 'disaster:updated') {
        this.loadEvents();
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
      const marker = L.circleMarker([s.latitude, s.longitude], {
        radius: 4,
        color: '#4a6b8a',
        fillColor: '#4a6b8a',
        fillOpacity: 0.6
      });
      marker.bindPopup(`🏫 <strong>${s.name}</strong><br/>${s.municipality}`);
      marker.addTo(this.schoolsLayer);
    }
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

    L.polyline(latlngs, { color: '#e07b1a', weight: 2, dashArray: '4 4' }).addTo(this.eventsLayer);
    for (const pt of latlngs) {
      L.circleMarker(pt, { radius: 3, color: '#e07b1a', fillOpacity: 0.8 }).addTo(this.eventsLayer!);
    }

    const stormIcon = L.divIcon({ html: '🌀', className: 'storm-icon', iconSize: [24, 24] });
    const movingMarker = L.marker(latlngs[0], { icon: stormIcon }).addTo(this.eventsLayer);

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
    const tileLayer = L.tileLayer(`${this.radarHost}${frame.path}/256/{z}/{x}/{y}/4/1_1.png`, {
      opacity: 0.6,
      attribution: 'Radar &copy; RainViewer'
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
