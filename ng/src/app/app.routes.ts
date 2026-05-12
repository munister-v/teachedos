import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './services/auth.guard';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/landing').then(m => m.Landing) },
  { path: 'home', loadComponent: () => import('./pages/home').then(m => m.Home), canActivate: [authGuard] },
  { path: 'schedule', loadComponent: () => import('./pages/schedule').then(m => m.Schedule), canActivate: [authGuard] },
  { path: 'profile', loadComponent: () => import('./pages/profile').then(m => m.Profile), canActivate: [authGuard] },
  { path: 'board', loadComponent: () => import('./pages/board').then(m => m.Board), canActivate: [authGuard] },
  { path: 'board/:id', loadComponent: () => import('./pages/board').then(m => m.Board), canActivate: [authGuard] },
  { path: 'student', loadComponent: () => import('./pages/students').then(m => m.Students), canActivate: [authGuard] },
  { path: 'portal', loadComponent: () => import('./pages/portal').then(m => m.Portal), canActivate: [authGuard] },
  { path: 'portal/:id', loadComponent: () => import('./pages/portal').then(m => m.Portal), canActivate: [authGuard] },
  { path: 'courses', loadComponent: () => import('./pages/courses').then(m => m.Courses), canActivate: [authGuard] },
  { path: 'gradebook', loadComponent: () => import('./pages/gradebook').then(m => m.Gradebook), canActivate: [authGuard] },
  { path: 'journal', loadComponent: () => import('./pages/journal').then(m => m.Journal), canActivate: [authGuard] },
  { path: 'analytics', loadComponent: () => import('./pages/analytics').then(m => m.Analytics), canActivate: [authGuard] },
  { path: 'admin', loadComponent: () => import('./pages/admin').then(m => m.Admin), canActivate: [authGuard, adminGuard] },
  { path: 'billing-success', loadComponent: () => import('./pages/billing-success').then(m => m.BillingSuccess) },
  { path: 'games', loadComponent: () => import('./pages/games-hub').then(m => m.GamesHub), canActivate: [authGuard] },
  { path: '**', redirectTo: '' },
];
