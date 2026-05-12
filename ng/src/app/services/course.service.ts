import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { Course, CourseModule } from '../models/course';

@Injectable({ providedIn: 'root' })
export class CourseService {
  constructor(private api: ApiService) {}

  getAll() {
    return this.api.get<{ courses: Course[] }>('/courses');
  }

  getById(id: string) {
    return this.api.get<{ course: Course }>(`/courses/${id}`);
  }

  create(data: Partial<Course>) {
    return this.api.post<{ course: Course }>('/courses', data);
  }

  update(id: string, data: Partial<Course>) {
    return this.api.patch<{ course: Course }>(`/courses/${id}`, data);
  }

  delete(id: string) {
    return this.api.delete(`/courses/${id}`);
  }

  addModule(courseId: string, name: string) {
    return this.api.post<{ module: CourseModule }>(`/courses/${courseId}/modules`, { name });
  }

  updateModule(courseId: string, moduleId: string, data: Partial<CourseModule>) {
    return this.api.patch(`/courses/${courseId}/modules/${moduleId}`, data);
  }

  deleteModule(courseId: string, moduleId: string) {
    return this.api.delete(`/courses/${courseId}/modules/${moduleId}`);
  }

  getBoards(courseId: string) {
    return this.api.get(`/courses/${courseId}/boards`);
  }

  getSharedCourses() {
    return this.api.get<{ courses: Course[] }>('/courses/shared/list');
  }
}
