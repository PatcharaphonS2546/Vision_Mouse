import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: '<router-outlet></router-outlet>',
  standalone: false,
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'VisionControl';
}
