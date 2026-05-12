import { Injectable } from '@angular/core';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class StudentService {
  constructor(private api: ApiService) {}

  getDashboard() {
    return this.api.get<Record<string, unknown>>('/student/dashboard');
  }

  getPortal(studentId: string) {
    return this.api.get<Record<string, unknown>>(`/student/portal/${studentId}`);
  }

  updatePortalNote(studentId: string, note: string) {
    return this.api.patch(`/student/portal/${studentId}/note`, { note });
  }

  getQuizHistory() {
    return this.api.get<Record<string, unknown>>('/student/quiz-history');
  }
}
