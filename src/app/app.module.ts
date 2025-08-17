import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

// New Architecture Modules
import { CoreModule } from './core/core.module';
import { SharedModule } from './shared/shared.module';

// Remove all legacy services imports - using only modern core services
@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    
    // New Architecture Modules
    CoreModule,
    SharedModule
  ],
  providers: [
    // All services are now provided through CoreModule
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
