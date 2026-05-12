import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Board, Comment } from '../models/board';

@Injectable({ providedIn: 'root' })
export class BoardService {
  constructor(private api: ApiService) {}

  getAll() {
    return this.api.get<{ boards: Board[] }>('/boards');
  }

  getById(id: string) {
    return this.api.get<{ board: Board }>(`/boards/${id}`);
  }

  create(name: string) {
    return this.api.post<{ board: Board }>('/boards', { name });
  }

  update(id: string, data: Partial<Board>) {
    return this.api.put<{ board: Board }>(`/boards/${id}`, data);
  }

  rename(id: string, name: string) {
    return this.api.patch(`/boards/${id}/name`, { name });
  }

  delete(id: string) {
    return this.api.delete(`/boards/${id}`);
  }

  saveProgress(boardId: string, progress: Record<string, unknown>) {
    return this.api.post(`/boards/${boardId}/progress`, progress);
  }

  getQuizResults(boardId: string) {
    return this.api.get(`/boards/${boardId}/quiz-results`);
  }

  getComments(boardId: string, cardId: string) {
    return this.api.get<{ comments: Comment[] }>(`/boards/${boardId}/cards/${cardId}/comments`);
  }

  addComment(boardId: string, cardId: string, text: string) {
    return this.api.post(`/boards/${boardId}/cards/${cardId}/comments`, { text });
  }

  deleteComment(boardId: string, cardId: string, commentId: string) {
    return this.api.delete(`/boards/${boardId}/cards/${cardId}/comments/${commentId}`);
  }
}
