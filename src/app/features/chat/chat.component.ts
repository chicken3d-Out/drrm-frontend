import { Component, OnInit, OnDestroy, ElementRef, ViewChild, signal, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { SocketService } from '../../core/services/socket.service';
import { AuthService } from '../../core/services/auth.service';
import { ChatMessage } from '../../core/models/models';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">
      <h2>Group Chat</h2>
      <div class="chat-card card">
        <div class="messages" #scrollAnchor>
          @for (m of messages(); track m.id) {
            <div class="message" [class.own]="m.sender_id === myUserId">
              <div class="msg-sender">{{ m.sender_name || m.sender_email }}</div>
              <div class="msg-bubble">
                {{ m.content }}
                @if (auth.hasAnyRole('DRRM_ADMIN', 'DIVISION_DRRM_STAFF', 'SCHOOL_DRRM_COORDINATOR', 'SCHOOL_HEAD', 'DEPED_PERSONNEL')) {
                  <button class="report-btn" (click)="report(m)" title="Report message">⚑</button>
                }
              </div>
              <div class="msg-time">{{ m.created_at | date: 'shortTime' }}</div>
            </div>
          } @empty {
            <div class="empty">No messages yet. Start the conversation.</div>
          }
        </div>

        <form class="composer" (ngSubmit)="send()">
          <input [(ngModel)]="draft" name="draft" placeholder="Type a message…" autocomplete="off" />
          <button type="submit" class="btn btn-primary" [disabled]="!draft.trim()">Send</button>
        </form>
      </div>
      <p class="note">Only approved, verified DepEd Leyte users can participate. Messages can be reported for administrator review.</p>
    </div>
  `,
  styles: [`
    h2 { color: var(--color-primary); margin-bottom: 1rem; }
    .chat-card { display: flex; flex-direction: column; height: 560px; }
    .messages { flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 0.6rem; }
    .message { max-width: 70%; }
    .message.own { align-self: flex-end; text-align: right; }
    .msg-sender { font-size: 0.72rem; color: var(--color-text-muted); margin-bottom: 0.15rem; }
    .msg-bubble { background: var(--color-primary-light); padding: 0.5rem 0.75rem; border-radius: 10px; font-size: 0.88rem; position: relative; }
    .message.own .msg-bubble { background: var(--color-primary); color: #fff; }
    .msg-time { font-size: 0.68rem; color: var(--color-text-muted); margin-top: 0.15rem; }
    .report-btn { border: none; background: transparent; cursor: pointer; opacity: 0.5; margin-left: 0.4rem; font-size: 0.8rem; }
    .report-btn:hover { opacity: 1; }
    .composer { display: flex; gap: 0.5rem; padding: 0.85rem; border-top: 1px solid var(--color-border); }
    .empty { text-align: center; color: var(--color-text-muted); margin: auto; }
    .note { font-size: 0.78rem; color: var(--color-text-muted); margin-top: 0.75rem; }
  `]
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  messages = signal<ChatMessage[]>([]);
  draft = '';
  myUserId: string | null = null;
  private sub: Subscription | null = null;
  private shouldScroll = false;

  @ViewChild('scrollAnchor') private scrollAnchor!: ElementRef<HTMLDivElement>;

  constructor(private api: ApiService, private socket: SocketService, public auth: AuthService) {}

  async ngOnInit(): Promise<void> {
    const token = this.auth.getAccessToken();
    if (token) {
      try {
        this.myUserId = JSON.parse(atob(token.split('.')[1])).sub;
      } catch {
        this.myUserId = null;
      }
    }

    const history = await this.api.get<ChatMessage[]>('/chat/messages');
    this.messages.set(history);
    this.shouldScroll = true;

    this.sub = this.socket.events$.subscribe((evt) => {
      if (evt.type === 'chat:message') {
        this.messages.update((list) => [
          ...list,
          {
            id: crypto.randomUUID(),
            content: evt.payload.content,
            created_at: evt.payload.at,
            reported: false,
            sender_id: evt.payload.senderId,
            sender_email: '',
            sender_name: evt.payload.senderName ?? null,
            profile_picture_url: null
          }
        ]);
        this.shouldScroll = true;
      }
    });
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll && this.scrollAnchor) {
      this.scrollAnchor.nativeElement.scrollTop = this.scrollAnchor.nativeElement.scrollHeight;
      this.shouldScroll = false;
    }
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  async send(): Promise<void> {
    const content = this.draft.trim();
    if (!content) return;
    this.draft = '';
    await this.api.post('/chat/messages', { content });
    this.socket.emit('chat:message', { content });
  }

  async report(m: ChatMessage): Promise<void> {
    await this.api.post(`/chat/messages/${m.id}/report`, {});
  }
}
