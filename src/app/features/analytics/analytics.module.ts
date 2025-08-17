/**
 * Analytics Module
 * Advanced ML-based analytics and data visualization
 */

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { AnalyticsDashboardComponent } from './analytics-dashboard.component';

const routes: Routes = [
  {
    path: '',
    component: AnalyticsDashboardComponent,
    title: 'Advanced Analytics - Vision Mouse'
  }
];

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes),
    AnalyticsDashboardComponent
  ],
  exports: [RouterModule]
})
export class AnalyticsModule { }
