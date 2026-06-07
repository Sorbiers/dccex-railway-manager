import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatSliderModule } from '@angular/material/slider';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { StateService } from '../../services/state.service';
import { DccService } from '../../services/dcc.service';
import { ApiService } from '../../services/api.service';
import { Device, DccFunction } from '../../models';
import { NgxGaugeModule } from 'ngx-gauge';

interface TurnoutStateDef {
    label: string;
    o1: boolean;
    o2: boolean;
    svg: string;
}

@Component({
    selector: 'app-main',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatTabsModule,
        MatCardModule,
        MatSliderModule,
        MatButtonModule,
        MatButtonToggleModule,
        MatIconModule,
        MatExpansionModule,
        MatFormFieldModule,
        MatInputModule,
        MatSnackBarModule,
        NgxGaugeModule
    ],
    templateUrl: './main.component.html',
    styleUrls: ['./main.component.scss']
})
export class MainComponent {
    state = inject(StateService);
    private dcc = inject(DccService);
    private api = inject(ApiService);
    private snackBar = inject(MatSnackBar);
    private sanitizer = inject(DomSanitizer);

    selectedTabIndex = signal(0);
    freeCommand = '';
    commandResponse = signal<string>('');

    onTabChange(index: number): void {
        this.selectedTabIndex.set(index);
        const trains = this.state.enabledTrains();
        if (trains[index]) {
            this.state.selectTrain(trains[index].id);
        }
    }

    onSpeedChange(train: Device, event: Event): void {
        const speed = (event.target as HTMLInputElement).value;
        this.dcc.setThrottle(train.address, parseInt(speed));
    }

    onDirectionChange(train: Device, direction: 'forward' | 'reverse'): void {
        this.dcc.setDirection(train.address, direction === 'forward');
    }

    stopTrain(train: Device): void {
        this.dcc.setThrottle(train.address, 0);
    }

    resetTrain(train: Device): void {
        // Stop the train
        this.dcc.setThrottle(train.address, 0);

        // Reset all functions to OFF
        const functions = train.functions || [];
        functions.forEach(fn => {
            this.dcc.setFunction(train.address, fn.id, false);
        });
    }

    isFunctionActive(train: Device, functionId: number): boolean {
        return train.activeFunctions?.includes(functionId) || false;
    }

    onFunctionPress(train: Device, fn: DccFunction): void {
        if (fn.momentary) {
            this.dcc.setFunction(train.address, fn.id, true);
        } else {
            this.dcc.toggleFunction(train.address, fn.id);
        }
    }

    onFunctionRelease(train: Device, fn: DccFunction): void {
        if (fn.momentary) {
            this.dcc.setFunction(train.address, fn.id, false);
        }
    }

    getMainFunctions(train: Device): DccFunction[] {
        // Quick access functions
        return (train.functions || []).filter(f => f.group === 'quick');
    }

    getLightsFunctions(train: Device): DccFunction[] {
        return (train.functions || []).filter(f => f.group === 'lights');
    }

    getSoundsFunctions(train: Device): DccFunction[] {
        return (train.functions || []).filter(f => f.group === 'sounds');
    }

    getOtherFunctions(train: Device): DccFunction[] {
        return (train.functions || []).filter(f => f.group === 'other' || !f.group);
    }

    hasGroupedFunctions(train: Device): boolean {
        const fns = train.functions || [];
        return fns.length > 3;
    }

    getDirectionLabel(train: Device): 'FORWARD' | 'REVERSE' | 'OFF' {
        if (this.state.statePowerMAIN() === false) {
            return 'OFF';
        }
        return train.direction === 'forward' ? 'FORWARD' : 'REVERSE';
    }

    getHandleRotation(train: Device): number {
        const state = this.getDirectionLabel(train);
        if (state === 'FORWARD') {
            return 60;
        } else if (state === 'REVERSE') {
            return -60;
        }
        return 0;
    }

    sendFreeCommand(train: Device): void {
        if (!this.freeCommand.trim()) {
            this.snackBar.open('Please enter a command', 'Close', { duration: 3000 });
            return;
        }

        this.api.sendFreeCommand(train.address, this.freeCommand).subscribe({
            next: (response) => {
                this.commandResponse.set(response || 'Command sent successfully');
                this.snackBar.open('Command sent', 'Close', { duration: 2000 });
                this.freeCommand = '';
            },
            error: (err) => {
                console.error('Failed to send command', err);
                this.commandResponse.set('Error: ' + (err.error?.message || 'Failed to send command'));
                this.snackBar.open('Failed to send command', 'Close', { duration: 3000 });
            }
        });
    }

