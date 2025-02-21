import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent),
    pathMatch: 'full'
  },
  { 
    path: 'settings', 
    loadComponent: () => import('./components/settings/settings.component').then(m => m.SettingsComponent)
  },
  { 
    path: 'allowed-bots', 
    loadComponent: () => import('./components/allowed-bots/allowed-bots.component').then(m => m.AllowedBotsComponent)
  }
];
