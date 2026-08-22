import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { SocketService } from '../../core/services/socket.service';
import { AppNotification, NotificationPreferences } from '../../core/models/models';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <h2>Notifications</h2>
        <div class="header-actions">
          <button class="btn btn-outline" (click)="markAllRead()">Mark all as read</button>
          <button class="btn btn-outline" (click)="showPrefs.set(!showPrefs())">
            {{ showPrefs() ? 'Hide preferences' : 'Preferences' }}
          </button>
        </div>
      </div>

      @if (showPrefs() && prefs()) {
        <div class="card prefs-card">
          <div class="prefs-title">Hazard types</div>
          <div class="prefs-grid">
            <label class="check"><input type="checkbox" [(ngModel)]="prefsModel.earthquake" (change)="savePrefs()" /> Earthquake</label>
            <label class="check"><input type="checkbox" [(ngModel)]="prefsModel.tsunami" (change)="savePrefs()" /> Tsunami</label>
            <label class="check"><input type="checkbox" [(ngModel)]="prefsModel.volcano" (change)="savePrefs()" /> Volcano</label>
            <label class="check"><input type="checkbox" [(ngModel)]="prefsModel.rainfall" (change)="savePrefs()" /> Rainfall</label>
            <label class="check"><input type="checkbox" [(ngModel)]="prefsModel.tropical_cyclone" (change)="savePrefs()" /> Tropical Cyclone</label>
            <label class="check"><input type="checkbox" [(ngModel)]="prefsModel.other_hazards" (change)="savePrefs()" /> Other Hazards</label>
          </div>
          <div class="prefs-title">Scope</div>
          <div class="prefs-grid">
            <label class="check"><input type="checkbox" [(ngModel)]="prefsModel.leyte_alerts" (change)="savePrefs()" /> Leyte alerts</label>
            <label class="check"><input type="checkbox" [(ngModel)]="prefsModel.nearby_alerts" (change)="savePrefs()" /> Nearby alerts</label>
            <label class="check"><input type="checkbox" [(ngModel)]="prefsModel.school_alerts" (change)="savePrefs()" /> School-related alerts</label>
            <label class="check disabled"><input type="checkbox" checked disabled /> Critical alerts (always on)</label>
          </div>
        </div>
      }

      <div class="list">
        @for (n of notifications(); track n.id) {
          <div class="card notif" [class.unread]="!n.read" (click)="markRead(n)">
            <span class="badge" [class]="'badge-' + n.priority.toLowerCase()">{{ n.priority }}</span>
            <div class="notif-body">
              <div class="notif-title">{{ n.title }}</div>
              <div class="notif-meta">{{ n.body }} · {{ n.created_at | date: 'medium' }}</div>
            </div>
          </div>
        } @empty {
          <div class="card empty-card">No notifications yet.</div>
        }
      </div>
    </div>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .header-actions { display: flex; gap: 0.5rem; }
    h2 { margin: 0; color: var(--color-primary); }
    .prefs-card { padding: 1.25rem; margin-bottom: 1rem; }
    .prefs-title { font-size: 0.75rem; font-weight: 700; color: var(--color-text-muted); text-transform: uppercase; margin: 0.5rem 0; }
    .prefs-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin-bottom: 0.5rem; }
    .check { display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; font-weight: 500; color: var(--color-text); }
    .check.disabled { opacity: 0.6; }
    .check input { width: auto; }

    .list { display: flex; flex-direction: column; gap: 0.5rem; }
    .notif { display: flex; gap: 0.75rem; align-items: flex-start; padding: 0.85rem 1rem; cursor: pointer; }
    .notif.unread { border-left: 3px solid var(--color-primary); }
    .notif-title { font-weight: 600; font-size: 0.9rem; }
    .notif-meta { font-size: 0.78rem; color: var(--color-text-muted); margin-top: 0.2rem; }
    .empty-card { padding: 1.5rem; text-align: center; color: var(--color-text-muted); }
  `]
})
export class NotificationsComponent implements OnInit, OnDestroy {
  notifications = signal<AppNotification[]>([]);
  prefs = signal<NotificationPreferences | null>(null);
  showPrefs = signal(false);
  prefsModel: any = {};
  private sub: Subscription | null = null;

  constructor(private api: ApiService, private socket: SocketService) {}

  async ngOnInit(): Promise<void> {
    await this.load();
    const p = await this.api.get<NotificationPreferences>('/notifications/preferences');
    this.prefs.set(p);
    this.prefsModel = { ...p };

    this.sub = this.socket.events$.subscribe((evt) => {
      if (evt.type === 'notification:new') this.load();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  async load(): Promise<void> {
    this.notifications.set(await this.api.get<AppNotification[]>('/notifications'));
  }

  async markRead(n: AppNotification): Promise<void> {
    if (n.read) return;
    await this.api.patch(`/notifications/${n.id}/read`, {});
    await this.load();
  }

  async markAllRead(): Promise<void> {
    await this.api.post('/notifications/mark-all-read', {});
    await this.load();
  }

  async savePrefs(): Promise<void> {
    await this.api.patch('/notifications/preferences', {
      earthquake: this.prefsModel.earthquake,
      tsunami: this.prefsModel.tsunami,
      volcano: this.prefsModel.volcano,
      rainfall: this.prefsModel.rainfall,
      tropicalCyclone: this.prefsModel.tropical_cyclone,
      otherHazards: this.prefsModel.other_hazards,
      leyteAlerts: this.prefsModel.leyte_alerts,
      nearbyAlerts: this.prefsModel.nearby_alerts,
      schoolAlerts: this.prefsModel.school_alerts
    });
  }
}
