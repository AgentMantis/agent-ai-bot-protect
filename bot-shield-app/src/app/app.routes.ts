import { Routes } from '@angular/router';
import { AllowedBotsComponent } from './components/allowed-bots/allowed-bots.component';
import { SettingsComponent } from './components/settings/settings.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent),
  },
  { 
    path: 'settings', 
    component: SettingsComponent
  },
  { 
    path: 'allowed-bots', 
    loadComponent: () => import('./components/allowed-bots/allowed-bots.component').then(m => m.AllowedBotsComponent)
  }
];
