import { Component, inject } from '@angular/core';
import { LayoutService } from '../../services/layout.service';
import { ThrottleDefaultComponent } from './throttle-default/throttle-default.component';
import { ThrottleKioskComponent } from './throttle-kiosk/throttle-kiosk.component';

@Component({
    selector: 'app-main',
    standalone: true,
    imports: [ThrottleDefaultComponent, ThrottleKioskComponent],
    templateUrl: './main.component.html'
})
export class MainComponent {
    layout = inject(LayoutService);
}
