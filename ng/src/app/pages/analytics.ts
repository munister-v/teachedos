import { Component, signal, OnInit, ViewEncapsulation } from '@angular/core';
import { AdminService } from '../services/admin.service';

@Component({
  selector: 'app-analytics',
  templateUrl: './analytics.html',
  styleUrl: './analytics.scss',
  encapsulation: ViewEncapsulation.None
})
export class Analytics implements OnInit {
  stats = signal<Record<string, unknown>>({});
  loading = signal(true);

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.adminService.getStats().subscribe({
      next: (res) => {
        this.stats.set(res);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
