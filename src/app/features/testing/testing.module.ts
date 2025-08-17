/**
 * Testing Module
 * Comprehensive testing and validation system
 */

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { FormsModule } from '@angular/forms';

import { TestingDashboardComponent } from './testing-dashboard.component';

const routes: Routes = [
  {
    path: '',
    component: TestingDashboardComponent,
    title: 'Testing & Validation - Vision Mouse'
  }
];

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    RouterModule.forChild(routes),
    TestingDashboardComponent
  ],
  exports: [RouterModule]
})
export class TestingModule { }
