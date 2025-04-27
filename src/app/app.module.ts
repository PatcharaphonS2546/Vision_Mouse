import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { GazeTrackerComponent } from './components/gaze-tracker/gaze-tracker.component';
import { CalibrationComponent } from './components/calibration/calibration.component';
import { FormsModule } from '@angular/forms';
import { VideoSourceComponent } from './components/video-source/video-source.component';



@NgModule({
  declarations: [
    AppComponent,
    VideoSourceComponent,
  ],
  imports: [
    BrowserModule,
    CalibrationComponent,
    FormsModule,
    GazeTrackerComponent
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
