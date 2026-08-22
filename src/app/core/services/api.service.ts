import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = `${environment.apiBase}/api/v1`;

  constructor(private http: HttpClient) {}

  get<T>(path: string, params?: Record<string, any>): Promise<T> {
    return firstValueFrom(this.http.get<T>(`${this.base}${path}`, { params }));
  }

  post<T>(path: string, body: any): Promise<T> {
    return firstValueFrom(this.http.post<T>(`${this.base}${path}`, body));
  }

  patch<T>(path: string, body: any): Promise<T> {
    return firstValueFrom(this.http.patch<T>(`${this.base}${path}`, body));
  }

  delete<T>(path: string): Promise<T> {
    return firstValueFrom(this.http.delete<T>(`${this.base}${path}`));
  }
}
