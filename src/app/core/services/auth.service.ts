import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

interface LoginResponse {
  accessToken: string;
  roles: string[];
}

const API_BASE = `${environment.apiBase}/api/v1/auth`;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private accessToken = signal<string | null>(null);
  private roles = signal<string[]>([]);

  isAuthenticated = computed(() => this.accessToken() !== null);
  currentRoles = computed(() => this.roles());

  constructor(private http: HttpClient, private router: Router) {}

  getAccessToken(): string | null {
    return this.accessToken();
  }

  hasAnyRole(...allowed: string[]): boolean {
    return this.roles().some((r) => allowed.includes(r));
  }

  async login(email: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<LoginResponse>(`${API_BASE}/login`, { email, password }, { withCredentials: true })
    );
    this.accessToken.set(res.accessToken);
    this.roles.set(res.roles);
  }

  async register(payload: {
    email: string;
    password: string;
    fullName: string;
    designation?: string;
    office?: string;
    contactNumber?: string;
  }): Promise<{ message: string }> {
    return firstValueFrom(this.http.post<{ message: string }>(`${API_BASE}/register`, payload));
  }

  async tryRestoreSession(): Promise<boolean> {
    try {
      const res = await firstValueFrom(
        this.http.post<LoginResponse>(`${API_BASE}/refresh`, {}, { withCredentials: true })
      );
      this.accessToken.set(res.accessToken);
      this.roles.set(res.roles);
      return true;
    } catch {
      this.accessToken.set(null);
      this.roles.set([]);
      return false;
    }
  }

  async refreshAccessToken(): Promise<string | null> {
    const restored = await this.tryRestoreSession();
    return restored ? this.accessToken() : null;
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${API_BASE}/logout`, {}, { withCredentials: true }));
    } finally {
      this.accessToken.set(null);
      this.roles.set([]);
      this.router.navigate(['/login']);
    }
  }
}
