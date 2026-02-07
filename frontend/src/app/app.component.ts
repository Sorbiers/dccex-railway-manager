import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { StateService } from './services/state.service';
import { DccService } from './services/dcc.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule
  ],
  template: `
    <div class="app-container">
      <mat-toolbar color="primary">
        <span>DCC-EX Control</span>

        <span class="spacer"></span>

        <!-- Status indicators -->
        <div class="status-section">
          <span class="status-indicator" [class.connected]="state.status().backend" [class.disconnected]="!state.status().backend"
                matTooltip="Backend {{ state.status().backend ? 'Connected' : 'Disconnected' }}"></span>
          <span class="status-indicator" [class.connected]="state.status().dccex" [class.disconnected]="!state.status().dccex"
                matTooltip="DCC-EX {{ state.status().dccex ? 'Connected' : 'Disconnected' }}"></span>
        </div>

        <!-- Power controls -->
        <div class="power-controls">
          <button mat-icon-button [color]="state.status().power ? 'accent' : ''" (click)="togglePower()"
                  matTooltip="{{ state.status().power ? 'Power On' : 'Power Off' }}">
            <mat-icon>power_settings_new</mat-icon>
          </button>
          <button mat-icon-button class="emergency-stop" (click)="emergencyStop()" matTooltip="Emergency Stop">
            <mat-icon>warning</mat-icon>
          </button>
        </div>

        <!-- Desktop navigation -->
        <nav class="desktop-nav">
          <a mat-button routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}">
            <mat-icon>speed</mat-icon> Throttle
          </a>
          <a mat-button routerLink="/trains" routerLinkActive="active">
            <mat-icon>train</mat-icon> Trains
          </a>
          <a mat-button routerLink="/schedules" routerLinkActive="active">
            <mat-icon>schedule</mat-icon> Schedules
          </a>
          <a mat-button routerLink="/settings" routerLinkActive="active">
            <mat-icon>settings</mat-icon> Settings
          </a>
        </nav>

        <!-- Mobile menu -->
        <button mat-icon-button class="mobile-menu" [matMenuTriggerFor]="menu">
          <mat-icon>menu</mat-icon>
        </button>
        <mat-menu #menu="matMenu">
          <a mat-menu-item routerLink="/">
            <mat-icon>speed</mat-icon> Throttle
          </a>
          <a mat-menu-item routerLink="/trains">
            <mat-icon>train</mat-icon> Trains
          </a>
          <a mat-menu-item routerLink="/schedules">
            <mat-icon>schedule</mat-icon> Schedules
          </a>
          <a mat-menu-item routerLink="/settings">
            <mat-icon>settings</mat-icon> Settings
          </a>
        </mat-menu>
      </mat-toolbar>

      <main class="main-content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .spacer {
      flex: 1;
    }

    .status-section {
      display: flex;
      align-items: center;
      margin-right: 16px;
    }

    .status-indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-left: 8px;
    }

    .status-indicator.connected {
      background-color: #4caf50;
      box-shadow: 0 0 6px #4caf50;
    }

    .status-indicator.disconnected {
      background-color: #f44336;
    }

    .power-controls {
      margin-right: 16px;
    }

    .emergency-stop {
      background-color: #f44336 !important;
      margin-left: 4px;
    }

    nav a.active {
      background-color: rgba(255, 255, 255, 0.1);
    }
  `]
})
export class AppComponent {
  state = inject(StateService);
  private dcc = inject(DccService);

  togglePower(): void {
    this.dcc.setPower(!this.state.status().power);
  }

  emergencyStop(): void {
    this.dcc.emergencyStop();
  }
}
