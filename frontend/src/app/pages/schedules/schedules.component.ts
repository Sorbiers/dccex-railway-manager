import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatListModule } from '@angular/material/list';
import { StateService } from '../../services/state.service';
import { ApiService } from '../../services/api.service';
import { WeeklySchedule } from '../../models';
import { ScheduleDialogComponent, ScheduleDialogData } from '../../components/schedule-dialog/schedule-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-schedules',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatDialogModule,
    MatChipsModule,
    MatListModule
  ],
  template: `
    <div class="schedules-page">
      <div class="page-header">
        <h1>Schedules</h1>
        <button mat-raised-button color="primary" (click)="openAddDialog()">
          <mat-icon>add</mat-icon> Add Schedule
        </button>
      </div>

      <div class="schedules-list">
        @for (schedule of state.schedules(); track schedule.id) {
          <mat-card class="schedule-card">
            <mat-card-header>
              <mat-icon mat-card-avatar>schedule</mat-icon>
              <mat-card-title>{{ schedule.name }}</mat-card-title>
              <mat-card-subtitle>
                {{ schedule.items.length }} actions
              </mat-card-subtitle>
            </mat-card-header>

            <mat-card-content>
              <!-- Days chips -->
              <div class="days-row">
                @for (day of allDays; track day) {
                  <span class="day-chip" [class.active]="schedule.days.includes(day)">
                    {{ dayLabels[day] }}
                  </span>
                }
              </div>

              <!-- Schedule items preview -->
              @if (schedule.items.length > 0) {
                <mat-list class="items-preview">
                  @for (item of schedule.items.slice(0, 3); track item.id) {
                    <mat-list-item>
                      <span matListItemTitle>{{ item.time }} - {{ getDeviceName(item.deviceId) }}</span>
                      <span matListItemLine>{{ getActionLabel(item) }}</span>
                    </mat-list-item>
                  }
                  @if (schedule.items.length > 3) {
                    <mat-list-item>
                      <span matListItemTitle class="more-items">+{{ schedule.items.length - 3 }} more actions...</span>
                    </mat-list-item>
                  }
                </mat-list>
              }
            </mat-card-content>

            <mat-card-actions align="end">
              <mat-slide-toggle
                [checked]="schedule.enabled"
                (change)="toggleEnabled(schedule)"
                color="primary">
                {{ schedule.enabled ? 'Active' : 'Inactive' }}
              </mat-slide-toggle>
              <button mat-icon-button (click)="openEditDialog(schedule)" matTooltip="Edit">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button color="warn" (click)="confirmDelete(schedule)" matTooltip="Delete">
                <mat-icon>delete</mat-icon>
              </button>
            </mat-card-actions>
          </mat-card>
        }
      </div>

      @if (state.schedules().length === 0) {
        <mat-card>
          <mat-card-content>
            <p>No schedules configured. Click "Add Schedule" to create your first automation schedule.</p>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .schedules-page {
      max-width: 1000px;
      margin: 0 auto;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;

      h1 {
        margin: 0;
      }
    }

    .schedules-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 16px;
    }

    .schedule-card {
      mat-card-header {
        mat-icon[mat-card-avatar] {
          font-size: 40px;
          width: 40px;
          height: 40px;
          color: #1976d2;
        }
      }
    }

    :host-context(.dark-theme) .schedule-card mat-card-header mat-icon[mat-card-avatar] {
      color: #64b5f6;
    }

    .days-row {
      display: flex;
      gap: 4px;
      margin-bottom: 12px;
    }

    .day-chip {
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      background-color: #e0e0e0;
      color: rgba(0, 0, 0, 0.6);

      &.active {
        background-color: #1976d2;
        color: white;
      }
    }

    :host-context(.dark-theme) .day-chip {
      background-color: #424242;
      color: rgba(255, 255, 255, 0.6);

      &.active {
        background-color: #1976d2;
        color: white;
      }
    }

    .items-preview {
      padding: 0;

      mat-list-item {
        height: auto;
        padding: 4px 0;
      }

      .more-items {
        color: rgba(0, 0, 0, 0.6);
        font-style: italic;
      }
    }

    :host-context(.dark-theme) .items-preview .more-items {
      color: rgba(255, 255, 255, 0.6);
    }

    mat-card-actions {
      display: flex;
      align-items: center;
      gap: 8px;

      mat-slide-toggle {
        margin-right: auto;
      }
    }
  `]
})
export class SchedulesComponent {
  state = inject(StateService);
  private api = inject(ApiService);
  private dialog = inject(MatDialog);

  allDays: ('mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun')[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  dayLabels: Record<string, string> = {
    mon: 'M',
    tue: 'T',
    wed: 'W',
    thu: 'T',
    fri: 'F',
    sat: 'S',
    sun: 'S'
  };

  getDeviceName(deviceId: string): string {
    const device = this.state.devices().find(d => d.id === deviceId);
    return device?.name || 'Unknown Device';
  }

  getActionLabel(item: any): string {
    switch (item.action) {
      case 'start':
        return `Start at speed ${item.params?.speed || 0}`;
      case 'stop':
        return 'Stop';
      case 'speed':
        return `Set speed to ${item.params?.speed || 0}`;
      case 'function':
        return `Function ${item.params?.functionId} ${item.params?.functionState ? 'On' : 'Off'}`;
      default:
        return item.action;
    }
  }

  openAddDialog(): void {
    const dialogRef = this.dialog.open(ScheduleDialogComponent, {
      width: '90vw',
      maxWidth: '1200px',
      data: { mode: 'add', devices: this.state.devices() } as ScheduleDialogData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.api.createSchedule(result).subscribe({
          next: () => this.state.refreshSchedules(),
          error: (err) => console.error('Failed to create schedule', err)
        });
      }
    });
  }

  openEditDialog(schedule: WeeklySchedule): void {
    const dialogRef = this.dialog.open(ScheduleDialogComponent, {
      width: '90vw',
      maxWidth: '1200px',
      data: { mode: 'edit', schedule, devices: this.state.devices() } as ScheduleDialogData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.api.updateSchedule(schedule.id, result).subscribe({
          next: () => this.state.refreshSchedules(),
          error: (err) => console.error('Failed to update schedule', err)
        });
      }
    });
  }

  toggleEnabled(schedule: WeeklySchedule): void {
    this.api.updateSchedule(schedule.id, { enabled: !schedule.enabled }).subscribe({
      next: () => this.state.refreshSchedules(),
      error: (err) => console.error('Failed to toggle schedule', err)
    });
  }

  confirmDelete(schedule: WeeklySchedule): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Schedule',
        message: `Are you sure you want to delete "${schedule.name}"? This action cannot be undone.`,
        confirmText: 'Delete',
        confirmColor: 'warn'
      } as ConfirmDialogData
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.api.deleteSchedule(schedule.id).subscribe({
          next: () => this.state.refreshSchedules(),
          error: (err) => console.error('Failed to delete schedule', err)
        });
      }
    });
  }
}
