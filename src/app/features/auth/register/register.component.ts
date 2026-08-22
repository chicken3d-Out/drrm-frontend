import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-card card">
        <div class="header">
          <div class="title">DepEd Leyte Division</div>
          <div class="subtitle">Register for DRRM Monitoring System access</div>
        </div>

        @if (successMessage()) {
          <div class="success-box">
            {{ successMessage() }}
            <div style="margin-top:0.75rem"><a routerLink="/login">Back to sign in</a></div>
          </div>
        } @else {
          <form (ngSubmit)="submit()">
            <div class="field">
              <label>Full Name</label>
              <input name="fullName" [(ngModel)]="fullName" required />
            </div>
            <div class="field">
              <label>DepEd Email</label>
              <input type="email" name="email" [(ngModel)]="email" placeholder="you@deped.gov.ph" required />
            </div>
            <div class="field">
              <label>Password</label>
              <input type="password" name="password" [(ngModel)]="password" minlength="10" required />
              <small style="color:var(--color-text-muted)">At least 10 characters.</small>
            </div>
            <div class="field">
              <label>Designation (optional)</label>
              <input name="designation" [(ngModel)]="designation" placeholder="e.g. Teacher III" />
            </div>
            <div class="field">
              <label>Office / School (optional)</label>
              <input name="office" [(ngModel)]="office" />
            </div>
            <div class="field">
              <label>Contact Number (optional)</label>
              <input name="contactNumber" [(ngModel)]="contactNumber" />
            </div>

            @if (error()) {
              <div class="error-text">{{ error() }}</div>
            }

            <button type="submit" class="btn btn-primary" style="width:100%" [disabled]="loading()">
              {{ loading() ? 'Submitting…' : 'Register' }}
            </button>
          </form>

          <div class="footer-link">
            Already have an account? <a routerLink="/login">Sign in</a>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .auth-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(180deg, var(--color-primary) 0%, var(--color-primary) 25%, var(--color-bg) 25%);
      padding: 2rem 0;
    }
    .auth-card { width: 400px; padding: 2rem; }
    .header { text-align: center; margin-bottom: 1.5rem; }
    .title { font-weight: 700; color: var(--color-primary); font-size: 1.1rem; }
    .subtitle { font-size: 0.85rem; color: var(--color-text-muted); }
    .footer-link { text-align: center; margin-top: 1rem; font-size: 0.85rem; color: var(--color-text-muted); }
    .footer-link a { color: var(--color-primary); font-weight: 600; text-decoration: none; }
    .success-box { background: var(--color-primary-light); border-radius: var(--radius); padding: 1rem; font-size: 0.9rem; text-align: center; }
  `]
})
export class RegisterComponent {
  fullName = '';
  email = '';
  password = '';
  designation = '';
  office = '';
  contactNumber = '';

  loading = signal(false);
  error = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  constructor(private auth: AuthService) {}

  async submit(): Promise<void> {
    this.error.set(null);
    this.loading.set(true);
    try {
      const res = await this.auth.register({
        email: this.email,
        password: this.password,
        fullName: this.fullName,
        designation: this.designation || undefined,
        office: this.office || undefined,
        contactNumber: this.contactNumber || undefined
      });
      this.successMessage.set(res.message);
    } catch (err: any) {
      this.error.set(err?.error?.error ?? 'Registration failed. Please check your details.');
    } finally {
      this.loading.set(false);
    }
  }
}
