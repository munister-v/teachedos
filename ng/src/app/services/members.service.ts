import { Injectable } from '@angular/core';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class MembersService {
  constructor(private api: ApiService) {}

  getMyBoards() {
    return this.api.get<Record<string, unknown>>('/members/my/boards');
  }

  getMembers(boardId: string) {
    return this.api.get<Record<string, unknown>>(`/members/${boardId}`);
  }

  invite(boardId: string, email: string) {
    return this.api.post(`/members/${boardId}/invite`, { email });
  }

  bulkInvite(boardId: string, emails: string[]) {
    return this.api.post(`/members/${boardId}/bulk-invite`, { emails });
  }

  removeMember(boardId: string, userId: string) {
    return this.api.delete(`/members/${boardId}/${userId}`);
  }

  getProgress(boardId: string) {
    return this.api.get<Record<string, unknown>>(`/members/${boardId}/progress`);
  }

  updateProgress(boardId: string, data: Record<string, unknown>) {
    return this.api.patch(`/members/${boardId}/progress`, data);
  }
}
