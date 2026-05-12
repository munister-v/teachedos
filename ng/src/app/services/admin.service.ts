import { Injectable } from '@angular/core';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class AdminService {
  constructor(private api: ApiService) {}

  getStats() {
    return this.api.get<Record<string, unknown>>('/admin/stats');
  }

  getUsers() {
    return this.api.get<Record<string, unknown>>('/admin/users');
  }

  updateUser(id: string, data: Record<string, unknown>) {
    return this.api.patch(`/admin/users/${id}`, data);
  }

  deleteUser(id: string) {
    return this.api.delete(`/admin/users/${id}`);
  }

  getBoards() {
    return this.api.get<Record<string, unknown>>('/admin/boards');
  }

  deleteBoard(id: string) {
    return this.api.delete(`/admin/boards/${id}`);
  }

  getSessions() {
    return this.api.get<Record<string, unknown>>('/admin/sessions');
  }

  deleteSession(id: string) {
    return this.api.delete(`/admin/sessions/${id}`);
  }

  deleteUserSessions(userId: string) {
    return this.api.delete(`/admin/sessions/user/${userId}`);
  }
}
