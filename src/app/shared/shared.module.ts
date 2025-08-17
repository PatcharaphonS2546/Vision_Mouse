/**
 * Shared Module
 * Contains reusable components and utilities
 */

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { NotificationToastComponent } from './components/notification-toast.component';

// Export components
export { NotificationToastComponent } from './components/notification-toast.component';

@NgModule({
  imports: [
    CommonModule,
    NotificationToastComponent // Import standalone component
  ],
  exports: [
    NotificationToastComponent
  ]
})
export class SharedModule {}
