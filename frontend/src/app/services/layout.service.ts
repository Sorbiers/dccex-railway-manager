import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Tracks which throttle layout to render.
 *
 * Auto-detects a "kiosk" device (a short, wide touch screen such as the
 * 800x480 panel) from the viewport, but allows a manual override via the
 * `?kiosk=1` / `?kiosk=0` query param, which is persisted to localStorage.
 */
@Injectable({ providedIn: 'root' })
export class LayoutService {
    private platformId = inject(PLATFORM_ID);

    /** Manual override: true/false to force, null to auto-detect. */
    private override: boolean | null = null;

    private _kiosk = signal<boolean>(false);
    readonly kiosk = this._kiosk.asReadonly();

    constructor() {
        if (!isPlatformBrowser(this.platformId)) {
            return;
        }

        this.override = this.readOverride();
        this.update();

        window.addEventListener('resize', () => this.update());
    }

    private readOverride(): boolean | null {
        const params = new URLSearchParams(window.location.search);
        const param = params.get('kiosk');
        if (param === '1' || param === 'true') {
            localStorage.setItem('kiosk', '1');
            return true;
        }
        if (param === '0' || param === 'false') {
            localStorage.setItem('kiosk', '0');
            return false;
        }

        const stored = localStorage.getItem('kiosk');
        if (stored === '1') return true;
        if (stored === '0') return false;
        return null;
    }

    private update(): void {
        this._kiosk.set(this.compute());
    }

    private compute(): boolean {
        if (this.override !== null) {
            return this.override;
        }
        // Short landscape display (e.g. 800x480 kiosk panel).
        return window.innerHeight <= 540 && window.innerWidth >= 640;
    }
}
