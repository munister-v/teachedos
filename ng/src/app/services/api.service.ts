import { Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private get headers(): HttpHeaders {
    const token = localStorage.getItem('token');
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  get<T>(path: string) {
    return this.http.get<T>(`${this.baseUrl}${path}`, { headers: this.headers });
  }

  post<T>(path: string, body: unknown = {}) {
    return this.http.post<T>(`${this.baseUrl}${path}`, body, { headers: this.headers });
  }

  patch<T>(path: string, body: unknown = {}) {
    return this.http.patch<T>(`${this.baseUrl}${path}`, body, { headers: this.headers });
  }

  put<T>(path: string, body: unknown = {}) {
    return this.http.put<T>(`${this.baseUrl}${path}`, body, { headers: this.headers });
  }

  delete<T>(path: string) {
    return this.http.delete<T>(`${this.baseUrl}${path}`, { headers: this.headers });
  }
}
