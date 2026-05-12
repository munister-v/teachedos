import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from './api.service';
import { User, AuthResponse, Session } from '../models/user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _user = signal<User | null>(null);
  private readonly _loading = signal(true);

  readonly user = this._user.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly isLoggedIn = computed(() => !!this._user());
  readonly isTeacher = computed(() => {
    const u = this._user();
    return u?.role === 'teacher' || u?.role === 'admin';
  });
  readonly isAdmin = computed(() => this._user()?.role === 'admin');

  constructor(
    private api: ApiService,
    private router: Router,
  ) {
    this.checkAuth();
  }

  private checkAuth(): void {
    const token = localStorage.getItem('token');
    if (!token) {
      this._loading.set(false);
      return;
    }
    this.api.get<{ user: User }>('/auth/me').subscribe({
      next: (res) => {
        this._user.set(res.user);
        this._loading.set(false);
      },
      error: () => {
        localStorage.removeItem('token');
        this._loading.set(false);
      },
    });
  }

  login(email: string, password: string) {
    return this.api.post<AuthResponse>('/auth/login', { email, password });
  }

  register(data: { email: string; password: string; name: string; role?: string; avatar?: string }) {
    return this.api.post<AuthResponse>('/auth/register', data);
  }

  handleAuthSuccess(res: AuthResponse): void {
    localStorage.setItem('token', res.token);
    this._user.set(res.user);
    this.router.navigate(['/home']);
  }

  logout(): void {
    this.api.post('/auth/logout').subscribe({ error: () => {} });
    localStorage.removeItem('token');
    this._user.set(null);
    this.router.navigate(['/']);
  }

  updateProfile(data: Partial<Pick<User, 'name' | 'avatar' | 'meeting_url' | 'zoom_url'>>) {
    return this.api.patch<{ user: User }>('/auth/me', data);
  }

  refreshUser(user: User): void {
    this._user.set(user);
  }

  getSessions() {
    return this.api.get<{ sessions: Session[] }>('/auth/sessions');
  }

  revokeSession(id: string) {
    return this.api.delete(`/auth/sessions/${id}`);
  }
}
