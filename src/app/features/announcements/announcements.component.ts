import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { Announcement } from '../../core/models/models';

@Component({
  selector: 'app-announcements',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <h2>DRRM Announcements</h2>
        @if (auth.hasAnyRole('DRRM_ADMIN', 'DIVISION_DRRM_STAFF')) {
          <button class="btn btn-primary" (click)="showForm.set(!showForm())">
            {{ showForm() ? 'Cancel' : '+ New Announcement' }}
          </button>
        }
      </div>

      @if (showForm()) {
        <form class="card add-form" (ngSubmit)="publish()">
          <div class="field"><label>Title</label><input [(ngModel)]="form.title" name="title" required /></div>
          <div class="field"><label>Content</label><textarea rows="4" [(ngModel)]="form.content" name="content" required></textarea></div>
          <div class="field">
            <label>Priority</label>
            <select [(ngModel)]="form.priority" name="priority">
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MODERATE">Moderate</option>
              <option value="LOW">Low</option>
              <option value="INFORMATION">Information</option>
            </select>
          </div>
          <button type="submit" class="btn btn-primary">Publish</button>
        </form>
      }

      <div class="list">
        @for (a of announcements(); track a.id) {
          <div class="card announcement">
            <div class="a-header">
              <span class="badge" [class]="'badge-' + a.priority.toLowerCase()">{{ a.priority }}</span>
              <strong>{{ a.title }}</strong>
            </div>
            <p>{{ a.content }}</p>
            <div class="a-meta">{{ a.author_name || a.author_email }} · {{ a.published_at | date: 'medium' }}</div>
          </div>
        } @empty {
          <div class="card empty-card">No announcements published yet.</div>
        }
      </div>
    </div>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    h2 { margin: 0; color: var(--color-primary); }
    .add-form { padding: 1.25rem; margin-bottom: 1rem; }
    .list { display: flex; flex-direction: column; gap: 0.75rem; }
    .announcement { padding: 1rem 1.25rem; }
    .a-header { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.4rem; }
    .a-meta { font-size: 0.78rem; color: var(--color-text-muted); margin-top: 0.5rem; }
    .empty-card { padding: 1.5rem; text-align: center; color: var(--color-text-muted); }
  `]
})
export class AnnouncementsComponent implements OnInit {
  announcements = signal<Announcement[]>([]);
  showForm = signal(false);
  form: any = { title: '', content: '', priority: 'INFORMATION' };

  constructor(private api: ApiService, public auth: AuthService) {}

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.announcements.set(await this.api.get<Announcement[]>('/announcements'));
  }

  async publish(): Promise<void> {
    await this.api.post('/announcements', this.form);
    this.showForm.set(false);
    this.form = { title: '', content: '', priority: 'INFORMATION' };
    await this.load();
  }
}
