import { Injectable } from '@angular/core';
import { ApiService } from './api.service';

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body?: string;
  read: boolean;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  constructor(private api: ApiService) {}

  getAll() {
    return this.api.get<{ notifications: Notification[] }>('/notifications');
  }

  markAllRead() {
    return this.api.patch('/notifications/read-all');
  }

  markRead(id: string) {
    return this.api.patch(`/notifications/${id}/read`);
  }

  delete(id: string) {
    return this.api.delete(`/notifications/${id}`);
  }
}
