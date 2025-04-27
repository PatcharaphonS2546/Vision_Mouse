import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GazeTrackerComponent } from './gaze-tracker.component';

describe('GazeTrackerComponent', () => {
  let component: GazeTrackerComponent;
  let fixture: ComponentFixture<GazeTrackerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [GazeTrackerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GazeTrackerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
