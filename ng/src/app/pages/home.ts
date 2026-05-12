import { Component, AfterViewInit, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ScheduleService } from '../services/schedule.service';
import { BoardService } from '../services/board.service';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.scss',
  encapsulation: ViewEncapsulation.None
})
export class Home implements AfterViewInit {
  constructor(
    private auth: AuthService,
    private scheduleService: ScheduleService,
    private boardService: BoardService,
  ) {}

  ngAfterViewInit(): void {
    this.initClock();
    this.initDock();
    this.loadUserData();
  }

  private initClock(): void {
    const tick = () => {
      const now = new Date();
      const h = now.getHours().toString().padStart(2, '0');
      const m = now.getMinutes().toString().padStart(2, '0');
      const el = document.getElementById('wg-time');
      if (el) el.innerHTML = `${h}<em>:</em>${m}`;

      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
      const dateEl = document.getElementById('wg-date');
      if (dateEl) dateEl.textContent = `${days[now.getDay()]} · ${months[now.getMonth()]} ${now.getDate()}`;

      const clockEl = document.getElementById('mb-clock');
      if (clockEl) clockEl.textContent = `${h}:${m}`;
    };
    tick();
    setInterval(tick, 30000);
  }

  private initDock(): void {
    document.querySelectorAll<HTMLElement>('.dock-item').forEach(el => {
      el.addEventListener('mouseenter', () => {
        el.style.transform = 'scale(1.25) translateY(-8px)';
      });
      el.addEventListener('mouseleave', () => {
        el.style.transform = '';
      });
    });
  }

  private loadUserData(): void {
    const user = this.auth.user();
    if (user) {
      const chip = document.getElementById('desktop-user-chip');
      if (chip) {
        chip.textContent = user.name;
        chip.style.display = 'flex';
      }
      const langEl = document.querySelector('.wg-clock-lang');
      if (langEl) langEl.textContent = `👩‍🏫 ${user.name}`;
    }

    this.scheduleService.getAll().subscribe({
      next: (res) => {
        const classes = res.classes || [];
        const streak = document.querySelector('.wg-streak-n');
        if (streak) streak.textContent = classes.length.toString();
        const streakSub = document.querySelector('.wg-streak-sub');
        if (streakSub) streakSub.textContent = classes.length > 0 ? 'Keep it up!' : 'No classes yet';

        if (classes.length > 0) {
          const next = classes[0];
          const titleEl = document.querySelector('.wg-today-title');
          if (titleEl) titleEl.textContent = next.title || next.group_name || '—';
          const metaEl = document.querySelector('.wg-today-meta span');
          if (metaEl) metaEl.textContent = `${next.start_time} · ${next.level || ''}`;
        }
      },
      error: () => {},
    });

    this.boardService.getAll().subscribe({
      next: (res) => {
        const boards = res.boards || [];
        const vocabWord = document.querySelector('.wg-vocab-word');
        if (vocabWord) vocabWord.textContent = `${boards.length} boards`;
        const vocabLang = document.querySelector('.wg-vocab-lang');
        if (vocabLang) vocabLang.textContent = boards.length > 0 ? 'Ready to teach' : 'Create your first board';
      },
      error: () => {},
    });
  }
}
