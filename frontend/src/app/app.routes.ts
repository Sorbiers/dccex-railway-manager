import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/main/main.component').then(m => m.MainComponent)
  },
  {
    path: 'trains',
    loadComponent: () => import('./pages/trains/trains.component').then(m => m.TrainsComponent)
  },
  {
    path: 'schedules',
    loadComponent: () => import('./pages/schedules/schedules.component').then(m => m.SchedulesComponent)
  },
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
