import { Component, signal, computed, inject, OnInit, ViewEncapsulation } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { BillingService } from '../services/billing.service';
import { BottomTabs } from '../shared/bottom-tabs';
import { Session } from '../models/user';

@Component({
  selector: 'app-profile',
  imports: [RouterLink, RouterLinkActive, BottomTabs],
  templateUrl: './profile.html',
  styleUrl: './profile.scss',
  encapsulation: ViewEncapsulation.None
})
export class Profile implements OnInit {
  private auth = inject(AuthService);
  private billing = inject(BillingService);

  sessions = signal<Session[]>([]);

  user = this.auth.user;
  userName = computed(() => this.auth.user()?.name || '');
  userEmail = computed(() => this.auth.user()?.email || '');
  userPlan = computed(() => this.auth.user()?.plan || 'free');

  ngOnInit(): void {
    this.auth.getSessions().subscribe({
      next: (res) => this.sessions.set(res.sessions || []),
      error: () => {},
    });
  }

  logout(): void {
    this.auth.logout();
  }
}
