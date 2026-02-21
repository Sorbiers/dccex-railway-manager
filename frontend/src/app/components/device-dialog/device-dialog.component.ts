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
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { Device, DccFunction } from '../../models';

export interface DeviceDialogData {
  mode: 'add' | 'edit';
  device?: Device;
}

@Component({
  selector: 'app-device-dialog',
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
    MatAutocompleteModule
  ],
  template: `
    <h2 mat-dialog-title>{{ data.mode === 'add' ? 'Add Device' : 'Edit Device' }}</h2>

    <mat-dialog-content class="dialog-content">
      <mat-form-field class="form-field-full">
        <mat-label>Name</mat-label>
        <input matInput [(ngModel)]="name" placeholder="e.g., Steam Engine 4-6-2">
      </mat-form-field>

      <mat-form-field class="form-field-full">
        <mat-label>Type</mat-label>
        <mat-select [(ngModel)]="type" [disabled]="data.mode === 'edit'">
          <mat-option value="train">Train</mat-option>
          <mat-option value="switch">Switch/Turnout</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field class="form-field-full">
        <mat-label>DCC Address</mat-label>
        <input matInput type="number" [(ngModel)]="address" min="1" max="9999">
      </mat-form-field>

      @if (type === 'train') {
        <div class="functions-section">
          <div class="section-header">
            <h3>Functions</h3>
            <button mat-button color="primary" (click)="addFunction()">
              <mat-icon>add</mat-icon> Add Function
            </button>
          </div>

          @for (fn of functions; track fn.id; let i = $index) {
            <div class="function-row">
              <mat-form-field class="fn-id">
                <mat-label>F#</mat-label>
                <input matInput type="number" [(ngModel)]="fn.id" min="0" max="28">
              </mat-form-field>

              <mat-form-field class="fn-name">
                <mat-label>Name</mat-label>
                <input matInput [(ngModel)]="fn.name" placeholder="e.g., Bell">
              </mat-form-field>

              <mat-form-field class="fn-icon">
                <mat-label>Icon</mat-label>
                <input matInput [(ngModel)]="fn.icon" [matAutocomplete]="auto" placeholder="e.g., lightbulb">
                <mat-autocomplete #auto="matAutocomplete">
                  @for (icon of iconSuggestions; track icon) {
                    <mat-option [value]="icon">
                      <mat-icon>{{ icon }}</mat-icon> {{ icon }}
                    </mat-option>
                  }
                </mat-autocomplete>
              </mat-form-field>

              <mat-form-field class="fn-group">
                <mat-label>Group</mat-label>
                <mat-select [(ngModel)]="fn.group">
                  <mat-option value="quick">Quick Access</mat-option>
                  <mat-option value="lights">Lights</mat-option>
                  <mat-option value="sounds">Sounds</mat-option>
                  <mat-option value="other">Other</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-checkbox [(ngModel)]="fn.momentary">Momentary</mat-checkbox>

              <button mat-icon-button color="warn" (click)="removeFunction(i)">
                <mat-icon>delete</mat-icon>
              </button>
            </div>
          }

          @if (functions.length === 0) {
            <p class="no-functions">No functions defined. Click "Add Function" to add decoder functions.</p>
          }
        </div>
      }
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
      min-width: 400px;
    }

    .form-field-full {
      width: 100%;
      margin-bottom: 8px;
    }

    .functions-section {
      margin-top: 16px;

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

    .function-row {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-bottom: 8px;

      .fn-id {
        width: 100px;
      }

      .fn-name {
        flex: 1;
      }

      .fn-icon, .fn-group {
        width: 150px;
      }
    }

    .no-functions {
      color: rgba(0, 0, 0, 0.6);
      font-style: italic;
      text-align: center;
      padding: 16px;
    }
  `]
})
export class DeviceDialogComponent {
  private dialogRef = inject(MatDialogRef<DeviceDialogComponent>);
  data: DeviceDialogData = inject(MAT_DIALOG_DATA);

  name = '';
  type: 'train' | 'switch' = 'train';
  address = 3;
  functions: DccFunction[] = [];

  iconSuggestions = [
    'lightbulb',
    'notifications',
    'volume_up',
    'light',
    'highlight',
    'link',
    'cloud',
    'speed',
    'volume_off',
    'music_note',
    'radio_button_unchecked',
    'flash_on',
    'wb_sunny',
    'bedtime',
    'air',
    'settings',
    'build',
    'lock',
    'power_settings_new',
    'visibility',
    'mic',
    'headset'
  ];

  constructor() {
    if (this.data.device) {
      this.name = this.data.device.name;
      this.type = this.data.device.type;
      this.address = this.data.device.address;
      this.functions = [...(this.data.device.functions || [])];
    }
  }

  addFunction(): void {
    const nextId = this.functions.length > 0
      ? Math.max(...this.functions.map(f => f.id)) + 1
      : 0;

    this.functions.push({
      id: nextId,
      name: '',
      icon: 'radio_button_unchecked',
      group: 'quick',
      momentary: false
    });
  }

  removeFunction(index: number): void {
    this.functions.splice(index, 1);
  }

  isValid(): boolean {
    return this.name.trim().length > 0 && this.address > 0;
  }

  cancel(): void {
    this.dialogRef.close();
  }

  save(): void {
    if (!this.isValid()) return;

    const device: Partial<Device> = {
      name: this.name.trim(),
      type: this.type,
      address: this.address,
      functions: this.type === 'train' ? this.functions : undefined
    };

    this.dialogRef.close(device);
  }
}
