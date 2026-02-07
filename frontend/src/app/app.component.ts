import { Component, inject, signal, effect, PLATFORM_ID, Renderer2 } from '@angular/core';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
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
    <div class="app-container" [class.dark-theme]="isDarkTheme()">
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

        <!-- Theme toggle -->
        <button mat-icon-button (click)="toggleTheme()" matTooltip="Toggle Theme">
          <mat-icon>{{ isDarkTheme() ? 'light_mode' : 'dark_mode' }}</mat-icon>
        </button>

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

      <!-- Power controls below toolbar -->
      <div class="power-controls-bar">
        <button mat-raised-button [color]="state.status().power ? 'accent' : 'primary'" (click)="togglePower()"
                matTooltip="{{ state.status().power ? 'Power On' : 'Power Off' }}">
          <mat-icon>power_settings_new</mat-icon>
          {{ state.status().power ? 'Power On' : 'Power Off' }}
        </button>
        <button mat-raised-button color="warn" (click)="emergencyStop()" matTooltip="Emergency Stop">
          <mat-icon>warning</mat-icon>
          Emergency Stop
        </button>
      </div>

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

    .power-controls-bar {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 16px;
      padding: 12px 16px;
      background-color: rgba(0, 0, 0, 0.03);
      border-bottom: 1px solid rgba(0, 0, 0, 0.12);
    }

    .dark-theme .power-controls-bar {
      background-color: rgba(255, 255, 255, 0.05);
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    }

    .power-controls-bar button {
      min-width: 140px;
    }

    nav a.active {
      background-color: rgba(255, 255, 255, 0.1);
    }

    @media (max-width: 959px) {
      .desktop-nav {
        display: none !important;
      }
    }

    @media (min-width: 960px) {
      .mobile-menu {
        display: none !important;
      }
    }
  `]
})
export class AppComponent {
  state = inject(StateService);
  private dcc = inject(DccService);
  private platformId = inject(PLATFORM_ID);
  private renderer = inject(Renderer2);
  private document = inject(DOCUMENT);

  isDarkTheme = signal(false);

  constructor() {
    // Load theme preference from localStorage
    if (isPlatformBrowser(this.platformId)) {
      const savedTheme = localStorage.getItem('theme');
      this.isDarkTheme.set(savedTheme === 'dark');
      this.applyThemeToBody(savedTheme === 'dark');
    }

    // Watch for theme changes and apply to body
    effect(() => {
      if (isPlatformBrowser(this.platformId)) {
        this.applyThemeToBody(this.isDarkTheme());
      }
    });
  }

  private applyThemeToBody(isDark: boolean): void {
    if (isDark) {
      this.renderer.addClass(this.document.body, 'dark-theme');
    } else {
      this.renderer.removeClass(this.document.body, 'dark-theme');
    }
  }

  toggleTheme(): void {
    this.isDarkTheme.update(v => !v);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('theme', this.isDarkTheme() ? 'dark' : 'light');
    }
  }

  togglePower(): void {
    this.dcc.setPower(!this.state.status().power);
  }

  emergencyStop(): void {
    this.dcc.emergencyStop();
  }
}
