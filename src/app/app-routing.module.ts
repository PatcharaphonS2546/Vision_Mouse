import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

// New Architecture Components
import { AppShellComponent } from './features/shell/app-shell.component';
import { WelcomeComponent } from './features/welcome/welcome.component';
import { CalibrationComponent as NewCalibrationComponent } from './features/calibration/calibration.component';
import { TrackingWorkspaceComponent } from './features/tracking/tracking-workspace.component';

// Keep only essential legacy components
import { PerformanceDashboardComponent } from './components/performance-dashboard/performance-dashboard.component';

const routes: Routes = [
  {
    path: '',
    component: AppShellComponent,
    children: [
      { path: '', redirectTo: '/welcome', pathMatch: 'full' },
      { path: 'welcome', component: WelcomeComponent },
      { path: 'calibration-new', component: NewCalibrationComponent },
      { path: 'tracking', component: TrackingWorkspaceComponent },
      { path: 'performance', component: PerformanceDashboardComponent },
      {
        path: 'analytics',
        loadChildren: () => import('./features/analytics/analytics.module').then(m => m.AnalyticsModule)
      },
      {
        path: 'testing',
        loadChildren: () => import('./features/testing/testing.module').then(m => m.TestingModule)
      }
    ]
  },
  { path: '**', redirectTo: '/welcome' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
