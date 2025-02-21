import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./app.component').then(m => m.AppComponent)
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
