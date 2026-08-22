import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { DisasterEvent, AffectedSchool } from '../../core/models/models';

type AlertColor = 'red' | 'orange' | 'yellow' | 'unspecified';

interface SchoolAlertRow {
  school: AffectedSchool;
  color: AlertColor;
  eventTitles: string[];
}

const COLOR_RANK: Record<AlertColor, number> = { red: 3, orange: 2, yellow: 1, unspecified: 0 };

function extractColor(warningLevel: string | null): AlertColor {
  if (!warningLevel) return 'unspecified';
  const w = warningLevel.toLowerCase();
  if (w.includes('red')) return 'red';
  if (w.includes('orange')) return 'orange';
  if (w.includes('yellow')) return 'yellow';
  return 'unspecified';
}

@Component({
  selector: 'app-rainfall-report',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page">
      <h2>Rainfall Warning — Affected Schools Report</h2>
      <p class="subtitle">
        Schools within range of an active PAGASA rainfall warning, grouped by the highest
        color-coded alert level currently affecting them.
      </p>

      @if (loading()) {
        <div class="card empty-card">Loading active rainfall warnings…</div>
      } @else if (rainfallEvents().length === 0) {
        <div class="card empty-card">No active rainfall warnings at this time.</div>
      } @else {
        <div class="cards-row">
          <div class="stat-card card red">
            <div class="stat-label">Red Alert</div>
            <div class="stat-value">{{ countByColor('red') }}</div>
          </div>
          <div class="stat-card card orange">
            <div class="stat-label">Orange Alert</div>
            <div class="stat-value">{{ countByColor('orange') }}</div>
          </div>
          <div class="stat-card card yellow">
            <div class="stat-label">Yellow Alert</div>
            <div class="stat-value">{{ countByColor('yellow') }}</div>
          </div>
        </div>

        <div class="active-events">
          <div class="panel-title">ACTIVE RAINFALL WARNINGS</div>
          @for (ev of rainfallEvents(); track ev.id) {
            <div class="event-chip" [class]="'chip-' + extractColorPublic(ev.warning_level)">
              {{ ev.official_title }} <span class="chip-level">{{ ev.warning_level || 'Level unspecified' }}</span>
            </div>
          }
        </div>

        @for (color of ['red', 'orange', 'yellow', 'unspecified']; track color) {
          @if (rowsByColor(color).length > 0) {
            <div class="card group-card">
              <div class="group-title" [class]="'title-' + color">
                {{ colorLabel(color) }} ({{ rowsByColor(color).length }} {{ rowsByColor(color).length === 1 ? 'school' : 'schools' }})
              </div>
              <table>
                <thead>
                  <tr><th>School</th><th>Municipality</th><th>Priority</th><th>Distance</th><th>Warning(s)</th></tr>
                </thead>
                <tbody>
                  @for (row of rowsByColor(color); track row.school.id) {
                    <tr>
                      <td>{{ row.school.name }}</td>
                      <td>{{ row.school.municipality }}</td>
                      <td>
                        <span class="badge" [class]="row.school.priority === 'high' ? 'badge-critical' : 'badge-moderate'">
                          {{ row.school.priority === 'high' ? 'High' : 'Potential' }}
                        </span>
                      </td>
                      <td>{{ row.school.distance_km | number: '1.1-1' }} km</td>
                      <td class="event-list">{{ row.eventTitles.join(', ') }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        }
      }
    </div>
  `,
  styles: [`
    h2 { color: var(--color-primary); margin-bottom: 0.25rem; }
    .subtitle { color: var(--color-text-muted); font-size: 0.88rem; margin-bottom: 1.25rem; max-width: 640px; }
    .empty-card { padding: 1.5rem; text-align: center; color: var(--color-text-muted); }

    .cards-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1rem; }
    .stat-card { padding: 1rem; border-left: 4px solid transparent; }
    .stat-card.red { border-left-color: var(--color-critical); }
    .stat-card.orange { border-left-color: var(--color-high); }
    .stat-card.yellow { border-left-color: var(--color-moderate); }
    .stat-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; color: var(--color-text-muted); letter-spacing: 0.03em; }
    .stat-value { font-size: 1.9rem; font-weight: 700; margin-top: 0.25rem; }

    .active-events { margin-bottom: 1.25rem; display: flex; flex-direction: column; gap: 0.4rem; }
    .panel-title { font-size: 0.72rem; font-weight: 700; color: var(--color-text-muted); letter-spacing: 0.03em; margin-bottom: 0.25rem; }
    .event-chip {
      padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.85rem; background: var(--color-surface);
      border: 1px solid var(--color-border); border-left: 4px solid var(--color-text-muted);
    }
    .chip-red { border-left-color: var(--color-critical); }
    .chip-orange { border-left-color: var(--color-high); }
    .chip-yellow { border-left-color: var(--color-moderate); }
    .chip-level { color: var(--color-text-muted); font-size: 0.78rem; margin-left: 0.5rem; }

    .group-card { padding: 1rem; margin-bottom: 1rem; }
    .group-title { font-weight: 700; margin-bottom: 0.75rem; padding-left: 0.6rem; border-left: 4px solid transparent; }
    .title-red { color: var(--color-critical); border-left-color: var(--color-critical); }
    .title-orange { color: var(--color-high); border-left-color: var(--color-high); }
    .title-yellow { color: var(--color-moderate); border-left-color: var(--color-moderate); }
    .title-unspecified { color: var(--color-text-muted); border-left-color: var(--color-text-muted); }

    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 0.55rem 0.75rem; border-bottom: 1px solid var(--color-border); font-size: 0.85rem; }
    th { color: var(--color-text-muted); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.03em; }
    .event-list { color: var(--color-text-muted); font-size: 0.8rem; }
  `]
})
export class RainfallReportComponent implements OnInit {
  loading = signal(true);
  rainfallEvents = signal<DisasterEvent[]>([]);
  private schoolRows = signal<Map<string, SchoolAlertRow>>(new Map());

  rowsGrouped = computed(() => {
    const groups: Record<AlertColor, SchoolAlertRow[]> = { red: [], orange: [], yellow: [], unspecified: [] };
    for (const row of this.schoolRows().values()) {
      groups[row.color].push(row);
    }
    for (const key of Object.keys(groups) as AlertColor[]) {
      groups[key].sort((a, b) => a.school.distance_km - b.school.distance_km);
    }
    return groups;
  });

  constructor(private api: ApiService) {}

  async ngOnInit(): Promise<void> {
    this.loading.set(true);
    try {
      const allEvents = await this.api.get<DisasterEvent[]>('/events/active');
      const rainfall = allEvents.filter((e) => e.disaster_type === 'rainfall');
      this.rainfallEvents.set(rainfall);

      const merged = new Map<string, SchoolAlertRow>();
      for (const ev of rainfall) {
        const color = extractColor(ev.warning_level);
        const schools = await this.api.get<AffectedSchool[]>(`/events/${ev.id}/affected-schools`);
        for (const school of schools) {
          const existing = merged.get(school.id);
          if (!existing || COLOR_RANK[color] > COLOR_RANK[existing.color]) {
            merged.set(school.id, {
              school,
              color,
              eventTitles: existing ? [...existing.eventTitles, ev.official_title] : [ev.official_title]
            });
          } else if (existing) {
            existing.eventTitles.push(ev.official_title);
          }
        }
      }
      this.schoolRows.set(merged);
    } finally {
      this.loading.set(false);
    }
  }

  rowsByColor(color: string): SchoolAlertRow[] {
    return this.rowsGrouped()[color as AlertColor] ?? [];
  }

  countByColor(color: string): number {
    return this.rowsByColor(color).length;
  }

  colorLabel(color: string): string {
    if (color === 'red') return 'Red Alert';
    if (color === 'orange') return 'Orange Alert';
    if (color === 'yellow') return 'Yellow Alert';
    return 'Warning Level Unspecified';
  }

  extractColorPublic(warningLevel: string | null): AlertColor {
    return extractColor(warningLevel);
  }
}
