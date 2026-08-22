import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-card card">
        <div class="header">
          <div class="title">DepEd Leyte Division</div>
          <div class="subtitle">DRRM Monitoring System</div>
        </div>

        <form (ngSubmit)="submit()">
          <div class="field">
            <label>DepEd Email</label>
            <input type="email" name="email" [(ngModel)]="email" placeholder="you@deped.gov.ph" required />
          </div>
          <div class="field">
            <label>Password</label>
            <input type="password" name="password" [(ngModel)]="password" required />
          </div>

          @if (error()) {
            <div class="error-text">{{ error() }}</div>
          }

          <button type="submit" class="btn btn-primary" style="width:100%" [disabled]="loading()">
            {{ loading() ? 'Signing in…' : 'Sign in' }}
          </button>
        </form>

        <div class="footer-link">
          No account yet? <a routerLink="/register">Register with your DepEd email</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(180deg, var(--color-primary) 0%, var(--color-primary) 40%, var(--color-bg) 40%);
    }
    .auth-card { width: 360px; padding: 2rem; }
    .header { text-align: center; margin-bottom: 1.5rem; }
    .title { font-weight: 700; color: var(--color-primary); font-size: 1.1rem; }
    .subtitle { font-size: 0.85rem; color: var(--color-text-muted); }
    .footer-link { text-align: center; margin-top: 1rem; font-size: 0.85rem; color: var(--color-text-muted); }
    .footer-link a { color: var(--color-primary); font-weight: 600; text-decoration: none; }
  `]
})
export class LoginComponent {
  email = '';
  password = '';
  loading = signal(false);
  error = signal<string | null>(null);

  constructor(private auth: AuthService, private router: Router) {}

  async submit(): Promise<void> {
    this.error.set(null);
    this.loading.set(true);
    try {
      await this.auth.login(this.email, this.password);
      this.router.navigate(['/dashboard']);
    } catch (err: any) {
      this.error.set(err?.error?.error ?? 'Login failed. Please check your credentials.');
    } finally {
      this.loading.set(false);
    }
  }
}
