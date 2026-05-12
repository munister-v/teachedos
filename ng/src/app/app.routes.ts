import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/landing').then(m => m.Landing) },
  { path: 'home', loadComponent: () => import('./pages/home').then(m => m.Home) },
  { path: 'schedule', loadComponent: () => import('./pages/schedule').then(m => m.Schedule) },
  { path: 'profile', loadComponent: () => import('./pages/profile').then(m => m.Profile) },
  { path: 'board', loadComponent: () => import('./pages/board').then(m => m.Board) },
  { path: 'student', loadComponent: () => import('./pages/students').then(m => m.Students) },
  { path: 'portal', loadComponent: () => import('./pages/portal').then(m => m.Portal) },
  { path: 'courses', loadComponent: () => import('./pages/courses').then(m => m.Courses) },
  { path: 'gradebook', loadComponent: () => import('./pages/gradebook').then(m => m.Gradebook) },
  { path: 'journal', loadComponent: () => import('./pages/journal').then(m => m.Journal) },
  { path: 'analytics', loadComponent: () => import('./pages/analytics').then(m => m.Analytics) },
  { path: 'admin', loadComponent: () => import('./pages/admin').then(m => m.Admin) },
  { path: 'billing-success', loadComponent: () => import('./pages/billing-success').then(m => m.BillingSuccess) },
  { path: 'games', loadComponent: () => import('./pages/games-hub').then(m => m.GamesHub) },
  { path: '**', redirectTo: '' },
];