    // ── Layout tab ──────────────────────────────────────────────────────────

    private readonly stateDefs: Record<string, TurnoutStateDef[]> = {
        left: [
            { label: 'Closed', o1: false, o2: false, svg: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 40'><line x1='4' y1='24' x2='52' y2='24' stroke='#71c837' stroke-width='5' stroke-linecap='round'/><path d='M18 24 Q34 24 46 8' stroke='#666' stroke-width='5' fill='none' stroke-linecap='round'/></svg>" },
            { label: 'Thrown', o1: true,  o2: false, svg: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 40'><line x1='4' y1='24' x2='52' y2='24' stroke='#666' stroke-width='5' stroke-linecap='round'/><path d='M18 24 Q34 24 46 8' stroke='#71c837' stroke-width='5' fill='none' stroke-linecap='round'/></svg>" }
        ],
        right: [
            { label: 'Closed', o1: false, o2: false, svg: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 40'><line x1='4' y1='16' x2='52' y2='16' stroke='#71c837' stroke-width='5' stroke-linecap='round'/><path d='M18 16 Q34 16 46 32' stroke='#666' stroke-width='5' fill='none' stroke-linecap='round'/></svg>" },
            { label: 'Thrown', o1: true,  o2: false, svg: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 40'><line x1='4' y1='16' x2='52' y2='16' stroke='#666' stroke-width='5' stroke-linecap='round'/><path d='M18 16 Q34 16 46 32' stroke='#71c837' stroke-width='5' fill='none' stroke-linecap='round'/></svg>" }
        ],
        wye: [
            { label: 'Left',  o1: false, o2: false, svg: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 40'><line x1='4' y1='20' x2='18' y2='20' stroke='#71c837' stroke-width='5' stroke-linecap='round'/><path d='M18 20 Q30 20 44 8' stroke='#71c837' stroke-width='5' fill='none' stroke-linecap='round'/><path d='M18 20 Q30 20 44 32' stroke='#666' stroke-width='5' fill='none' stroke-linecap='round'/></svg>" },
            { label: 'Right', o1: true,  o2: false, svg: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 40'><line x1='4' y1='20' x2='18' y2='20' stroke='#71c837' stroke-width='5' stroke-linecap='round'/><path d='M18 20 Q30 20 44 8' stroke='#666' stroke-width='5' fill='none' stroke-linecap='round'/><path d='M18 20 Q30 20 44 32' stroke='#71c837' stroke-width='5' fill='none' stroke-linecap='round'/></svg>" }
        ],
        three_way: [
            { label: 'Straight',  o1: false, o2: false, svg: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 40'><line x1='4' y1='20' x2='52' y2='20' stroke='#71c837' stroke-width='5' stroke-linecap='round'/><path d='M14 20 Q26 20 38 8' stroke='#666' stroke-width='5' fill='none' stroke-linecap='round'/><path d='M22 20 Q34 20 46 32' stroke='#666' stroke-width='5' fill='none' stroke-linecap='round'/></svg>" },
            { label: 'Diverge A', o1: true,  o2: false, svg: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 40'><line x1='4' y1='20' x2='52' y2='20' stroke='#666' stroke-width='5' stroke-linecap='round'/><path d='M14 20 Q26 20 38 8' stroke='#71c837' stroke-width='5' fill='none' stroke-linecap='round'/><path d='M22 20 Q34 20 46 32' stroke='#666' stroke-width='5' fill='none' stroke-linecap='round'/></svg>" },
            { label: 'Diverge B', o1: false, o2: true,  svg: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 40'><line x1='4' y1='20' x2='52' y2='20' stroke='#666' stroke-width='5' stroke-linecap='round'/><path d='M14 20 Q26 20 38 8' stroke='#666' stroke-width='5' fill='none' stroke-linecap='round'/><path d='M22 20 Q34 20 46 32' stroke='#71c837' stroke-width='5' fill='none' stroke-linecap='round'/></svg>" },
            { label: 'Both',      o1: true,  o2: true,  svg: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 40'><line x1='4' y1='20' x2='52' y2='20' stroke='#666' stroke-width='5' stroke-linecap='round'/><path d='M14 20 Q26 20 38 8' stroke='#71c837' stroke-width='5' fill='none' stroke-linecap='round'/><path d='M22 20 Q34 20 46 32' stroke='#71c837' stroke-width='5' fill='none' stroke-linecap='round'/></svg>" }
        ],
        double_slip: [
            { label: 'Route 1', o1: false, o2: false, svg: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 40'><line x1='4' y1='8'  x2='52' y2='32' stroke='#71c837' stroke-width='5' stroke-linecap='round'/><line x1='4' y1='32' x2='52' y2='8'  stroke='#666' stroke-width='5' stroke-linecap='round'/></svg>" },
            { label: 'Route 2', o1: true,  o2: false, svg: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 40'><line x1='4' y1='8'  x2='52' y2='32' stroke='#666' stroke-width='5' stroke-linecap='round'/><line x1='4' y1='32' x2='52' y2='8'  stroke='#71c837' stroke-width='5' stroke-linecap='round'/></svg>" },
            { label: 'Slip L',  o1: false, o2: true,  svg: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 40'><line x1='4' y1='8'  x2='52' y2='32' stroke='#666' stroke-width='5' stroke-linecap='round'/><line x1='4' y1='32' x2='52' y2='8'  stroke='#666' stroke-width='5' stroke-linecap='round'/><path d='M4 32 Q28 20 52 32' stroke='#71c837' stroke-width='5' fill='none' stroke-linecap='round'/></svg>" },
            { label: 'Slip R',  o1: true,  o2: true,  svg: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 40'><line x1='4' y1='8'  x2='52' y2='32' stroke='#666' stroke-width='5' stroke-linecap='round'/><line x1='4' y1='32' x2='52' y2='8'  stroke='#666' stroke-width='5' stroke-linecap='round'/><path d='M4 8 Q28 20 52 8' stroke='#71c837' stroke-width='5' fill='none' stroke-linecap='round'/></svg>" }
        ],
        curved_left: [
            { label: 'Closed', o1: false, o2: false, svg: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 40'><path d='M4 34 Q28 34 46 8' stroke='#71c837' stroke-width='5' fill='none' stroke-linecap='round'/><path d='M20 32 Q32 22 40 8' stroke='#666' stroke-width='5' fill='none' stroke-linecap='round'/></svg>" },
            { label: 'Thrown', o1: true,  o2: false, svg: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 40'><path d='M4 34 Q28 34 46 8' stroke='#666' stroke-width='5' fill='none' stroke-linecap='round'/><path d='M20 32 Q32 22 40 8' stroke='#71c837' stroke-width='5' fill='none' stroke-linecap='round'/></svg>" }
        ],
        curved_right: [
            { label: 'Closed', o1: false, o2: false, svg: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 40'><path d='M4 6 Q28 6 46 32' stroke='#71c837' stroke-width='5' fill='none' stroke-linecap='round'/><path d='M20 8 Q32 18 40 32' stroke='#666' stroke-width='5' fill='none' stroke-linecap='round'/></svg>" },
            { label: 'Thrown', o1: true,  o2: false, svg: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 40'><path d='M4 6 Q28 6 46 32' stroke='#666' stroke-width='5' fill='none' stroke-linecap='round'/><path d='M20 8 Q32 18 40 32' stroke='#71c837' stroke-width='5' fill='none' stroke-linecap='round'/></svg>" }
        ]
    };

    getTurnoutStateDefs(sw: Device): TurnoutStateDef[] {
        return this.stateDefs[sw.turnoutType || ''] ?? this.stateDefs['left'];
    }

    getTurnoutState(sw: Device): number {
        return sw.turnoutState ?? 0;
    }

    onTurnoutStateClick(sw: Device, stateIdx: number, def: TurnoutStateDef): void {
        this.dcc.setTurnout(sw.address, def.o1);
        if ((sw.turnoutType === 'three_way' || sw.turnoutType === 'double_slip') && sw.output2) {
            this.dcc.setTurnout(sw.output2, def.o2);
        }
        this.state.updateDeviceLocally(sw.id, { turnoutState: stateIdx });
    }

    getSafeHtml(svg: string): SafeHtml {
        return this.sanitizer.bypassSecurityTrustHtml(svg);
    }

    // ── Light Signals ────────────────────────────────────────────────────────

    onSignalAspectClick(signal: Device, aspectIndex: number): void {
        this.dcc.setSignalAspect(signal.id, aspectIndex);
    }

    getSignalState(signal: Device): number {
        return signal.signalState ?? -1;
    }

    getAspectColor(aspectName: string): string {
        const n = aspectName.toLowerCase();
        if (n.includes('red')) return '#e53935';
        if (n.includes('yellow') || n.includes('amber')) return '#fdd835';
        if (n.includes('green')) return '#43a047';
        return '#757575';
    }
}
