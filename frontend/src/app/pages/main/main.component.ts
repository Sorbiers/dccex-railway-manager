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
import { StateService } from '../../services/state.service';
import { DccService } from '../../services/dcc.service';
import { ApiService } from '../../services/api.service';
import { Device, DccFunction } from '../../models';
import { NgxGaugeModule } from 'ngx-gauge';

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
}
