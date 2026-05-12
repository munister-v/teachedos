export interface Course {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  level?: string;
  color?: string;
  modules?: CourseModule[];
  created_at: string;
}

export interface CourseModule {
  id: string;
  course_id: string;
  name: string;
  order: number;
  boards?: string[];
}
