import { Component } from '@angular/core';
import { ThrottleKioskComponent } from './throttle-kiosk/throttle-kiosk.component';

@Component({
    selector: 'app-main',
    standalone: true,
    imports: [ThrottleKioskComponent],
    templateUrl: './main.component.html'
})
export class MainComponent {}
