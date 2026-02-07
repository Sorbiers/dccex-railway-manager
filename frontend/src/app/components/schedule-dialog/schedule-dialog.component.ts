import { Component, inject } from '@angular/core';
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
      <mat-form-field class="form-field-full">
        <mat-label>Schedule Name</mat-label>
        <input matInput [(ngModel)]="name" placeholder="e.g., Morning Commuter">
      </mat-form-field>

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
          <button mat-button color="primary" (click)="addItem()">
            <mat-icon>add</mat-icon> Add Action
          </button>
        </div>

        @for (item of items; track item.id; let i = $index) {
          <div class="item-row">
            <mat-form-field class="item-time">
              <mat-label>Time</mat-label>
              <input matInput type="time" [(ngModel)]="item.time">
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
                <mat-label>F#</mat-label>
                <input matInput type="number" [(ngModel)]="item.params!.functionId" min="0" max="28">
              </mat-form-field>
              <mat-checkbox [(ngModel)]="item.params!.functionState">On</mat-checkbox>
            }

            <button mat-icon-button color="warn" (click)="removeItem(i)">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        }

        @if (items.length === 0) {
          <p class="no-items">No actions defined. Click "Add Action" to schedule train operations.</p>
        }
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="cancel()">Cancel</button>
      <button mat-raised-button color="primary" (click)="save()" [disabled]="!isValid()">
        {{ data.mode === 'add' ? 'Add' : 'Save' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-content {
      min-width: 500px;
    }

    .form-field-full {
      width: 100%;
      margin-bottom: 8px;
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
      }
    }

    .item-row {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-bottom: 8px;
      flex-wrap: wrap;

      .item-time {
        width: 100px;
      }

      .item-device {
        width: 150px;
      }

      .item-action {
        width: 120px;
      }

      .item-speed, .item-fn {
        width: 70px;
      }

      .item-direction {
        width: 100px;
      }
    }

    .no-items {
      color: rgba(0, 0, 0, 0.6);
      font-style: italic;
      text-align: center;
      padding: 16px;
    }
  `]
})
export class ScheduleDialogComponent {
  private dialogRef = inject(MatDialogRef<ScheduleDialogComponent>);
  data: ScheduleDialogData = inject(MAT_DIALOG_DATA);

  name = '';
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

  constructor() {
    if (this.data.schedule) {
      this.name = this.data.schedule.name;
      this.data.schedule.days.forEach(day => {
        this.selectedDays[day] = true;
      });
      this.items = this.data.schedule.items.map(item => ({
        ...item,
        params: { ...item.params }
      }));
      this.itemCounter = this.items.length;
    }
  }

  addItem(): void {
    const defaultDevice = this.data.devices[0];
    this.items.push({
      id: `new-item-${++this.itemCounter}`,
      time: '08:00',
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
      days,
      items: this.items
    };

    this.dialogRef.close(schedule);
  }
}
