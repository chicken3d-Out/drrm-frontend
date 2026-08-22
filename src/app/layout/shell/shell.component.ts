import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SocketService } from '../../core/services/socket.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-title">DepEd Leyte</div>
          <div class="brand-sub">DRRM Monitoring</div>
        </div>
        <nav>
          <a routerLink="/dashboard" routerLinkActive="active">🏠 Dashboard</a>
          <a routerLink="/schools" routerLinkActive="active">🏫 Schools Directory</a>
          <a routerLink="/announcements" routerLinkActive="active">📢 Announcements</a>
          <a routerLink="/chat" routerLinkActive="active">💬 Group Chat</a>
          <a routerLink="/notifications" routerLinkActive="active">🔔 Notifications</a>

          @if (auth.hasAnyRole('DRRM_ADMIN', 'DIVISION_DRRM_STAFF')) {
            <div class="nav-section">ADMINISTRATION</div>
            <a routerLink="/admin/pending" routerLinkActive="active">👥 Pending Registrations</a>
            <a routerLink="/admin/data-sources" routerLinkActive="active">📡 Data Sources</a>
          }
        </nav>
        <button class="btn btn-outline logout-btn" (click)="logout()">Log out</button>
      </aside>

      <div class="main">
        <header class="topbar">
          <div class="status">
            <span class="dot"></span> SYSTEM OPERATIONAL
          </div>
        </header>
        <main class="content">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .shell { display: flex; min-height: 100vh; }

    .sidebar {
      width: 240px;
      background: var(--color-primary);
      color: #fff;
      display: flex;
      flex-direction: column;
      padding: 1.25rem 0.75rem;
      flex-shrink: 0;
    }
    .brand { padding: 0 0.5rem 1.5rem; }
    .brand-title { font-weight: 700; font-size: 1.05rem; }
    .brand-sub { font-size: 0.78rem; opacity: 0.85; }

    nav { display: flex; flex-direction: column; gap: 0.15rem; flex: 1; }
    nav a {
      display: block;
      padding: 0.55rem 0.6rem;
      border-radius: 6px;
      text-decoration: none;
      color: rgba(255,255,255,0.9);
      font-size: 0.88rem;
      font-weight: 500;
    }
    nav a:hover { background: rgba(255,255,255,0.08); }
    nav a.active { background: rgba(255,255,255,0.16); font-weight: 700; }
    .nav-section {
      margin: 0.85rem 0 0.25rem 0.6rem;
      font-size: 0.68rem;
      letter-spacing: 0.05em;
      opacity: 0.7;
      font-weight: 700;
    }
    .logout-btn { margin-top: 1rem; background: transparent; border-color: rgba(255,255,255,0.5); color: #fff; }
    .logout-btn:hover { background: rgba(255,255,255,0.1); }

    .main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
    .topbar {
      background: #fff;
      border-bottom: 1px solid var(--color-border);
      padding: 0.75rem 1.5rem;
    }
    .status { font-size: 0.78rem; font-weight: 700; color: var(--color-text-muted); display: flex; align-items: center; gap: 0.4rem; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--color-low); display: inline-block; }
    .content { flex: 1; padding: 1.5rem; overflow-y: auto; }
  `]
})
export class ShellComponent implements OnInit {
  constructor(public auth: AuthService, private socket: SocketService) {}

  ngOnInit(): void {
    this.socket.connect();
  }

  logout(): void {
    this.socket.disconnect();
    this.auth.logout();
  }
}
