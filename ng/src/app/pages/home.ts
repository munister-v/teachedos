import { Component, computed, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ScheduleService } from '../services/schedule.service';
import { BoardService } from '../services/board.service';

@Component({
  selector: 'app-home',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home implements OnInit {
  constructor(
    private auth: AuthService,
    private scheduleService: ScheduleService,
    private boardService: BoardService,
  ) {}

  userName = computed(() => this.auth.user()?.name?.split(' ')[0] || 'Teacher');

  userInitials = computed(() => {
    const name = this.auth.user()?.name || 'T';
    const parts = name.split(' ');
    return parts.length > 1
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : parts[0].substring(0, 2).toUpperCase();
  });

  todayLabel = computed(() => {
    const d = new Date();
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return `${days[d.getDay()]} · ${months[d.getMonth()]} ${d.getDate()}`;
  });

  ngOnInit(): void {
    this.boardService.getAll().subscribe({ error: () => {} });
    this.scheduleService.getAll().subscribe({ error: () => {} });
  }
}
