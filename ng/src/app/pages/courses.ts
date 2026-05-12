import { Component, signal, OnInit, ViewEncapsulation } from '@angular/core';
import { CourseService } from '../services/course.service';
import { Course } from '../models/course';

@Component({
  selector: 'app-courses',
  templateUrl: './courses.html',
  styleUrl: './courses.scss',
  encapsulation: ViewEncapsulation.None
})
export class Courses implements OnInit {
  courses = signal<Course[]>([]);
  loading = signal(true);

  constructor(private courseService: CourseService) {}

  ngOnInit(): void {
    this.courseService.getAll().subscribe({
      next: (res) => {
        this.courses.set(res.courses || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
