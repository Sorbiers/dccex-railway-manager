import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { StateService } from './state.service';
import { DccCommand } from '../models';

@Injectable({
  providedIn: 'root'
})
export class DccService {
  private api = inject(ApiService);
  private state = inject(StateService);

  setThrottle(address: number, speed: number): void {
    // Any throttle input clears a latched emergency stop.
    this.state.setEstop(false);

    const command: DccCommand = {
      type: 'throttle',
      address,
      value: Math.round(speed)
    };

    this.api.sendCommand(command).subscribe({
      next: (success) => {
        if (success) {
          // Update local state optimistically
          const device = this.state.devices().find(d => d.address === address);
          if (device) {
            this.state.updateDeviceLocally(device.id, { speed: Math.round(speed) });
          }
        }
      },
      error: (err) => console.error('Failed to set throttle', err)
    });
  }

  setDirection(address: number, forward: boolean): void {
    const command: DccCommand = {
      type: 'direction',
      address,
      state: forward
    };

    this.api.sendCommand(command).subscribe({
      next: (success) => {
        if (success) {
          const device = this.state.devices().find(d => d.address === address);
          if (device) {
            this.state.updateDeviceLocally(device.id, { direction: forward ? 'forward' : 'reverse' });
          }
        }
      },
      error: (err) => console.error('Failed to set direction', err)
    });
  }

  setFunction(address: number, functionId: number, state: boolean): void {
    const command: DccCommand = {
      type: 'function',
      address,
      value: functionId,
      state
    };

    this.api.sendCommand(command).subscribe({
      next: (success) => {
        if (success) {
          const device = this.state.devices().find(d => d.address === address);
          if (device) {
            let activeFunctions = device.activeFunctions || [];
            if (state) {
              if (!activeFunctions.includes(functionId)) {
                activeFunctions = [...activeFunctions, functionId];
              }
            } else {
              activeFunctions = activeFunctions.filter(f => f !== functionId);
            }
            this.state.updateDeviceLocally(device.id, { activeFunctions });
          }
        }
      },
      error: (err) => console.error('Failed to set function', err)
    });
  }

  toggleFunction(address: number, functionId: number): void {
    const device = this.state.devices().find(d => d.address === address);
    if (!device) return;

    const isActive = device.activeFunctions?.includes(functionId) || false;
    this.setFunction(address, functionId, !isActive);
  }

  setPower(on: boolean): void {
    const command: DccCommand = {
      type: 'power',
      state: on
    };

    this.api.sendCommand(command).subscribe({
      error: (err) => console.error('Failed to set power', err)
    });
  }

  emergencyStop(): void {
    this.state.setEstop(true);

    const command: DccCommand = {
      type: 'emergency'
    };

    this.api.sendCommand(command).subscribe({
      next: () => {
        // Update all trains to speed 0 locally
        this.state.devices()
          .filter(d => d.type === 'train')
          .forEach(train => {
            this.state.updateDeviceLocally(train.id, { speed: 0 });
          });
      },
      error: (err) => console.error('Failed to emergency stop', err)
    });
  }

  setTurnout(address: number, thrown: boolean): void {
    const command: DccCommand = {
      type: 'turnout',
      address,
      state: thrown
    };

    this.api.sendCommand(command).subscribe({
      error: (err) => console.error('Failed to set turnout', err)
    });
  }

  setSignalAspect(deviceId: string, aspectIndex: number): void {
    const command: DccCommand = {
      type: 'signal',
      deviceId,
      value: aspectIndex
    };

    this.api.sendCommand(command).subscribe({
      next: (success) => {
        if (success) {
          this.state.updateDeviceLocally(deviceId, { signalState: aspectIndex });
        }
      },
      error: (err) => console.error('Failed to set signal aspect', err)
    });
  }
}
