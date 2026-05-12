import { Injectable } from '@angular/core';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class BillingService {
  constructor(private api: ApiService) {}

  getPlans() {
    return this.api.get<Record<string, unknown>>('/billing/plans');
  }

  getUsage() {
    return this.api.get<Record<string, unknown>>('/billing/usage');
  }

  checkout(planId: string) {
    return this.api.post<{ url: string }>('/billing/checkout', { planId });
  }

  openPortal() {
    return this.api.post<{ url: string }>('/billing/portal');
  }

  upgrade(planId: string) {
    return this.api.post('/billing/upgrade', { planId });
  }

  ibanActivate(data: Record<string, unknown>) {
    return this.api.post('/billing/iban-activate', data);
  }
}
