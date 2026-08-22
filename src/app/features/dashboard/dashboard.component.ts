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
          <div id="map" style="height: 520px; border-radius: 8px;"></div>
        </div>

        <div class="alerts-panel card">
          <div class="panel-title">ACTIVE ALERTS</div>
          <div class="alerts-list">
            @for (ev of events(); track ev.id) {
              <div class="alert-item">
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
        <strong>Important:</strong> This system aggregates information from official government and public satellite sources for monitoring and disaster risk reduction purposes. Official warnings, advisories, and instructions issued by PAGASA, PHIVOLCS, and other authorized government agencies remain the authoritative source. Always follow official government instructions during emergencies.
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
    .alerts-panel { padding: 1rem; max-height: 560px; overflow-y: auto; }
    .panel-title { font-size: 0.78rem; font-weight: 700; color: var(--color-text-muted); letter-spacing: 0.03em; margin-bottom: 0.75rem; }

    .alert-item { display: flex; gap: 0.6rem; padding: 0.6rem 0; border-bottom: 1px solid var(--color-border); }
    .alert-item:last-child { border-bottom: none; }
    .alert-icon { font-size: 1.3rem; }
    .alert-title { font-size: 0.88rem; font-weight: 600; }
    .alert-meta { display: flex; gap: 0.4rem; align-items: center; margin-top: 0.2rem; }
    .level { font-size: 0.78rem; color: var(--color-text-muted); }
    .empty { color: var(--color-text-muted); font-size: 0.85rem; padding: 1rem 0; text-align: center; }

    .disclaimer { padding: 0.85rem 1rem; font-size: 0.8rem; color: var(--color-text-muted); }
  `]
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  events = signal<DisasterEvent[]>([]);
  schools = signal<School[]>([]);
  affectedSchoolsCount = signal(0);

  private map: L.Map | null = null;
  private markersLayer: L.LayerGroup | null = null;
  private socketSub: Subscription | null = null;

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
    this.markersLayer = L.layerGroup().addTo(this.map);
    this.plotEvents();
    this.plotSchools();
  }

  private plotEvents(): void {
    if (!this.map || !this.markersLayer) return;
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
      marker.addTo(this.markersLayer);
    }
  }

  private plotSchools(): void {
    if (!this.map || !this.markersLayer) return;
    for (const s of this.schools()) {
      if (s.latitude == null || s.longitude == null) continue;
      const marker = L.circleMarker([s.latitude, s.longitude], {
        radius: 4,
        color: '#4a6b8a',
        fillColor: '#4a6b8a',
        fillOpacity: 0.6
      });
      marker.bindPopup(`🏫 <strong>${s.name}</strong><br/>${s.municipality}`);
      marker.addTo(this.markersLayer);
    }
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
