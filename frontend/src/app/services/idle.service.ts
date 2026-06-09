import { Injectable, NgZone, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { LayoutService } from './layout.service';
import { StateService } from './state.service';
import { ApiService } from './api.service';

/**
 * Idle screen blanking for the kiosk (power saving on the Pi battery panel).
 *
 * After an idle period the DSI backlight is turned off via the backend
 * `/api/display` endpoint; any touch/key wakes it. The timeout depends on
 * DCC-EX track power: 30 min while powered on, 5 min while off. Only active in
 * kiosk mode. The touch panel keeps reporting while the backlight is off, so a
 * tap both wakes the screen and is swallowed by the blank overlay.
 */
@Injectable({ providedIn: 'root' })
export class IdleService {
    private layout = inject(LayoutService);
    private state = inject(StateService);
    private api = inject(ApiService);
    private zone = inject(NgZone);
    private platformId = inject(PLATFORM_ID);

    private readonly ON_MS = 30 * 60 * 1000;
    private readonly OFF_MS = 5 * 60 * 1000;
    private readonly EVENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel'];

    private _blanked = signal(false);
    readonly blanked = this._blanked.asReadonly();

    private timer: ReturnType<typeof setTimeout> | null = null;
    private started = false;

    constructor() {
        if (!isPlatformBrowser(this.platformId)) return;

        // Start/stop with kiosk mode.
        effect(() => {
            const kiosk = this.layout.kiosk();
            if (kiosk && !this.started) this.start();
            else if (!kiosk && this.started) this.stop();
        });

        // Re-arm when track power changes or the "Disable screen off" setting toggles.
        effect(() => {
            this.state.statePowerMAIN();
            const disabled = this.blankingDisabled();
            if (!this.started) return;
            if (disabled) {
                if (this.timer) { clearTimeout(this.timer); this.timer = null; }
                if (this._blanked()) this.wake();
            } else if (!this._blanked()) {
                this.resetTimer();
            }
        });
    }

    /** "Disable screen off" setting — when true, never auto-blank. */
    private blankingDisabled(): boolean {
        return !!this.state.settings()?.ui?.disableScreenOff;
    }

    private start(): void {
        this.started = true;
        this.zone.runOutsideAngular(() => {
            this.EVENTS.forEach(ev =>
                document.addEventListener(ev, this.activity, { passive: true, capture: true }));
        });
        this.resetTimer();
    }

    private stop(): void {
        this.started = false;
        this.EVENTS.forEach(ev =>
            document.removeEventListener(ev, this.activity, { capture: true } as EventListenerOptions));
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
    }

    private activity = (): void => {
        if (this._blanked()) {
            this.zone.run(() => this.wake());
        } else {
            this.resetTimer();
        }
    };

    private timeoutMs(): number {
        return this.state.statePowerMAIN() ? this.ON_MS : this.OFF_MS;
    }

    private resetTimer(): void {
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
        if (!this.started || this.blankingDisabled()) return;
        this.timer = setTimeout(() => this.zone.run(() => this.blank()), this.timeoutMs());
    }

    private blank(): void {
        if (this._blanked()) return;
        this._blanked.set(true);
        this.api.setBacklight(false).subscribe({ error: () => { } });
    }

    /** Wake the screen (called by the blank overlay tap and by any input). */
    wake(): void {
        if (!this._blanked()) return;
        this._blanked.set(false);
        this.api.setBacklight(true).subscribe({ error: () => { } });
        this.resetTimer();
    }
}
