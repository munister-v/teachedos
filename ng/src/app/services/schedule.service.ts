import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { ScheduleEntry } from '../models/schedule';

@Injectable({ providedIn: 'root' })
export class ScheduleService {
  constructor(private api: ApiService) {}

  getAll() {
    return this.api.get<{ classes: ScheduleEntry[] }>('/schedule');
  }

  getLive() {
    return this.api.get<{ classes: ScheduleEntry[] }>('/schedule/live');
  }

  create(entry: Partial<ScheduleEntry>) {
    return this.api.post<{ cls: ScheduleEntry }>('/schedule', entry);
  }

  update(id: string, data: Partial<ScheduleEntry>) {
    return this.api.patch<{ cls: ScheduleEntry }>(`/schedule/${id}`, data);
  }

  toggleLive(id: string, isLive: boolean) {
    return this.api.patch(`/schedule/${id}/live`, { is_live: isLive });
  }

  delete(id: string) {
    return this.api.delete(`/schedule/${id}`);
  }
}
