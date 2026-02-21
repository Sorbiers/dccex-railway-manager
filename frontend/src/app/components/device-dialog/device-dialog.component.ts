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
import { MatMenuModule } from '@angular/material/menu';
import { Device, DccFunction } from '../../models';

interface FunctionPreset {
  name: string;
  manufacturer: string;
  model: string;
  decoder: string;
  functions: Array<{
    fn: number;
    label: string;
    icon: string;
    group: string;
    momentary: boolean;
  }>;
}

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
    MatAutocompleteModule,
    MatMenuModule
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
        <div class="image-upload-section">
          <h3>Train Image</h3>
          @if (imageUrl) {
            <div class="image-preview">
              <img [src]="imageUrl" [alt]="name">
              <button mat-icon-button color="warn" (click)="removeImage()" class="remove-image-btn">
                <mat-icon>close</mat-icon>
              </button>
            </div>
          }
          <input type="file" #fileInput accept="image/*" (change)="onImageSelected($event)" style="display: none">
          <button mat-stroked-button color="primary" (click)="fileInput.click()">
            <mat-icon>{{ imageUrl ? 'edit' : 'add_photo_alternate' }}</mat-icon>
            {{ imageUrl ? 'Change Image' : 'Upload Image' }}
          </button>
        </div>
      }

      @if (type === 'train') {
        <div class="functions-section">
          <div class="section-header">
            <h3>Functions</h3>
            <div class="section-header-actions">
              <button mat-button (click)="importFunctions()">
                <mat-icon>upload</mat-icon> Import Preset
              </button>
              <button mat-button color="primary" (click)="addFunction()">
                <mat-icon>add</mat-icon> Add Function
              </button>
            </div>
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

        .section-header-actions {
          display: flex;
          gap: 8px;
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

    .image-upload-section {
      margin-top: 16px;
      margin-bottom: 16px;

      h3 {
        margin: 0 0 12px 0;
        font-size: 14px;
      }

      .image-preview {
        position: relative;
        display: inline-block;
        margin-bottom: 12px;

        img {
          max-width: 300px;
          max-height: 200px;
          border-radius: 8px;
          object-fit: contain;
          display: block;
        }

        .remove-image-btn {
          position: absolute;
          top: 4px;
          right: 4px;
          background-color: rgba(0, 0, 0, 0.5);

          mat-icon {
            color: white;
          }
        }
      }
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
  imageUrl = '';

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

  functionPresets: FunctionPreset[] = [
    {
      name: 'Piko SmartDecoder 4.1 Sound PluX22',
      manufacturer: 'PIKO',
      model: 'BR360',
      decoder: 'SmartDecoder',
      functions: [
        { fn: 0, label: 'Lights', icon: 'lightbulb', group: 'lights', momentary: false },
        { fn: 1, label: 'Engine', icon: 'power_settings_new', group: 'quick', momentary: false },
        { fn: 2, label: 'Horn', icon: 'volume_up', group: 'quick', momentary: true },
        { fn: 3, label: 'Macro Horn', icon: 'campaign', group: 'sounds', momentary: true },
        { fn: 4, label: 'Cab Light', icon: 'light', group: 'lights', momentary: false },
        { fn: 5, label: 'Preheater', icon: 'whatshot', group: 'other', momentary: false },
        { fn: 6, label: 'Chassis Light', icon: 'highlight', group: 'lights', momentary: false },
        { fn: 7, label: 'Shunting Mode', icon: 'slow_motion_video', group: 'other', momentary: false },
        { fn: 8, label: 'Hand Brake', icon: 'hand_bones', group: 'other', momentary: true },
        { fn: 9, label: 'Engine Flap', icon: 'sensor_door', group: 'other', momentary: true },
        { fn: 10, label: 'Cab Door', icon: 'door_open', group: 'other', momentary: true },
        { fn: 11, label: 'Cab Window', icon: 'window', group: 'other', momentary: true },
        { fn: 12, label: 'Machine Room Door', icon: 'meeting_room', group: 'other', momentary: true },
        { fn: 13, label: 'Red Lights', icon: 'light_mode', group: 'lights', momentary: false },
        { fn: 14, label: 'Air Valve', icon: 'air', group: 'sounds', momentary: true },
        { fn: 15, label: 'Coupler', icon: 'link', group: 'other', momentary: true },
        { fn: 16, label: 'Brake Test', icon: 'quiz', group: 'other', momentary: true },
        { fn: 17, label: 'Bell', icon: 'notifications', group: 'sounds', momentary: false },
        { fn: 18, label: 'Battery Switch', icon: 'battery_charging_full', group: 'other', momentary: false },
        { fn: 19, label: 'Radio 1', icon: 'radio', group: 'sounds', momentary: true },
        { fn: 20, label: 'Radio 2', icon: 'radio', group: 'sounds', momentary: true },
        { fn: 21, label: 'Drain', icon: 'water_drop', group: 'other', momentary: true },
        { fn: 22, label: 'Sanding', icon: 'grain', group: 'other', momentary: true },
        { fn: 23, label: 'Curve Squeal', icon: 'turn_right', group: 'sounds', momentary: false },
        { fn: 24, label: 'Rail Clank', icon: 'railway_alert', group: 'sounds', momentary: false },
        { fn: 25, label: 'Train Light Push', icon: 'train', group: 'lights', momentary: false },
        { fn: 26, label: 'Train Light Pull', icon: 'train', group: 'lights', momentary: false },
        { fn: 27, label: 'Volume', icon: 'volume_up', group: 'sounds', momentary: false },
        { fn: 28, label: 'Tunnel Mode', icon: 'mode_night', group: 'other', momentary: false }
      ]
    }
  ];

  constructor() {
    if (this.data.device) {
      this.name = this.data.device.name;
      this.type = this.data.device.type;
      this.address = this.data.device.address;
      this.functions = [...(this.data.device.functions || [])];
      this.imageUrl = this.data.device.imageUrl || '';
    }
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        this.imageUrl = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage(): void {
    this.imageUrl = '';
  }

  importFunctions(): void {
    // For now, just import the first preset
    // In the future, could open a dialog to select from multiple presets
    const preset = this.functionPresets[0];
    if (preset) {
      this.functions = preset.functions.map(f => ({
        id: f.fn,
        name: f.label,
        icon: f.icon,
        group: f.group as 'quick' | 'lights' | 'sounds' | 'other',
        momentary: f.momentary
      }));
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
      functions: this.type === 'train' ? this.functions : undefined,
      imageUrl: this.type === 'train' ? this.imageUrl : undefined
    };

    this.dialogRef.close(device);
  }
}
