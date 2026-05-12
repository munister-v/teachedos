import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { JournalEntry, VocabItem, Attendance } from '../models/journal';

@Injectable({ providedIn: 'root' })
export class JournalService {
  constructor(private api: ApiService) {}

  getAll() {
    return this.api.get<{ entries: JournalEntry[] }>('/journal');
  }

  create(data: Partial<JournalEntry>) {
    return this.api.post<{ entry: JournalEntry }>('/journal', data);
  }

  update(id: string, data: Partial<JournalEntry>) {
    return this.api.patch<{ entry: JournalEntry }>(`/journal/${id}`, data);
  }

  delete(id: string) {
    return this.api.delete(`/journal/${id}`);
  }

  getAttendance(journalId: string) {
    return this.api.get<{ attendance: Attendance[] }>(`/journal/${journalId}/attendance`);
  }

  saveAttendance(journalId: string, attendance: Partial<Attendance>[]) {
    return this.api.post(`/journal/${journalId}/attendance`, { attendance });
  }

  getVocab() {
    return this.api.get<{ vocab: VocabItem[] }>('/journal/vocab/list');
  }

  addVocab(data: Partial<VocabItem>) {
    return this.api.post<{ vocab: VocabItem }>('/journal/vocab', data);
  }

  updateVocab(id: string, data: Partial<VocabItem>) {
    return this.api.patch(`/journal/vocab/${id}`, data);
  }

  deleteVocab(id: string) {
    return this.api.delete(`/journal/vocab/${id}`);
  }
}
