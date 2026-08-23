import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register.component').then((m) => m.RegisterComponent)
  },
  {
    path: '',
    loadComponent: () => import('./layout/shell/shell.component').then((m) => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent)
      },
      {
        path: 'schools',
        loadComponent: () => import('./features/schools/schools.component').then((m) => m.SchoolsComponent)
      },
      {
        path: 'rainfall-report',
        loadComponent: () =>
          import('./features/rainfall-report/rainfall-report.component').then((m) => m.RainfallReportComponent)
      },
      {
        path: 'weather-outlook',
        loadComponent: () =>
          import('./features/weather-outlook/weather-outlook.component').then((m) => m.WeatherOutlookComponent)
      },
      {
        path: 'announcements',
        loadComponent: () =>
          import('./features/announcements/announcements.component').then((m) => m.AnnouncementsComponent)
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./features/notifications/notifications.component').then((m) => m.NotificationsComponent)
      },
      {
        path: 'chat',
        loadComponent: () => import('./features/chat/chat.component').then((m) => m.ChatComponent)
      },
      {
        path: 'admin/pending',
        canActivate: [roleGuard('DRRM_ADMIN')],
        loadComponent: () =>
          import('./features/admin/pending-registrations/pending-registrations.component').then(
            (m) => m.PendingRegistrationsComponent
          )
      },
      {
        path: 'admin/data-sources',
        canActivate: [roleGuard('DRRM_ADMIN', 'DIVISION_DRRM_STAFF')],
        loadComponent: () =>
          import('./features/admin/data-sources/data-sources.component').then((m) => m.DataSourcesComponent)
      }
    ]
  },
  { path: '**', redirectTo: '' }
];
