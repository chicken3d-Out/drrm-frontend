import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { DataSourceHealth } from '../../../core/models/models';

@Component({
  selector: 'app-data-sources',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page">
      <h2>Data Sources</h2>
      <div class="grid">
        @for (s of sources(); track s.id) {
          <div class="card source-card">
            <div class="source-header">
              <strong>{{ s.name }}</strong>
              <span class="dot" [class]="s.status"></span>
              <span class="status-label">{{ s.status | uppercase }}</span>
            </div>
            <div class="row"><span>Adapter</span><span>{{ s.adapter_type }}</span></div>
            <div class="row"><span>Last sync</span><span>{{ s.last_sync_at ? (s.last_sync_at | date:'medium') : 'Never' }}</span></div>
            <div class="row"><span>Events last cycle</span><span>{{ s.last_events_retrieved ?? '—' }}</span></div>
            <div class="row"><span>Response time</span><span>{{ s.last_response_time_ms ? s.last_response_time_ms + ' ms' : '—' }}</span></div>
            @if (s.last_error) {
              <div class="warn">⚠ {{ s.last_error }}</div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    h2 { color: var(--color-primary); margin-bottom: 1rem; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
    .source-card { padding: 1rem; }
    .source-header { display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.75rem; }
    .dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
    .dot.online { background: var(--color-low); }
    .dot.degraded { background: var(--color-moderate); }
    .dot.offline { background: var(--color-critical); }
    .status-label { font-size: 0.7rem; font-weight: 700; color: var(--color-text-muted); }
    .row { display: flex; justify-content: space-between; font-size: 0.83rem; padding: 0.25rem 0; color: var(--color-text-muted); }
    .row span:last-child { color: var(--color-text); font-weight: 500; }
    .warn { margin-top: 0.5rem; font-size: 0.8rem; color: var(--color-critical); }
  `]
})
export class DataSourcesComponent implements OnInit {
  sources = signal<DataSourceHealth[]>([]);

  constructor(private api: ApiService) {}

  async ngOnInit(): Promise<void> {
    this.sources.set(await this.api.get<DataSourceHealth[]>('/admin/sources'));
  }
}
