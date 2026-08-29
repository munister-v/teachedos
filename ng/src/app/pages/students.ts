import { Component, signal, OnInit, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MembersService } from '../services/members.service';

@Component({
  selector: 'app-students',
  imports: [RouterLink],
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
