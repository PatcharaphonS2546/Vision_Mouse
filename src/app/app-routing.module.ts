import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MainDashboardComponent } from './components/main-dashboard/main-dashboard.component';
import { ModernDashboardComponent } from './components/modern-dashboard/modern-dashboard.component';
import { AdvancedGazeTrackerComponent } from './components/advanced-gaze-tracker/advanced-gaze-tracker.component';
import { CalibrationComponent } from './components/calibration/calibration.component';
import { GazeTrackerComponent } from './components/gaze-tracker/gaze-tracker.component';
import { EyeTrackingTestComponent } from './components/eye-tracking-test/eye-tracking-test.component';

const routes: Routes = [
  { path: '', component: ModernDashboardComponent },
  { path: 'dashboard', component: MainDashboardComponent },
  { path: 'advanced-tracker', component: AdvancedGazeTrackerComponent },
  { path: 'tracker', component: GazeTrackerComponent },
  { path: 'calibration', component: CalibrationComponent },
  { path: 'test', component: EyeTrackingTestComponent },
  { path: '**', redirectTo: '/' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
