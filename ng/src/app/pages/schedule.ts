import { Component, signal, OnInit, ViewEncapsulation } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ScheduleService } from '../services/schedule.service';
import { AuthService } from '../services/auth.service';
import { ScheduleEntry } from '../models/schedule';
import { BottomTabs } from '../shared/bottom-tabs';

@Component({
  selector: 'app-schedule',
  imports: [RouterLink, RouterLinkActive, BottomTabs],
  templateUrl: './schedule.html',
  styleUrl: './schedule.scss',
  encapsulation: ViewEncapsulation.None
})
export class Schedule implements OnInit {
  classes = signal<ScheduleEntry[]>([]);
  loading = signal(true);

  constructor(
    private scheduleService: ScheduleService,
    private auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.scheduleService.getAll().subscribe({
      next: (res) => {
        this.classes.set(res.classes || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  addClass(): void {
    // TODO: Open modal to add class
  }

  deleteClass(id: string): void {
    this.scheduleService.delete(id).subscribe({
      next: () => {
        this.classes.update(list => list.filter(c => c.id !== id));
      },
    });
  }
}
