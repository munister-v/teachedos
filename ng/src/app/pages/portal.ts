import { Component, signal, OnInit, ViewEncapsulation } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { StudentService } from '../services/student.service';

@Component({
  selector: 'app-portal',
  templateUrl: './portal.html',
  styleUrl: './portal.scss',
  encapsulation: ViewEncapsulation.None
})
export class Portal implements OnInit {
  portalData = signal<Record<string, unknown>>({});
  loading = signal(true);

  constructor(
    private studentService: StudentService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.studentService.getPortal(id).subscribe({
        next: (res) => {
          this.portalData.set(res);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    } else {
      this.studentService.getDashboard().subscribe({
        next: (res) => {
          this.portalData.set(res);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    }
  }
}
