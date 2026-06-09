import { Component, ElementRef, EventEmitter, Input, Output, ViewChild, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

/**
 * Custom vertical speed slider (Variant A "Refined Material").
 *
 * Round accent +/- step buttons (±`bumpStep`), a clipped accent-fill channel
 * with tick marks, and a wide handle that floats ABOVE the clipped channel
 * (z-index) so it can overhang the track without being cut off. Pointer/touch
 * draggable (`touch-action: none`).
 */
@Component({
    selector: 'app-speed-slider',
    standalone: true,
    imports: [CommonModule, MatIconModule],
    templateUrl: './speed-slider.component.html',
    styleUrls: ['./speed-slider.component.scss']
})
export class SpeedSliderComponent {
    @Input() set value(v: number) {
        this._value.set(this.clamp(v ?? 0));
    }
    get value(): number {
        return this._value();
    }

    @Input() min = 0;
    @Input() max = 126;
    /** Rounding step while dragging. */
    @Input() step = 1;
    /** Step applied by the +/- buttons. */
    @Input() bumpStep = 5;
    @Input() accent = '#1976d2';
    @Input() disabled = false;

    @Output() valueChange = new EventEmitter<number>();

    @ViewChild('track', { static: true }) trackRef!: ElementRef<HTMLElement>;

    private _value = signal(0);
    readonly current = this._value.asReadonly();

    /** Filled / handle position as a percentage (0 at bottom → 100 at top). */
    readonly pct = computed(() => {
        const range = this.max - this.min;
        if (range <= 0) return 0;
        return ((this._value() - this.min) / range) * 100;
    });

    /** 9 evenly spaced tick marks; even indices are visible. */
    readonly ticks = Array.from({ length: 9 });

    private dragging = false;

    onTrackPointerDown(event: PointerEvent): void {
        if (this.disabled) return;
        this.dragging = true;
        (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
        this.setFromPointer(event);
        event.preventDefault();
    }

    onPointerMove(event: PointerEvent): void {
        if (!this.dragging || this.disabled) return;
        this.setFromPointer(event);
        event.preventDefault();
    }

    onPointerUp(event: PointerEvent): void {
        if (!this.dragging) return;
        this.dragging = false;
        (event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
    }

    bump(delta: number): void {
        // Functional update — read the live value each tap so rapid taps don't coalesce.
        this.commit(this._value() + delta);
    }

    private setFromPointer(event: PointerEvent): void {
        const rect = this.trackRef.nativeElement.getBoundingClientRect();
        if (rect.height <= 0) return;
        const ratio = 1 - (event.clientY - rect.top) / rect.height;
        this.commit(this.min + ratio * (this.max - this.min));
    }

    private commit(raw: number): void {
        const stepped = Math.round(raw / this.step) * this.step;
        const next = this.clamp(stepped);
        if (next !== this._value()) {
            this._value.set(next);
            this.valueChange.emit(next);
        }
    }

    private clamp(v: number): number {
        return Math.min(this.max, Math.max(this.min, v));
    }
}
