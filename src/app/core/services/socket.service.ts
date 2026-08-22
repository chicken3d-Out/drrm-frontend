import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { AuthService } from './auth.service';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface SocketEvent<T = any> {
  type: string;
  payload: T;
}

@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket: Socket | null = null;
  events$ = new Subject<SocketEvent>();

  constructor(private auth: AuthService) {}

  connect(): void {
    const token = this.auth.getAccessToken();
    if (!token || this.socket?.connected) return;

    this.socket = io(environment.socketBase || '/', {
      path: '/socket.io',
      auth: { token }
    });

    const forward = (type: string) => (payload: any) => this.events$.next({ type, payload });

    for (const eventName of [
      'disaster:new',
      'disaster:updated',
      'disaster:closed',
      'notification:new',
      'school:affected',
      'announcement:new',
      'chat:message',
      'chat:typing',
      'chat:user-online',
      'chat:user-offline',
      'system:status'
    ]) {
      this.socket.on(eventName, forward(eventName));
    }
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  emit(event: string, payload: any): void {
    this.socket?.emit(event, payload);
  }
}
