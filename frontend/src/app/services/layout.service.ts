import { Injectable, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * Layout / device role.
 *
 * The app now renders a single interface — the former "kiosk" layout — on every
 * device; the old desktop throttle/toolbar layout has been retired. `kiosk` is
 * therefore always true and is kept only so the existing `[class.kiosk]` /
 * `layout.kiosk()` bindings (which drive the `--k-*` theme variables and shell)
 * keep resolving.
 *
 * `panel` is a separate concern: it reports whether this is an actual short,
 * wide kiosk *panel* (e.g. the Pi's 800x480 touch screen). It gates power
 * saving (idle backlight blanking) only — never the UI — so that a desktop
 * browser pointed at the same backend can never blank the Pi's physical screen.
 * Auto-detected from the viewport, with a manual `?kiosk=1` / `?kiosk=0`
 * override persisted to localStorage.
 */
@Injectable({ providedIn: 'root' })
export class LayoutService {
    private platformId = inject(PLATFORM_ID);

    /** UI layout — always the kiosk interface now. */
    readonly kiosk = signal(true).asReadonly();

    /** Manual override for panel detection: true/false to force, null to auto-detect. */
    private override: boolean | null = null;

    private _panel = signal<boolean>(false);
    /** True on an actual kiosk panel (short, wide touch screen); gates power saving. */
    readonly panel = this._panel.asReadonly();

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
        this._panel.set(this.compute());
    }

    private compute(): boolean {
        if (this.override !== null) {
            return this.override;
        }
        // Short landscape display (e.g. 800x480 kiosk panel).
        return window.innerHeight <= 540 && window.innerWidth >= 640;
    }
}
