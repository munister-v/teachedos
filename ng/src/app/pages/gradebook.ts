import { Component, signal, OnInit, ViewEncapsulation } from '@angular/core';
import { BoardService } from '../services/board.service';

@Component({
  selector: 'app-gradebook',
  templateUrl: './gradebook.html',
  styleUrl: './gradebook.scss',
  encapsulation: ViewEncapsulation.None
})
export class Gradebook implements OnInit {
  results = signal<unknown[]>([]);
  loading = signal(true);

  constructor(private boardService: BoardService) {}

  ngOnInit(): void {
    this.boardService.getAll().subscribe({
      next: () => this.loading.set(false),
      error: () => this.loading.set(false),
    });
  }
}
