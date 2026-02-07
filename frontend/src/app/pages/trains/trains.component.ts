import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { StateService } from '../../services/state.service';
import { ApiService } from '../../services/api.service';
import { Device, DccFunction } from '../../models';
import { DeviceDialogComponent, DeviceDialogData } from '../../components/device-dialog/device-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-trains',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule
  ],
  template: `
    <div class="trains-page">
      <div class="page-header">
        <h1>Trains & Devices</h1>
        <button mat-raised-button color="primary" (click)="openAddDialog()">
          <mat-icon>add</mat-icon> Add Device
        </button>
      </div>

      <div class="devices-grid">
        @for (device of state.devices(); track device.id) {
          <mat-card class="device-card">
            <mat-card-header>
              <mat-icon mat-card-avatar>{{ device.type === 'train' ? 'train' : 'call_split' }}</mat-icon>
              <mat-card-title>{{ device.name }}</mat-card-title>
              <mat-card-subtitle>
                Address: {{ device.address }} | {{ device.type | titlecase }}
              </mat-card-subtitle>
            </mat-card-header>

            <mat-card-content>
              @if (device.type === 'train' && device.functions && device.functions.length > 0) {
                <div class="functions-preview">
                  <span class="label">Functions:</span>
                  <div class="function-chips">
                    @for (fn of device.functions.slice(0, 4); track fn.id) {
                      <span class="function-chip">
                        <mat-icon>{{ fn.icon || 'radio_button_unchecked' }}</mat-icon>
                        {{ fn.name }}
                      </span>
                    }
                    @if (device.functions.length > 4) {
                      <span class="more">+{{ device.functions.length - 4 }} more</span>
                    }
                  </div>
                </div>
              }
            </mat-card-content>

            <mat-card-actions align="end">
              <mat-slide-toggle
                [checked]="device.enabled"
                (change)="toggleEnabled(device)"
                color="primary">
                {{ device.enabled ? 'Enabled' : 'Disabled' }}
              </mat-slide-toggle>
              <button mat-icon-button (click)="openEditDialog(device)" matTooltip="Edit">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button color="warn" (click)="confirmDelete(device)" matTooltip="Delete">
                <mat-icon>delete</mat-icon>
              </button>
            </mat-card-actions>
          </mat-card>
        }
      </div>

      @if (state.devices().length === 0) {
        <mat-card>
          <mat-card-content>
            <p>No devices configured. Click "Add Device" to create your first train or switch.</p>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .trains-page {
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

    .devices-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;
    }

    .device-card {
      mat-card-header {
        mat-icon[mat-card-avatar] {
          font-size: 40px;
          width: 40px;
          height: 40px;
          color: #1976d2;
        }
      }
    }

    .functions-preview {
      margin-top: 8px;

      .label {
        font-size: 12px;
        color: rgba(0, 0, 0, 0.6);
        display: block;
        margin-bottom: 4px;
      }

      .function-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }

      .function-chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 8px;
        background-color: #e3f2fd;
        border-radius: 16px;
        font-size: 12px;

        mat-icon {
          font-size: 14px;
          width: 14px;
          height: 14px;
        }
      }

      .more {
        font-size: 12px;
        color: rgba(0, 0, 0, 0.6);
        padding: 4px 8px;
      }
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
export class TrainsComponent {
  state = inject(StateService);
  private api = inject(ApiService);
  private dialog = inject(MatDialog);

  openAddDialog(): void {
    const dialogRef = this.dialog.open(DeviceDialogComponent, {
      width: '500px',
      data: { mode: 'add' } as DeviceDialogData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.api.createDevice(result).subscribe({
          next: () => this.state.refreshDevices(),
          error: (err) => console.error('Failed to create device', err)
        });
      }
    });
  }

  openEditDialog(device: Device): void {
    const dialogRef = this.dialog.open(DeviceDialogComponent, {
      width: '500px',
      data: { mode: 'edit', device } as DeviceDialogData
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.api.updateDevice(device.id, result).subscribe({
          next: () => this.state.refreshDevices(),
          error: (err) => console.error('Failed to update device', err)
        });
      }
    });
  }

  toggleEnabled(device: Device): void {
    this.api.updateDevice(device.id, { enabled: !device.enabled }).subscribe({
      next: () => this.state.refreshDevices(),
      error: (err) => console.error('Failed to toggle device', err)
    });
  }

  confirmDelete(device: Device): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Device',
        message: `Are you sure you want to delete "${device.name}"? This action cannot be undone.`,
        confirmText: 'Delete',
        confirmColor: 'warn'
      } as ConfirmDialogData
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.api.deleteDevice(device.id).subscribe({
          next: () => this.state.refreshDevices(),
          error: (err) => console.error('Failed to delete device', err)
        });
      }
    });
  }
}
