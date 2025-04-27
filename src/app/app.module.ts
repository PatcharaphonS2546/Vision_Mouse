import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { GazeTrackerComponent } from './components/gaze-tracker/gaze-tracker.component';
import { CalibrationComponent } from './components/calibration/calibration.component';


@NgModule({
  declarations: [
    AppComponent,

  ],
  imports: [
    BrowserModule,
    GazeTrackerComponent,
    AppRoutingModule,
    CalibrationComponent
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
