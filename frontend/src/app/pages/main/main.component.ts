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
    MatSnackBarModule
  ],
  template: `
    <div class="throttle-page">
      @if (state.enabledTrains().length === 0) {
        <mat-card>
          <mat-card-content>
            <p>No trains enabled. Go to the Trains page to add or enable trains.</p>
          </mat-card-content>
        </mat-card>
      } @else {
        <mat-tab-group class="train-tabs" [selectedIndex]="selectedTabIndex()" (selectedIndexChange)="onTabChange($event)">
          @for (train of state.enabledTrains(); track train.id) {
            <mat-tab [label]="train.name">
              <div class="throttle-container">
                <!-- Speed Display -->
                <div class="speed-display">
                  {{ train.speed || 0 }}
                </div>

                <!-- Speed Slider -->
                <mat-slider class="speed-slider" [min]="0" [max]="126" [step]="1" [discrete]="true" showTickMarks>
                  <input matSliderThumb [value]="train.speed || 0" (valueChange)="onSpeedChange(train, $event)">
                </mat-slider>

                <!-- Direction Toggle -->
                <div class="direction-toggle">
                  <mat-button-toggle-group [value]="train.direction || 'forward'" (change)="onDirectionChange(train, $event.value)">
                    <mat-button-toggle value="reverse">
                      <mat-icon>arrow_back</mat-icon> Reverse
                    </mat-button-toggle>
                    <mat-button-toggle value="forward">
                      Forward <mat-icon>arrow_forward</mat-icon>
                    </mat-button-toggle>
                  </mat-button-toggle-group>
                </div>

                <!-- Quick Stop -->
                <div class="quick-stop">
                  <button mat-raised-button color="warn" (click)="stopTrain(train)">
                    <mat-icon>stop</mat-icon> Stop
                  </button>
                </div>

                <!-- Send Free Command -->
                <div class="command-section">
                  <h3>Send Command</h3>
                  <div class="command-input">
                    <mat-form-field appearance="outline" class="command-field">
                      <mat-label>DCC-EX Command</mat-label>
                      <input matInput [(ngModel)]="freeCommand" placeholder="e.g., <t 1 3 50 1>" (keyup.enter)="sendFreeCommand(train)">
                    </mat-form-field>
                    <button mat-raised-button color="primary" (click)="sendFreeCommand(train)">
                      <mat-icon>send</mat-icon> Send
                    </button>
                  </div>
                  @if (commandResponse()) {
                    <div class="command-response">
                      <strong>Response:</strong> {{ commandResponse() }}
                    </div>
                  }
                </div>

                <!-- Main Functions (always visible) -->
                @if (getMainFunctions(train).length > 0) {
                  <div class="function-section">
                    <h3>Quick Functions</h3>
                    <div class="function-grid">
                      @for (fn of getMainFunctions(train); track fn.id) {
                        <button mat-raised-button class="function-btn"
                                [class.active]="isFunctionActive(train, fn.id)"
                                (mousedown)="onFunctionPress(train, fn)"
                                (mouseup)="onFunctionRelease(train, fn)"
                                (mouseleave)="onFunctionRelease(train, fn)"
                                (touchstart)="onFunctionPress(train, fn)"
                                (touchend)="onFunctionRelease(train, fn)">
                          <mat-icon>{{ fn.icon || 'radio_button_unchecked' }}</mat-icon>
                          <span>{{ fn.name }}</span>
                        </button>
                      }
                    </div>
                  </div>
                }

                <!-- Function Groups -->
                @if (hasGroupedFunctions(train)) {
                  <mat-accordion>
                    @if (getLightsFunctions(train).length > 0) {
                      <mat-expansion-panel>
                        <mat-expansion-panel-header>
                          <mat-panel-title>
                            <mat-icon>lightbulb</mat-icon> Lights
                          </mat-panel-title>
                        </mat-expansion-panel-header>
                        <div class="function-grid">
                          @for (fn of getLightsFunctions(train); track fn.id) {
                            <button mat-raised-button class="function-btn"
                                    [class.active]="isFunctionActive(train, fn.id)"
                                    (mousedown)="onFunctionPress(train, fn)"
                                    (mouseup)="onFunctionRelease(train, fn)"
                                    (mouseleave)="onFunctionRelease(train, fn)"
                                    (touchstart)="onFunctionPress(train, fn)"
                                    (touchend)="onFunctionRelease(train, fn)">
                              <mat-icon>{{ fn.icon || 'light' }}</mat-icon>
                              <span>{{ fn.name }}</span>
                            </button>
                          }
                        </div>
                      </mat-expansion-panel>
                    }

                    @if (getSoundsFunctions(train).length > 0) {
                      <mat-expansion-panel>
                        <mat-expansion-panel-header>
                          <mat-panel-title>
                            <mat-icon>volume_up</mat-icon> Sounds
                          </mat-panel-title>
                        </mat-expansion-panel-header>
                        <div class="function-grid">
                          @for (fn of getSoundsFunctions(train); track fn.id) {
                            <button mat-raised-button class="function-btn"
                                    [class.active]="isFunctionActive(train, fn.id)"
                                    (mousedown)="onFunctionPress(train, fn)"
                                    (mouseup)="onFunctionRelease(train, fn)"
                                    (mouseleave)="onFunctionRelease(train, fn)"
                                    (touchstart)="onFunctionPress(train, fn)"
                                    (touchend)="onFunctionRelease(train, fn)">
                              <mat-icon>{{ fn.icon || 'music_note' }}</mat-icon>
                              <span>{{ fn.name }}</span>
                            </button>
                          }
                        </div>
                      </mat-expansion-panel>
                    }

                    @if (getOtherFunctions(train).length > 0) {
                      <mat-expansion-panel>
                        <mat-expansion-panel-header>
                          <mat-panel-title>
                            <mat-icon>more_horiz</mat-icon> Other
                          </mat-panel-title>
                        </mat-expansion-panel-header>
                        <div class="function-grid">
                          @for (fn of getOtherFunctions(train); track fn.id) {
                            <button mat-raised-button class="function-btn"
                                    [class.active]="isFunctionActive(train, fn.id)"
                                    (mousedown)="onFunctionPress(train, fn)"
                                    (mouseup)="onFunctionRelease(train, fn)"
                                    (mouseleave)="onFunctionRelease(train, fn)"
                                    (touchstart)="onFunctionPress(train, fn)"
                                    (touchend)="onFunctionRelease(train, fn)">
                              <mat-icon>{{ fn.icon || 'settings' }}</mat-icon>
                              <span>{{ fn.name }}</span>
                            </button>
                          }
                        </div>
                      </mat-expansion-panel>
                    }
                  </mat-accordion>
                }
              </div>
            </mat-tab>
          }
        </mat-tab-group>
      }
    </div>
  `,
  styles: [`
    .throttle-page {
      max-width: 600px;
      margin: 0 auto;
    }

    .throttle-container {
      padding: 16px 0;
    }

    .speed-display {
      font-size: 72px;
      font-weight: 300;
      text-align: center;
      margin-bottom: 16px;
      color: #1976d2;
    }

    :host-context(.dark-theme) .speed-display {
      color: #64b5f6;
    }

    .speed-slider {
      width: 100%;
    }

    .direction-toggle {
      display: flex;
      justify-content: center;
      margin-top: 24px;
    }

    .quick-stop {
      display: flex;
      justify-content: center;
      margin-top: 16px;
    }

    .command-section {
      margin-top: 24px;
      padding: 16px;
      background-color: rgba(0, 0, 0, 0.02);
      border-radius: 4px;

      h3 {
        margin: 0 0 12px 0;
        font-size: 14px;
        color: rgba(0, 0, 0, 0.6);
      }
    }

    :host-context(.dark-theme) .command-section {
      background-color: rgba(255, 255, 255, 0.05);

      h3 {
        color: rgba(255, 255, 255, 0.6);
      }
    }

    .command-input {
      display: flex;
      gap: 8px;
      align-items: flex-start;

      .command-field {
        flex: 1;
      }
    }

    .command-response {
      margin-top: 12px;
      padding: 8px 12px;
      background-color: rgba(25, 118, 210, 0.1);
      border-left: 3px solid #1976d2;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 13px;

      strong {
        color: #1976d2;
      }
    }

    :host-context(.dark-theme) .command-response {
      background-color: rgba(100, 181, 246, 0.1);
      border-left-color: #64b5f6;

      strong {
        color: #64b5f6;
      }
    }

    .function-section {
      margin-top: 24px;

      h3 {
        margin-bottom: 12px;
        font-size: 14px;
        color: rgba(0, 0, 0, 0.6);
      }
    }

    :host-context(.dark-theme) .function-section h3 {
      color: rgba(255, 255, 255, 0.6);
    }

    .function-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
      gap: 8px;
    }

    .function-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 70px;
      padding: 8px;

      mat-icon {
        margin-bottom: 4px;
      }

      span {
        font-size: 11px;
        text-align: center;
        line-height: 1.2;
      }

      &.active {
        background-color: #bbdefb;
      }
    }

    :host-context(.dark-theme) .function-btn.active {
      background-color: #1565c0;
      color: rgba(255, 255, 255, 0.87);
    }

    mat-accordion {
      margin-top: 16px;
    }

    mat-expansion-panel-header mat-icon {
      margin-right: 8px;
    }
  `]
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

  onSpeedChange(train: Device, speed: number): void {
    this.dcc.setThrottle(train.address, speed);
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
    // First 3 functions (typically headlight, bell, horn)
    return (train.functions || []).slice(0, 3);
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
