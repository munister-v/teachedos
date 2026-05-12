export interface User {
  id: string;
  email: string;
  name: string;
  role: 'teacher' | 'student' | 'admin';
  avatar: string;
  plan?: string;
  meeting_url?: string;
  zoom_url?: string;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Session {
  id: string;
  user_agent: string;
  ip: string;
  created_at: string;
  expires_at: string;
}
