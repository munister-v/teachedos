import { Component, signal, OnInit, ViewEncapsulation } from '@angular/core';
import { AdminService } from '../services/admin.service';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
  encapsulation: ViewEncapsulation.None
})
export class Admin implements OnInit {
  stats = signal<Record<string, unknown>>({});
  users = signal<unknown[]>([]);
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
    this.adminService.getUsers().subscribe({
      next: (res: Record<string, unknown>) => {
        const users = res['users'];
        this.users.set(Array.isArray(users) ? users : []);
      },
      error: () => {},
    });
  }

  deleteUser(id: string): void {
    this.adminService.deleteUser(id).subscribe({
      next: () => {
        this.users.update(list => list.filter((u: unknown) => (u as Record<string, unknown>)['id'] !== id));
      },
    });
  }
}
