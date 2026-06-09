import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { SpeedGaugeComponent } from '../../../components/speed-gauge/speed-gauge.component';
import { SpeedSliderComponent } from '../../../components/speed-slider/speed-slider.component';
import { DccFunction, Device } from '../../../models';
import { ThrottleControllerBase } from '../throttle-base';
import { IdleService } from '../../../services/idle.service';

interface KioskTab {
    type: 'train' | 'layout';
    train?: Device;
    index: number;
    key: string;
}

/**
 * Kiosk throttle layout — Variant A "Refined Material" (design handoff).
 * 800x480 landscape: top bar (in app.component) → train selector → body.
 */
@Component({
    selector: 'app-throttle-kiosk',
    standalone: true,
    imports: [
        CommonModule,
        MatIconModule,
        MatCardModule,
        SpeedSliderComponent,
        SpeedGaugeComponent
    ],
    templateUrl: './throttle-kiosk.component.html',
    styleUrls: ['./throttle-kiosk.component.scss']
})
export class ThrottleKioskComponent extends ThrottleControllerBase {
    private readonly FN_PER_PAGE = 6;
    private readonly TAB_WINDOW = 4;

    readonly groupOrder = ['quick', 'lights', 'sounds', 'other'];
    readonly groupMeta: Record<string, { label: string; icon: string }> = {
        quick: { label: 'Fav', icon: 'star' },
        lights: { label: 'Lights', icon: 'lightbulb' },
        sounds: { label: 'Sounds', icon: 'volume_up' },
        other: { label: 'More', icon: 'tune' }
    };

    /** group override (null → first available), function page, tab window start. */
    private groupOverride = signal<string | null>(null);
    functionPage = signal(0);
    tabStart = signal(0);

    // ── Train / view selection ───────────────────────────────────────────────

    currentTrain(): Device | undefined {
        return this.state.enabledTrains()[this.selectedTabIndex()];
    }

    layoutIndex(): number {
        return this.state.enabledTrains().length;
    }

    hasLayout(): boolean {
        return this.state.switches().length > 0 || this.state.lightSignals().length > 0;
    }

    isLayout(): boolean {
        return this.hasLayout() && this.selectedTabIndex() >= this.layoutIndex();
    }

    accent(): string {
        return this.getAccent(this.currentTrain());
    }

    isOn(): boolean {
        return this.state.statePowerMAIN();
    }

    actualSpeed(train: Device): number {
        return this.state.stateTrains()[train.address]?.speed ?? (train.speed || 0);
    }

    dirFwd(train: Device): boolean {
        return train.direction !== 'reverse';
    }

    selectTab(index: number): void {
        this.onTabChange(index);
        this.groupOverride.set(null);
        this.functionPage.set(0);
    }

    selectLayout(): void {
        this.selectedTabIndex.set(this.layoutIndex());
    }

    // ── Train-tab pagination ─────────────────────────────────────────────────

    allTabs(): KioskTab[] {
        const trains = this.state.enabledTrains();
        const tabs: KioskTab[] = trains.map((tr, i) => ({ type: 'train', train: tr, index: i, key: tr.id }));
        if (this.hasLayout()) {
            tabs.push({ type: 'layout', index: trains.length, key: '__layout' });
        }
        return tabs;
    }

    tabCount(): number {
        return this.allTabs().length;
    }

    paginateTabs(): boolean {
        return this.tabCount() > 5;
    }

    visibleTabs(): KioskTab[] {
        const all = this.allTabs();
        return this.paginateTabs() ? all.slice(this.tabStart(), this.tabStart() + this.TAB_WINDOW) : all;
    }

    tabPrev(): void {
        this.tabStart.set(Math.max(0, this.tabStart() - this.TAB_WINDOW));
    }

    tabNext(): void {
        this.tabStart.set(Math.min(this.tabCount() - this.TAB_WINDOW, this.tabStart() + this.TAB_WINDOW));
    }

    tabAtStart(): boolean {
        return this.tabStart() === 0;
    }

    tabAtEnd(): boolean {
        return this.tabStart() + this.TAB_WINDOW >= this.tabCount();
    }

    // ── Functions: groups + pagination ───────────────────────────────────────

    availableGroups(train: Device): string[] {
        const fns = train.functions || [];
        return this.groupOrder.filter(g => fns.some(f => (f.group || 'other') === g));
    }

    currentGroup(train: Device): string {
        const groups = this.availableGroups(train);
        const o = this.groupOverride();
        return o && groups.includes(o) ? o : (groups[0] ?? 'quick');
    }

    setGroup(group: string): void {
        this.groupOverride.set(group);
        this.functionPage.set(0);
    }

    functionsInGroup(train: Device, group: string): DccFunction[] {
        return (train.functions || []).filter(f => (f.group || 'other') === group);
    }

    functionPagesCount(train: Device): number {
        return Math.max(1, Math.ceil(this.functionsInGroup(train, this.currentGroup(train)).length / this.FN_PER_PAGE));
    }

    clampedFnPage(train: Device): number {
        return Math.min(this.functionPage(), this.functionPagesCount(train) - 1);
    }

    functionSlice(train: Device): DccFunction[] {
        const p = this.clampedFnPage(train);
        const all = this.functionsInGroup(train, this.currentGroup(train));
        return all.slice(p * this.FN_PER_PAGE, p * this.FN_PER_PAGE + this.FN_PER_PAGE);
    }

    prevFnPage(train: Device): void {
        this.functionPage.set(Math.max(0, this.clampedFnPage(train) - 1));
    }

    nextFnPage(train: Device): void {
        this.functionPage.set(Math.min(this.functionPagesCount(train) - 1, this.clampedFnPage(train) + 1));
    }

    // ── Motion rail (decorative) ─────────────────────────────────────────────

    private idle = inject(IdleService);

    railPaused(train: Device): boolean {
        // Also pause while the screen is blanked — no point animating in the dark.
        return this.idle.blanked() || !this.isOn() || this.actualSpeed(train) <= 0.5;
    }

    railDuration(train: Device): string {
        const f = Math.min(1, this.actualSpeed(train) / 126);
        if (f <= 0.01) return '0s';
        return Math.max(0.3, 2.6 - f * 2.3).toFixed(2) + 's';
    }
}
