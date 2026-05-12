import { Component, signal, OnInit, ViewEncapsulation } from '@angular/core';
import { JournalService } from '../services/journal.service';
import { JournalEntry, VocabItem } from '../models/journal';

@Component({
  selector: 'app-journal',
  templateUrl: './journal.html',
  styleUrl: './journal.scss',
  encapsulation: ViewEncapsulation.None
})
export class Journal implements OnInit {
  entries = signal<JournalEntry[]>([]);
  vocab = signal<VocabItem[]>([]);
  loading = signal(true);

  constructor(private journalService: JournalService) {}

  ngOnInit(): void {
    this.journalService.getAll().subscribe({
      next: (res) => {
        this.entries.set(res.entries || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.journalService.getVocab().subscribe({
      next: (res) => this.vocab.set(res.vocab || []),
      error: () => {},
    });
  }
}
