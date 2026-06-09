import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

interface GaugeTick {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    lit: boolean;
    major: boolean;
}

/**
 * Radial speed gauge. Drag anywhere on the dial to set speed.
 * Shows the actual (eased/feedback) speed as a filled arc + lit ticks, and the
 * commanded speed as a ring marker. Center reads the actual step in Rajdhani.
 */
@Component({
    selector: 'app-speed-gauge',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './speed-gauge.component.html',
    styleUrls: ['./speed-gauge.component.scss']
})
export class SpeedGaugeComponent {
    /** Commanded speed (set point). */
    @Input() set = 0;
    /** Actual / feedback speed. */
    @Input() actual = 0;
    @Input() max = 126;
    @Input() accent = '#1976d2';
    @Input() isOn = true;
    @Input() size = 188;

    @Output() speedChange = new EventEmitter<number>();

    @ViewChild('dial', { static: true }) dialRef!: ElementRef<HTMLElement>;

    readonly START = 135;
    readonly SWEEP = 270;

    private drag = false;

    get cx(): number { return this.size / 2; }
    get cy(): number { return this.size / 2; }
    get R(): number { return this.size * 0.407; }
    get s(): number { return this.size / 290; }
    get strokeW(): number { return 20 * this.s; }
    get bigFont(): number { return 96 * this.s; }

    get fAct(): number {
        return this.max ? Math.max(0, Math.min(1, this.actual / this.max)) : 0;
    }
    get fSet(): number {
        return this.max ? Math.max(0, Math.min(1, this.set / this.max)) : 0;
    }

    private polar(r: number, deg: number): [number, number] {
        const a = (deg * Math.PI) / 180;
        return [this.cx + r * Math.cos(a), this.cy + r * Math.sin(a)];
    }

    private arc(r: number, startDeg: number, endDeg: number): string {
        const [x1, y1] = this.polar(r, startDeg);
        const [x2, y2] = this.polar(r, endDeg);
        const large = (endDeg - startDeg) % 360 > 180 ? 1 : 0;
        return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
    }

    get trackPath(): string {
        return this.arc(this.R, this.START, this.START + this.SWEEP);
    }

    get fillPath(): string {
        return this.arc(this.R, this.START, this.START + Math.max(0.5, this.fAct * this.SWEEP));
    }

    get showFill(): boolean {
        return this.isOn && this.fAct > 0.005;
    }

    get marker(): { x: number; y: number } {
        const [x, y] = this.polar(this.R, this.START + this.fSet * this.SWEEP);
        return { x, y };
    }

    get ticks(): GaugeTick[] {
        const out: GaugeTick[] = [];
        for (let i = 0; i < 28; i++) {
            const f = i / 27;
            const major = i % 7 === 0;
            const [x1, y1] = this.polar(this.R - 18 * this.s, this.START + f * this.SWEEP);
            const [x2, y2] = this.polar(this.R - (major ? 30 : 24) * this.s, this.START + f * this.SWEEP);
            out.push({ x1, y1, x2, y2, lit: f <= this.fAct && this.isOn, major });
        }
        return out;
    }

    round(n: number): number {
        return Math.round(n);
    }

    onPointerDown(e: PointerEvent): void {
        this.drag = true;
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        this.fromEvent(e);
    }

    onPointerMove(e: PointerEvent): void {
        if (this.drag) this.fromEvent(e);
    }

    onPointerUp(): void {
        this.drag = false;
    }

    private fromEvent(e: PointerEvent): void {
        const r = this.dialRef.nativeElement.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        let a = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (a < 0) a += 360;
        if (a < this.START) a += 360;
        const f = Math.max(0, Math.min(1, (a - this.START) / this.SWEEP));
        this.speedChange.emit(Math.round(f * this.max));
    }
}
