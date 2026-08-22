import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { School } from '../../core/models/models';

@Component({
  selector: 'app-schools',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <h2>Schools Directory</h2>
        @if (auth.hasAnyRole('DRRM_ADMIN', 'DIVISION_DRRM_STAFF')) {
          <button class="btn btn-primary" (click)="showForm.set(!showForm())">
            {{ showForm() ? 'Cancel' : '+ Add School' }}
          </button>
        }
      </div>

      @if (showForm()) {
        <form class="card add-form" (ngSubmit)="addSchool()">
          <div class="grid">
            <div class="field"><label>School ID</label><input [(ngModel)]="form.schoolId" name="schoolId" required /></div>
            <div class="field"><label>Name</label><input [(ngModel)]="form.name" name="name" required /></div>
            <div class="field">
              <label>Type</label>
              <select [(ngModel)]="form.schoolType" name="schoolType" required>
                <option value="Elementary">Elementary</option>
                <option value="Junior High School">Junior High School</option>
                <option value="Senior High School">Senior High School</option>
                <option value="Integrated School">Integrated School</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div class="field"><label>Municipality</label><input [(ngModel)]="form.municipality" name="municipality" required /></div>
            <div class="field"><label>District</label><input [(ngModel)]="form.district" name="district" /></div>
            <div class="field"><label>Barangay</label><input [(ngModel)]="form.barangay" name="barangay" /></div>
            <div class="field"><label>Latitude</label><input type="number" step="any" [(ngModel)]="form.latitude" name="latitude" required /></div>
            <div class="field"><label>Longitude</label><input type="number" step="any" [(ngModel)]="form.longitude" name="longitude" required /></div>
          </div>
          @if (error()) { <div class="error-text">{{ error() }}</div> }
          <button type="submit" class="btn btn-primary">Save School</button>
        </form>
      }

      <div class="card">
        <table>
          <thead>
            <tr><th>School</th><th>Type</th><th>Municipality</th><th>District</th><th>Status</th></tr>
          </thead>
          <tbody>
            @for (s of schools(); track s.id) {
              <tr>
                <td>{{ s.name }} <span class="muted">({{ s.school_id }})</span></td>
                <td>{{ s.school_type }}</td>
                <td>{{ s.municipality }}</td>
                <td>{{ s.district || '—' }}</td>
                <td><span class="badge badge-low">{{ s.status }}</span></td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="empty">No schools in the directory yet.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    h2 { margin: 0; color: var(--color-primary); }
    .add-form { padding: 1.25rem; margin-bottom: 1rem; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem 1rem; margin-bottom: 0.5rem; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 0.65rem 1rem; border-bottom: 1px solid var(--color-border); font-size: 0.88rem; }
    th { color: var(--color-text-muted); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.03em; }
    .muted { color: var(--color-text-muted); font-size: 0.8rem; }
    .empty { text-align: center; color: var(--color-text-muted); padding: 1.5rem; }
  `]
})
export class SchoolsComponent implements OnInit {
  schools = signal<School[]>([]);
  showForm = signal(false);
  error = signal<string | null>(null);

  form: any = { schoolId: '', name: '', schoolType: 'Elementary', municipality: '', district: '', barangay: '', latitude: null, longitude: null };

  constructor(private api: ApiService, public auth: AuthService) {}

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    this.schools.set(await this.api.get<School[]>('/schools'));
  }

  async addSchool(): Promise<void> {
    this.error.set(null);
    try {
      await this.api.post('/schools', this.form);
      this.showForm.set(false);
      this.form = { schoolId: '', name: '', schoolType: 'Elementary', municipality: '', district: '', barangay: '', latitude: null, longitude: null };
      await this.load();
    } catch (err: any) {
      this.error.set(err?.error?.error ?? 'Failed to save school.');
    }
  }
}
