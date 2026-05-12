import { Component, signal, OnInit, ViewEncapsulation } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MembersService } from '../services/members.service';
import { BottomTabs } from '../shared/bottom-tabs';

@Component({
  selector: 'app-students',
  imports: [RouterLink, RouterLinkActive, BottomTabs],
  templateUrl: './students.html',
  styleUrl: './students.scss',
  encapsulation: ViewEncapsulation.None
})
export class Students implements OnInit {
  boards = signal<unknown[]>([]);
  loading = signal(true);

  constructor(private membersService: MembersService) {}

  ngOnInit(): void {
    this.membersService.getMyBoards().subscribe({
      next: (res: Record<string, unknown>) => {
        const boards = res['boards'];
        this.boards.set(Array.isArray(boards) ? boards : []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
