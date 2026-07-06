import { Component, inject, signal, effect, PLATFORM_ID, Renderer2 } from '@angular/core';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { StateService } from './services/state.service';
import { DccService } from './services/dcc.service';
import { LayoutService } from './services/layout.service';
import { IdleService } from './services/idle.service';
import { NgxGaugeModule } from 'ngx-gauge';
import { filter } from 'rxjs';

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
  idle = inject(IdleService);
  private dcc = inject(DccService);
  private platformId = inject(PLATFORM_ID);
  private renderer = inject(Renderer2);
  private document = inject(DOCUMENT);
  private router = inject(Router);

  isDarkTheme = signal(false);
  currentUrl = signal('/');
  private kioskScrollLastY: number | null = null;

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

    this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe(event => {
      this.currentUrl.set((event as NavigationEnd).urlAfterRedirects.split('?')[0]);
    });
  }

  isKioskMainRoute(): boolean {
    return this.currentUrl() === '/';
  }

  private kioskRouteCanScroll(): boolean {
    return this.layout.kiosk() && !this.isKioskMainRoute();
  }

  onKioskScrollStart(event: TouchEvent): void {
    if (!this.kioskRouteCanScroll() || event.touches.length !== 1) {
      this.kioskScrollLastY = null;
      return;
    }

    this.kioskScrollLastY = event.touches[0].clientY;
  }

  onKioskScrollMove(event: TouchEvent): void {
    if (!this.kioskRouteCanScroll() || this.kioskScrollLastY === null || event.touches.length !== 1) {
      return;
    }

    const currentY = event.touches[0].clientY;
    const deltaY = this.kioskScrollLastY - currentY;
    const target = event.currentTarget as HTMLElement | null;
    if (target && target.scrollHeight > target.clientHeight) {
      target.scrollTop += deltaY;
      event.preventDefault();
    }
    this.kioskScrollLastY = currentY;
  }

  onKioskScrollEnd(): void {
    this.kioskScrollLastY = null;
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

  onWake(event: Event): void {
    // Swallow the wake tap so it doesn't trigger a control underneath.
    event.preventDefault();
    event.stopPropagation();
    this.idle.wake();
  }
}
