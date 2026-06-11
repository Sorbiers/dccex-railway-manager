import { Component, inject, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { WeeklySchedule, ScheduleItem, Device } from '../../models';
import { ApiService } from '../../services/api.service';
import { StateService } from '../../services/state.service';

export interface ScheduleDialogData {
  mode: 'add' | 'edit';
  schedule?: WeeklySchedule;
  devices: Device[];
}

type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

@Component({
  selector: 'app-schedule-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatDividerModule
  ],
  template: `
    <h2 mat-dialog-title>{{ data.mode === 'add' ? 'Add Schedule' : 'Edit Schedule' }}</h2>

    <mat-dialog-content class="dialog-content">
      <div class="header-row">
        <mat-form-field class="header-name">
          <mat-label>Schedule Name</mat-label>
          <input matInput [(ngModel)]="name" placeholder="e.g., Morning Commuter">
        </mat-form-field>

        <mat-form-field class="header-start-time">
          <mat-label>Start Time</mat-label>
          <input matInput type="time" [(ngModel)]="startTime" step="1">
        </mat-form-field>

        <mat-checkbox class="header-disabled" [(ngModel)]="disabled">
          Disabled
        </mat-checkbox>

        <mat-checkbox class="header-reset" [(ngModel)]="resetAtEnd"
                      matTooltip="Stop and clear functions on all used devices after the last action">
          Reset devices at end
        </mat-checkbox>
      </div>

      <!-- Days selection -->
      <div class="days-section">
        <label>Active Days</label>
        <div class="days-checkboxes">
          @for (day of allDays; track day) {
            <mat-checkbox [(ngModel)]="selectedDays[day]">
              {{ dayLabels[day] }}
            </mat-checkbox>
          }
        </div>
      </div>

      <mat-divider></mat-divider>

      <!-- Schedule Items -->
      <div class="items-section">
        <div class="section-header">
          <h3>Actions</h3>
          <div class="section-actions">
            <button mat-button color="accent" (click)="sortItems()">
              <mat-icon>sort</mat-icon> Sort
            </button>
            <button mat-button color="primary" (click)="addItem()">
              <mat-icon>add</mat-icon> Add Action
            </button>
          </div>
        </div>

        @for (item of items; track item.id; let i = $index) {
          <div class="item-row">
            <mat-form-field class="item-time">
              <mat-label>Offset (+HH:MM:SS)</mat-label>
              <input matInput type="text" [(ngModel)]="item.offset"
                     placeholder="00:05:00" pattern="\\d{1,2}:\\d{2}(:\\d{2})?">
              <mat-hint>at {{ getAbsoluteTime(item) }}</mat-hint>
            </mat-form-field>

            <mat-form-field class="item-device">
              <mat-label>Device</mat-label>
              <mat-select [(ngModel)]="item.deviceId">
                @for (device of data.devices; track device.id) {
                  <mat-option [value]="device.id">{{ device.name }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field class="item-action">
              <mat-label>Action</mat-label>
              <mat-select [(ngModel)]="item.action">
                <mat-option value="start">Start</mat-option>
                <mat-option value="stop">Stop</mat-option>
                <mat-option value="speed">Set Speed</mat-option>
                <mat-option value="function">Toggle Function</mat-option>
                <mat-option value="reset">Reset (Stop + Clear Functions)</mat-option>
              </mat-select>
            </mat-form-field>

            @if (item.action === 'start' || item.action === 'speed') {
              <mat-form-field class="item-speed">
                <mat-label>Speed</mat-label>
                <input matInput type="number" [(ngModel)]="item.params!.speed" min="0" max="126">
              </mat-form-field>
            }

            @if (item.action === 'start') {
              <mat-form-field class="item-direction">
                <mat-label>Direction</mat-label>
                <mat-select [(ngModel)]="item.params!.direction">
                  <mat-option value="forward">Forward</mat-option>
                  <mat-option value="reverse">Reverse</mat-option>
                </mat-select>
              </mat-form-field>
            }

            @if (item.action === 'function') {
              <mat-form-field class="item-fn">
                <mat-label>Function</mat-label>
                <mat-select [(ngModel)]="item.params!.functionId" (selectionChange)="onFunctionSelected(item, $event.value)">
                  @for (fn of getDeviceFunctions(item.deviceId); track fn.id) {
                    <mat-option [value]="fn.id">
                      <mat-icon>{{ fn.icon || 'radio_button_unchecked' }}</mat-icon>
                      F{{ fn.id }}: {{ fn.name }}
                    </mat-option>
                  }
                  @if (getDeviceFunctions(item.deviceId).length === 0) {
                    <mat-option [value]="0">No functions defined</mat-option>
                  }
                </mat-select>
              </mat-form-field>
              <mat-checkbox [(ngModel)]="item.params!.functionState">On</mat-checkbox>
              @if (item.params!.momentary) {
                <mat-form-field class="item-duration">
                  <mat-label>Duration (s)</mat-label>
                  <input matInput type="number" [(ngModel)]="item.params!.duration" min="0" step="0.1" placeholder="0.5">
                </mat-form-field>
              }
            }

            <button mat-icon-button color="warn" (click)="removeItem(i)">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        }

        @if (items.length === 0) {
          <p class="no-items">No actions defined. Click "Add Action" to schedule train operations.</p>
        }

        @for (warning of getWarnings(); track warning) {
          <p class="validation-warning">
            <mat-icon>warning</mat-icon> {{ warning }}
          </p>
        }
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="cancel()">Cancel</button>
      @if (items.length > 0) {
        <button mat-button color="accent" (click)="previewSchedule()">
          <mat-icon>preview</mat-icon> Preview Timeline
        </button>
        <button mat-button color="accent" (click)="simulateSchedule()">
          <mat-icon>play_arrow</mat-icon> Simulate
        </button>
      }
      <button mat-raised-button color="primary" (click)="save()" [disabled]="!isValid()">
        {{ data.mode === 'add' ? 'Add' : 'Save' }}
      </button>
    </mat-dialog-actions>

    @if (showPreview) {
      <div class="preview-overlay" (click)="closePreview()">
        <div class="preview-dialog" (click)="$event.stopPropagation()">
          <div class="preview-header">
            <h3>Schedule Timeline Preview</h3>
            <button mat-icon-button (click)="closePreview()">
              <mat-icon>close</mat-icon>
            </button>
          </div>
          <div class="preview-content">
            <div class="preview-schedule-info">
              <h4>{{ name || 'Unnamed Schedule' }}</h4>
              <div class="preview-start">Starts at {{ startTime }}</div>
              <div class="preview-days">
                @for (day of getSelectedDays(); track day) {
                  <span class="day-chip">{{ dayLabels[day] }}</span>
                }
              </div>
            </div>

            <div class="timeline">
              @for (item of getSortedItems(); track item.id) {
                <div class="timeline-item">
                  <div class="timeline-time">+{{ item.offset }}<br><span class="timeline-abs">{{ getAbsoluteTime(item) }}</span></div>
                  <div class="timeline-content">
                    <div class="timeline-device">
                      <mat-icon>{{ getDeviceType(item.deviceId) === 'train' ? 'train' : 'call_split' }}</mat-icon>
                      {{ getDeviceName(item.deviceId) }}
                    </div>
                    <div class="timeline-action">
                      {{ getActionDescription(item) }}
                    </div>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    }

    @if (showSimulation) {
      <div class="preview-overlay" (click)="closeSimulation()">
        <div class="preview-dialog simulation-dialog" (click)="$event.stopPropagation()">
          <div class="preview-header">
            <h3>Schedule Simulation</h3>
            <button mat-icon-button (click)="closeSimulation()">
              <mat-icon>close</mat-icon>
            </button>
          </div>
          <div class="preview-content">
            <div class="simulation-info">
              <h4>{{ name || 'Unnamed Schedule' }}</h4>
              <div class="simulation-status">
                @if (isSimulating) {
                  <mat-icon class="spinning">sync</mat-icon>
                  @if ((state.scheduleRun()?.currentIndex ?? -1) < 0) {
                    <span>Starting…</span>
                  } @else {
                    <span>Step {{ (state.scheduleRun()?.currentIndex ?? 0) + 1 }} of {{ getSortedItems().length }}</span>
                  }
                } @else if (simulationComplete) {
                  <mat-icon class="success">check_circle</mat-icon>
                  <span>Simulation complete!</span>
                } @else {
                  <span>Ready to simulate {{ getSortedItems().length }} actions</span>
                }
              </div>
            </div>

            <div class="simulation-timeline">
              @for (item of getSortedItems(); track item.id; let i = $index) {
                <div class="simulation-item"
                     [class.current]="i === (state.scheduleRun()?.currentIndex ?? -1)"
                     [class.completed]="i < (state.scheduleRun()?.currentIndex ?? -1)"
                     [class.pending]="i > (state.scheduleRun()?.currentIndex ?? -1)">
                  <div class="simulation-time">+{{ item.offset }}</div>
                  <div class="simulation-content">
                    <div class="simulation-device">
                      <mat-icon>{{ getDeviceType(item.deviceId) === 'train' ? 'train' : 'call_split' }}</mat-icon>
                      {{ getDeviceName(item.deviceId) }}
                    </div>
                    <div class="simulation-action">
                      {{ getActionDescription(item) }}
                    </div>
                    @if (i === (state.scheduleRun()?.currentIndex ?? -1) && isSimulating) {
                      <div class="simulation-executing">
                        <mat-icon class="spinning">sync</mat-icon>
                        Executing...
                      </div>
                    }
                    @if (i < (state.scheduleRun()?.currentIndex ?? -1)) {
                      <div class="simulation-executed">
                        <mat-icon>check</mat-icon>
                        Done
                      </div>
                    }
                  </div>
                </div>
              }
            </div>

            <div class="simulation-controls">
              @if (!isSimulating && !simulationComplete) {
                <mat-form-field class="speed-factor-field">
                  <mat-label>Speed</mat-label>
                  <mat-select [(ngModel)]="simulationSpeedFactor">
                    <mat-option [value]="1">Real time (1&times;)</mat-option>
                    <mat-option [value]="10">Fast (10&times;)</mat-option>
                    <mat-option [value]="60">Very fast (60&times;)</mat-option>
                  </mat-select>
                </mat-form-field>
                <button mat-raised-button color="primary" (click)="startSimulation()">
                  <mat-icon>play_arrow</mat-icon> Start Simulation
                </button>
              }
              @if (isSimulating) {
                <button mat-raised-button color="warn" (click)="stopSimulation()">
                  <mat-icon>stop</mat-icon> Stop
                </button>
              }
              @if (simulationComplete) {
                <button mat-raised-button color="primary" (click)="resetSimulation()">
                  <mat-icon>replay</mat-icon> Run Again
                </button>
              }
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .dialog-content {
      width: 90vw;
      max-width: 1200px;
    }

    .form-field-full {
      width: 100%;
      margin-bottom: 8px;
    }

    .header-row {
      display: flex;
      gap: 16px;
      align-items: center;
      flex-wrap: wrap;
      margin-bottom: 8px;

      .header-name {
        flex: 1;
        min-width: 200px;
      }

      .header-start-time {
        width: 160px;
        flex-shrink: 0;
      }

      .header-disabled,
      .header-reset {
        flex-shrink: 0;
      }
    }

    .preview-start {
      font-size: 14px;
      color: #1976d2;
      font-weight: 500;
      margin-bottom: 8px;
    }

    :host-context(.dark-theme) .preview-start {
      color: #64b5f6;
    }

    .timeline-abs {
      font-weight: 400;
      font-size: 11px;
      opacity: 0.7;
    }

    .days-section {
      margin-bottom: 16px;

      label {
        font-size: 12px;
        color: rgba(0, 0, 0, 0.6);
        display: block;
        margin-bottom: 8px;
      }

      .days-checkboxes {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
      }
    }

    mat-divider {
      margin: 16px 0;
    }

    .items-section {
      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;

        h3 {
          margin: 0;
        }

        .section-actions {
          display: flex;
          gap: 8px;
        }
      }
    }

    .item-row {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-bottom: 8px;
      flex-wrap: wrap;

      .item-time {
        width: 150px;
        flex-shrink: 0;
      }

      .item-device {
        flex: 1;
        min-width: 150px;
      }

      .item-action {
        flex: 1;
        min-width: 120px;
      }

      .item-speed {
        width: 100px;
        flex-shrink: 0;
      }

      .item-fn {
        flex: 1;
        min-width: 200px;
      }

      .item-direction {
        flex: 1;
        min-width: 100px;
      }
    }

    .no-items {
      color: rgba(0, 0, 0, 0.6);
      font-style: italic;
      text-align: center;
      padding: 16px;
    }

    .validation-warning {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 4px 0;
      padding: 8px 12px;
      border-radius: 8px;
      background-color: #fff3e0;
      color: #e65100;
      font-size: 13px;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    :host-context(.dark-theme) .validation-warning {
      background-color: rgba(255, 152, 0, 0.15);
      color: #ffb74d;
    }

    .speed-factor-field {
      width: 160px;
    }

    .preview-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .preview-dialog {
      background-color: white;
      border-radius: 8px;
      max-width: 700px;
      max-height: 80vh;
      width: 90%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    :host-context(.dark-theme) .preview-dialog {
      background-color: #424242;
    }

    .preview-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.12);

      h3 {
        margin: 0;
      }
    }

    :host-context(.dark-theme) .preview-header {
      border-bottom-color: rgba(255, 255, 255, 0.12);
    }

    .preview-content {
      padding: 16px;
      overflow-y: auto;
    }

    .preview-schedule-info {
      margin-bottom: 24px;

      h4 {
        margin: 0 0 8px 0;
        font-size: 18px;
      }

      .preview-days {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .day-chip {
        padding: 4px 12px;
        background-color: #e3f2fd;
        border-radius: 16px;
        font-size: 12px;
      }
    }

    :host-context(.dark-theme) .preview-schedule-info .day-chip {
      background-color: #1565c0;
      color: rgba(255, 255, 255, 0.87);
    }

    .timeline {
      position: relative;
      padding-left: 100px;

      &::before {
        content: '';
        position: absolute;
        left: 90px;
        top: 0;
        bottom: 0;
        width: 2px;
        background-color: #1976d2;
      }
    }

    :host-context(.dark-theme) .timeline::before {
      background-color: #64b5f6;
    }

    .timeline-item {
      position: relative;
      margin-bottom: 24px;
      display: flex;
      align-items: flex-start;

      &::before {
        content: '';
        position: absolute;
        left: -16px;
        top: 4px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background-color: #1976d2;
        border: 2px solid white;
      }
    }

    :host-context(.dark-theme) .timeline-item::before {
      background-color: #64b5f6;
      border-color: #424242;
    }

    .timeline-time {
      position: absolute;
      left: -100px;
      top: 0;
      font-weight: 500;
      color: #1976d2;
      font-size: 14px;
    }

    :host-context(.dark-theme) .timeline-time {
      color: #64b5f6;
    }

    .timeline-content {
      flex: 1;
      padding-left: 8px;
    }

    .timeline-device {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
      margin-bottom: 4px;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .timeline-action {
      color: rgba(0, 0, 0, 0.6);
      font-size: 14px;
    }

    :host-context(.dark-theme) .timeline-action {
      color: rgba(255, 255, 255, 0.6);
    }

    .simulation-dialog {
      max-width: 800px;
    }

    .simulation-info {
      margin-bottom: 24px;

      h4 {
        margin: 0 0 12px 0;
        font-size: 18px;
      }

      .simulation-status {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px;
        background-color: #e3f2fd;
        border-radius: 8px;

        mat-icon {
          &.spinning {
            animation: spin 1s linear infinite;
          }

          &.success {
            color: #4caf50;
          }
        }
      }
    }

    :host-context(.dark-theme) .simulation-info .simulation-status {
      background-color: rgba(25, 118, 210, 0.2);
    }

    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }

    .simulation-timeline {
      margin-bottom: 24px;
      max-height: 400px;
      overflow-y: auto;
    }

    .simulation-item {
      display: flex;
      padding: 12px;
      margin-bottom: 8px;
      border-radius: 8px;
      border-left: 4px solid transparent;
      background-color: rgba(0, 0, 0, 0.02);

      &.pending {
        opacity: 0.5;
      }

      &.current {
        background-color: #fff3e0;
        border-left-color: #ff9800;
      }

      &.completed {
        background-color: #e8f5e9;
        border-left-color: #4caf50;
      }
    }

    :host-context(.dark-theme) .simulation-item {
      background-color: rgba(255, 255, 255, 0.05);

      &.current {
        background-color: rgba(255, 152, 0, 0.2);
      }

      &.completed {
        background-color: rgba(76, 175, 80, 0.2);
      }
    }

    .simulation-time {
      font-weight: 500;
      color: #1976d2;
      min-width: 80px;
      flex-shrink: 0;
    }

    :host-context(.dark-theme) .simulation-time {
      color: #64b5f6;
    }

    .simulation-content {
      flex: 1;
    }

    .simulation-device {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
      margin-bottom: 4px;

      mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }
    }

    .simulation-action {
      color: rgba(0, 0, 0, 0.6);
      font-size: 14px;
      margin-bottom: 4px;
    }

    :host-context(.dark-theme) .simulation-action {
      color: rgba(255, 255, 255, 0.6);
    }

    .simulation-executing {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #ff9800;
      font-size: 13px;
      font-weight: 500;

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    }

    .simulation-executed {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #4caf50;
      font-size: 13px;
      font-weight: 500;

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    }

    .simulation-controls {
      display: flex;
      justify-content: center;
      gap: 12px;
      padding-top: 16px;
      border-top: 1px solid rgba(0, 0, 0, 0.12);
    }

    :host-context(.dark-theme) .simulation-controls {
      border-top-color: rgba(255, 255, 255, 0.12);
    }
  `]
})
export class ScheduleDialogComponent implements OnDestroy {
  private dialogRef = inject(MatDialogRef<ScheduleDialogComponent>);
  data: ScheduleDialogData = inject(MAT_DIALOG_DATA);
  private api = inject(ApiService);
  readonly state = inject(StateService);

