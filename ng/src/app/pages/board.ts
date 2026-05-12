import { Component, signal, OnInit, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { BoardService } from '../services/board.service';
import { Board as BoardModel } from '../models/board';

@Component({
  selector: 'app-board',
  templateUrl: './board.html',
  styleUrl: './board.scss',
  encapsulation: ViewEncapsulation.None
})
export class Board implements OnInit {
  boards = signal<BoardModel[]>([]);
  activeBoard = signal<BoardModel | null>(null);
  loading = signal(true);

  constructor(
    private boardService: BoardService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.boardService.getById(id).subscribe({
        next: (res) => {
          this.activeBoard.set(res.board);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    } else {
      this.boardService.getAll().subscribe({
        next: (res) => {
          this.boards.set(res.boards || []);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    }
  }
}
