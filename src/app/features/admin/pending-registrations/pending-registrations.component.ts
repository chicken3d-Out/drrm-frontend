import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { PendingUser, AVAILABLE_ROLES } from '../../../core/models/models';

@Component({
  selector: 'app-pending-registrations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <h2>Pending Registrations</h2>
      <div class="card">
        <table>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Office / Designation</th><th>Registered</th><th>Assign Role</th><th>Action</th></tr>
          </thead>
          <tbody>
            @for (u of users(); track u.id) {
              <tr>
                <td>{{ u.full_name || '—' }}</td>
                <td>{{ u.email }}</td>
                <td>{{ u.office || '—' }} <span class="muted">{{ u.designation }}</span></td>
                <td>{{ u.created_at | date: 'medium' }}</td>
                <td>
                  <select [(ngModel)]="selectedRole[u.id]" [name]="'role-' + u.id">
                    @for (r of roles; track r) { <option [value]="r">{{ r }}</option> }
                  </select>
                </td>
                <td class="actions">
                  <button class="btn btn-primary" (click)="decide(u.id, 'APPROVED')">Approve</button>
                  <button class="btn btn-outline" (click)="decide(u.id, 'REJECTED')">Reject</button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="6" class="empty">No pending registrations.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    h2 { color: var(--color-primary); margin-bottom: 1rem; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 0.65rem 1rem; border-bottom: 1px solid var(--color-border); font-size: 0.86rem; vertical-align: middle; }
    th { color: var(--color-text-muted); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.03em; }
    .muted { color: var(--color-text-muted); font-size: 0.78rem; display:block; }
    .actions { display: flex; gap: 0.5rem; }
    .empty { text-align: center; color: var(--color-text-muted); padding: 1.5rem; }
    select { min-width: 190px; }
  `]
})
export class PendingRegistrationsComponent implements OnInit {
  users = signal<PendingUser[]>([]);
  roles = AVAILABLE_ROLES;
  selectedRole: Record<string, string> = {};

  constructor(private api: ApiService) {}

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async load(): Promise<void> {
    const data = await this.api.get<PendingUser[]>('/admin/users', { status: 'PENDING' });
    this.users.set(data);
    for (const u of data) {
      this.selectedRole[u.id] = this.selectedRole[u.id] ?? 'DEPED_PERSONNEL';
    }
  }

  async decide(userId: string, status: 'APPROVED' | 'REJECTED'): Promise<void> {
    await this.api.patch(`/admin/users/${userId}/status`, {
      status,
      roleNames: status === 'APPROVED' ? [this.selectedRole[userId]] : undefined
    });
    await this.load();
  }
}