  name = '';
  startTime = '08:00:00';
  disabled = false;
  resetAtEnd = false;
  simulationSpeedFactor = 1;
  selectedDays: Record<DayKey, boolean> = {
    mon: false,
    tue: false,
    wed: false,
    thu: false,
    fri: false,
    sat: false,
    sun: false
  };
  items: ScheduleItem[] = [];

  allDays: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  dayLabels: Record<DayKey, string> = {
    mon: 'Monday',
    tue: 'Tuesday',
    wed: 'Wednesday',
    thu: 'Thursday',
    fri: 'Friday',
    sat: 'Saturday',
    sun: 'Sunday'
  };

  private itemCounter = 0;
  showPreview = false;
  showSimulation = false;
  isSimulating = false;
  simulationComplete = false;

  constructor() {
    if (this.data.schedule) {
      this.name = this.data.schedule.name;
      this.startTime = this.normalizeTime(this.data.schedule.startTime || '08:00:00');
      this.disabled = !this.data.schedule.enabled;
      this.resetAtEnd = !!this.data.schedule.resetAtEnd;
      this.data.schedule.days.forEach(day => {
        this.selectedDays[day] = true;
      });
      this.items = this.data.schedule.items.map(item => ({
        ...item,
        offset: this.normalizeTime(item.offset || (item as any).time || '00:00:00'),
        params: { ...item.params }
      }));
      this.itemCounter = this.items.length;
    }

    // Detect run completion via WebSocket signal. currentSimulationIndex is
    // read directly from state.scheduleRun() in the template (signal → always reactive).
    effect(() => {
      const run = this.state.scheduleRun();
      if (!this.isSimulating) return;
      if (!run) {
        // Run ended (completed or cancelled)
        this.isSimulating = false;
        this.simulationComplete = true;
      }
    });
  }

