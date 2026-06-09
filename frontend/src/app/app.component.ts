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
import { LayoutService } from './services/layout.service';
import { NgxGaugeModule } from 'ngx-gauge';

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
    MatTooltipModule,
    NgxGaugeModule
  ],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  state = inject(StateService);
  layout = inject(LayoutService);
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
