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
  templateUrl: './trains.component.html',
  styleUrls: ['./trains.component.scss']
})
export class TrainsComponent {
  state = inject(StateService);
  private api = inject(ApiService);
  private dialog = inject(MatDialog);

  openAddDialog(): void {
    const dialogRef = this.dialog.open(DeviceDialogComponent, {
      minWidth: '500px',
      width: '90vw',
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
      minWidth: '500px',
      width: '90vw',
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