  /** Pad "HH:MM" to "HH:MM:SS" so string comparison and math are uniform. */
  private normalizeTime(t: string): string {
    return t.length === 5 ? `${t}:00` : t;
  }

  private timeToSeconds(t: string): number {
    const [h = 0, m = 0, s = 0] = this.normalizeTime(t).split(':').map(Number);
    return h * 3600 + m * 60 + s;
  }

  /** Wall-clock time this item fires: startTime + offset (wraps past midnight). */
  getAbsoluteTime(item: ScheduleItem): string {
    const total = (this.timeToSeconds(this.startTime) + this.timeToSeconds(item.offset || '00:00:00')) % 86400;
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  addItem(): void {
    const defaultDevice = this.data.devices[0];
    // Default the new action to 1 minute after the current latest offset.
    const lastOffset = this.items.length
      ? Math.max(...this.items.map(i => this.timeToSeconds(i.offset || '00:00:00')))
      : -60;
    const next = lastOffset + 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    this.items.push({
      id: `new-item-${++this.itemCounter}`,
      offset: `${pad(Math.floor(next / 3600))}:${pad(Math.floor((next % 3600) / 60))}:${pad(next % 60)}`,
      deviceId: defaultDevice?.id || '',
      action: 'start',
      params: {
        speed: 50,
        direction: 'forward'
      }
    });
  }

  removeItem(index: number): void {
    this.items.splice(index, 1);
  }

  sortItems(): void {
    this.items.sort((a, b) => (a.offset || '').localeCompare(b.offset || ''));
  }

  getDeviceFunctions(deviceId: string) {
    const device = this.data.devices.find(d => d.id === deviceId);
    return device?.functions || [];
  }

  onFunctionSelected(item: ScheduleItem, functionId: number): void {
    const device = this.data.devices.find(d => d.id === item.deviceId);
    const fn = device?.functions?.find(f => f.id === functionId);

    if (fn && item.params) {
      item.params.momentary = fn.momentary || false;
      if (fn.momentary && !item.params.duration) {
        item.params.duration = 0.5; // Default 0.5 seconds for momentary
      }
    }
  }

  getDeviceName(deviceId: string): string {
    const device = this.data.devices.find(d => d.id === deviceId);
    return device?.name || 'Unknown Device';
  }

  getDeviceType(deviceId: string): 'train' | 'switch' | 'light_signal' {
    const device = this.data.devices.find(d => d.id === deviceId);
    return device?.type || 'train';
  }

  getSelectedDays(): DayKey[] {
    return (Object.entries(this.selectedDays) as [DayKey, boolean][])
      .filter(([, selected]) => selected)
      .map(([day]) => day);
  }

  getSortedItems(): ScheduleItem[] {
    return [...this.items].sort((a, b) => (a.offset || '').localeCompare(b.offset || ''));
  }

  getActionDescription(item: ScheduleItem): string {
    switch (item.action) {
      case 'start':
        return `Start at speed ${item.params?.speed || 0} (${item.params?.direction || 'forward'})`;
      case 'stop':
        return 'Stop';
      case 'speed':
        return `Set speed to ${item.params?.speed || 0}`;
      case 'function':
        const fn = this.getDeviceFunctions(item.deviceId).find(f => f.id === item.params?.functionId);
        const fnName = fn?.name || `F${item.params?.functionId || 0}`;
        const durationText = item.params?.momentary && item.params?.duration ? ` (${item.params.duration}s)` : '';
        return `Toggle ${fnName} ${item.params?.functionState ? 'ON' : 'OFF'}${durationText}`;
      case 'reset':
        return 'Reset (Stop + Clear All Functions)';
      default:
        return item.action;
    }
  }

  /** Non-blocking sanity checks shown under the actions list. */
  getWarnings(): string[] {
    const warnings: string[] = [];
    if (!this.items.length) return warnings;

    const offsets = this.items.map(i => this.normalizeTime(i.offset || '00:00:00'));
    const seen = new Set<string>();
    const dupes = new Set<string>();
    offsets.forEach(o => (seen.has(o) ? dupes.add(o) : seen.add(o)));
    if (dupes.size) {
      warnings.push(`Duplicate offsets: ${[...dupes].map(d => '+' + d).join(', ')} — those actions fire at the same moment.`);
    }

    const first = Math.min(...offsets.map(o => this.timeToSeconds(o)));
    if (first > 0) {
      warnings.push(`First action is at +${offsets.find(o => this.timeToSeconds(o) === first)} — nothing happens before that. Intended?`);
    }

    if (this.items.some(i => !i.deviceId || !this.data.devices.find(d => d.id === i.deviceId))) {
      warnings.push('Some actions have no (or an unknown) device selected.');
    }

    const badOffset = this.items.find(i => !/^\d{1,2}:\d{2}(:\d{2})?$/.test(i.offset || ''));
    if (badOffset) {
      warnings.push(`Offset "${badOffset.offset}" is not valid — use HH:MM:SS (e.g. 00:05:00).`);
    }
    return warnings;
  }

  previewSchedule(): void {
    this.showPreview = true;
  }

  closePreview(): void {
    this.showPreview = false;
  }

  simulateSchedule(): void {
    this.showSimulation = true;
    this.resetSimulation();
  }

  closeSimulation(): void {
    this.stopSimulation();
    this.showSimulation = false;
  }

  startSimulation(): void {
    this.isSimulating = true;
    this.simulationComplete = false;

    const scheduleId = this.data.schedule?.id || 'temp-schedule';
    this.api.simulateSchedule(scheduleId, this.getSortedItems(), this.simulationSpeedFactor).subscribe({
      next: (success) => {
        if (!success) {
          console.error('Failed to start simulation (another run active?)');
          this.isSimulating = false;
        }
      },
      error: (err) => {
        console.error('Error starting simulation:', err);
        this.isSimulating = false;
      }
    });
  }

  stopSimulation(): void {
    const wasSimulating = this.isSimulating;
    this.isSimulating = false;
    if (wasSimulating) {
      this.api.cancelSimulation().subscribe();
    }
  }

  resetSimulation(): void {
    this.stopSimulation();
    this.simulationComplete = false;
  }

  ngOnDestroy(): void {
    if (this.isSimulating) {
      this.api.cancelSimulation().subscribe();
    }
  }

  isValid(): boolean {
    const hasName = this.name.trim().length > 0;
    const hasDays = Object.values(this.selectedDays).some(v => v);
    return hasName && hasDays;
  }

  cancel(): void {
    this.dialogRef.close();
  }

  save(): void {
    if (!this.isValid()) return;

    const days = (Object.entries(this.selectedDays) as [DayKey, boolean][])
      .filter(([, selected]) => selected)
      .map(([day]) => day);

    const schedule: Partial<WeeklySchedule> = {
      name: this.name.trim(),
      startTime: this.normalizeTime(this.startTime),
      enabled: !this.disabled,
      resetAtEnd: this.resetAtEnd,
      days,
      items: this.items.map(item => ({ ...item, offset: this.normalizeTime(item.offset) }))
    };

    this.dialogRef.close(schedule);
  }
}
