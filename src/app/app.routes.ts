import { Routes } from '@angular/router';
export const routes: Routes = [
{ path: 'builder', loadComponent: () => import('./builder/builder').then((m) => m.Builder) },
{ path: 'decks', loadComponent: () => import('./decks/decks').then((m) => m.Decks) },
{ path: '**', redirectTo: 'builder' },
];
