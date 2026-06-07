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
import { MatExpansionModule } from '@angular/material/expansion';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Device, DccFunction, TurnoutType, SignalAspect } from '../../models';

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
    MatMenuModule,
    MatExpansionModule
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
        <mat-select [(ngModel)]="type" [disabled]="data.mode === 'edit'" (ngModelChange)="onTypeChange($event)">
          <mat-option value="train">Train</mat-option>
          <mat-option value="switch">Switch/Turnout</mat-option>
          <mat-option value="light_signal">Light Signal</mat-option>
        </mat-select>
      </mat-form-field>

      @if (type !== 'light_signal') {
        <div class="number-row">
          <mat-form-field class="form-field-number">
            <mat-label>DCC Address</mat-label>
            <input matInput type="number" [(ngModel)]="address" min="1" max="9999">
          </mat-form-field>
        </div>
      }

      @if (type === 'switch') {
        <div class="turnout-type-section">
          <h3>Turnout Type</h3>
          <div class="turnout-type-grid">
            @for (turnoutType of turnoutTypesV3; track turnoutType.id) {
              <button type="button" class="turnout-type-btn"
                      [class.selected]="selectedTurnoutType === turnoutType.id"
                      (click)="selectTurnoutType(turnoutType.id)"
                      [title]="turnoutType.description">
                <div class="turnout-icon" [innerHTML]="getSafeHtml(turnoutType.svgIconCode)"></div>
                <span>{{ turnoutType.name }}</span>
              </button>
            }
          </div>
        </div>

        <div class="number-row">
          <mat-form-field class="form-field-number">
            <mat-label>Output</mat-label>
            <input matInput type="number" [(ngModel)]="output" min="0">
          </mat-form-field>
          @if (selectedTurnoutType === 'three_way' || selectedTurnoutType === 'double_slip') {
            <mat-form-field class="form-field-number">
              <mat-label>Output 2</mat-label>
              <input matInput type="number" [(ngModel)]="output2" min="0">
            </mat-form-field>
          }
        </div>
      }

      @if (type === 'light_signal') {
        <div class="signal-section">
          <h3>Signal Configuration</h3>
          <mat-form-field class="form-field-full">
            <mat-label>Signal Type</mat-label>
            <mat-select [(ngModel)]="signalType" (ngModelChange)="onSignalTypeChange($event)">
              <mat-option value="3-aspect">3-Aspect Color-Light Signal</mat-option>
              <mat-option value="2-aspect">2-Aspect Color-Light Signal</mat-option>
            </mat-select>
          </mat-form-field>

          <div class="signal-aspects">
            @for (aspect of signalAspects; track $index) {
              <div class="signal-aspect-row">
                <div class="signal-aspect-indicator" [style.background-color]="getAspectColor(aspect.name)"></div>
                <span class="signal-aspect-name">{{ aspect.name }}</span>
                <mat-form-field class="form-field-number">
                  <mat-label>vGPIO Address</mat-label>
                  <input matInput type="number" [(ngModel)]="aspect.vgpioAddress" min="0">
                </mat-form-field>
                <mat-checkbox [(ngModel)]="aspect.reverse">Reverse</mat-checkbox>
              </div>
            }
          </div>
        </div>
      }

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
      @if (type === 'train' && functions.length > 0) {
        <button mat-button color="accent" (click)="previewFunctions()">
          <mat-icon>preview</mat-icon> Preview Functions
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
            <h3>Function Preview</h3>
            <button mat-icon-button (click)="closePreview()">
              <mat-icon>close</mat-icon>
            </button>
          </div>
          <div class="preview-content">
            <div class="preview-image">
              @if (imageUrl) {
                <img [src]="imageUrl" [alt]="name">
              } @else {
                <div class="no-image-placeholder">
                  <mat-icon>train</mat-icon>
                  <p>{{ name || 'Train Preview' }}</p>
                </div>
              }
            </div>

            <div class="preview-functions">
              <!-- Quick Access Functions -->
              @if (getPreviewFunctions('quick').length > 0) {
                <div class="preview-section">
                  <h4>Quick Functions</h4>
                  <div class="preview-function-grid">
                    @for (fn of getPreviewFunctions('quick'); track fn.id) {
                      <button mat-raised-button class="preview-function-btn"
                              [class.active]="previewActiveFunctions.has(fn.id)"
                              (click)="togglePreviewFunction(fn)">
                        <mat-icon>{{ fn.icon || 'radio_button_unchecked' }}</mat-icon>
                        <span>{{ fn.name }}</span>
                      </button>
                    }
                  </div>
                </div>
              }

              <!-- Grouped Functions -->
              @for (group of ['lights', 'sounds', 'other']; track group) {
                @if (getPreviewFunctions(group).length > 0) {
                  <mat-expansion-panel>
                    <mat-expansion-panel-header>
                      <mat-panel-title>
                        <mat-icon>{{ getGroupIcon(group) }}</mat-icon>
                        {{ group | titlecase }}
                      </mat-panel-title>
                    </mat-expansion-panel-header>
                    <div class="preview-function-grid">
                      @for (fn of getPreviewFunctions(group); track fn.id) {
                        <button mat-raised-button class="preview-function-btn"
                                [class.active]="previewActiveFunctions.has(fn.id)"
                                (click)="togglePreviewFunction(fn)">
                          <mat-icon>{{ fn.icon || 'radio_button_unchecked' }}</mat-icon>
                          <span>{{ fn.name }}</span>
                        </button>
                      }
                    </div>
                  </mat-expansion-panel>
                }
              }
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .dialog-content {
      min-width: 400px;
    }

    .form-field-full {
      width: 100%;
      margin-bottom: 8px;
    }

    .number-row {
      display: flex;
      gap: 12px;
      margin-bottom: 8px;
    }

    .form-field-number {
      width: 140px;
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
      max-width: 600px;
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

    .preview-image {
      text-align: center;
      margin-bottom: 16px;

      img {
        max-width: 100%;
        max-height: 200px;
        border-radius: 8px;
        object-fit: contain;
      }

      .no-image-placeholder {
        padding: 40px;
        background-color: rgba(0, 0, 0, 0.05);
        border-radius: 8px;
        text-align: center;

        mat-icon {
          font-size: 64px;
          width: 64px;
          height: 64px;
          color: rgba(0, 0, 0, 0.3);
        }

        p {
          margin: 8px 0 0 0;
          color: rgba(0, 0, 0, 0.6);
        }
      }
    }

    :host-context(.dark-theme) .preview-image .no-image-placeholder {
      background-color: rgba(255, 255, 255, 0.05);

      mat-icon {
        color: rgba(255, 255, 255, 0.3);
      }

      p {
        color: rgba(255, 255, 255, 0.6);
      }
    }

    .preview-section {
      margin-bottom: 16px;

      h4 {
        margin: 0 0 12px 0;
        font-size: 14px;
        color: rgba(0, 0, 0, 0.6);
      }
    }

    :host-context(.dark-theme) .preview-section h4 {
      color: rgba(255, 255, 255, 0.6);
    }

    .preview-function-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
      gap: 8px;
      padding: 8px 0;
    }

    .preview-function-btn {
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

    :host-context(.dark-theme) .preview-function-btn.active {
      background-color: #1565c0;
      color: rgba(255, 255, 255, 0.87);
    }

    mat-expansion-panel {
      margin-bottom: 8px;
    }

    .signal-section {
      margin-top: 16px;
      margin-bottom: 16px;

      h3 {
        margin: 0 0 12px 0;
        font-size: 14px;
      }
    }

    .signal-aspects {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 12px;
    }

    .signal-aspect-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .signal-aspect-indicator {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      flex-shrink: 0;
      border: 2px solid rgba(0,0,0,0.2);
    }

    .signal-aspect-name {
      width: 60px;
      font-size: 14px;
      font-weight: 500;
      flex-shrink: 0;
    }

    .turnout-type-section {
      margin-top: 16px;
      margin-bottom: 16px;

      h3 {
        margin: 0 0 12px 0;
        font-size: 14px;
      }
    }

    .turnout-type-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
      gap: 12px;
    }

    .turnout-type-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 12px 8px;
      border: 2px solid rgba(0, 0, 0, 0.12);
      border-radius: 8px;
      background-color: white;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        border-color: rgba(0, 0, 0, 0.3);
        background-color: rgba(0, 0, 0, 0.04);
      }

      &.selected {
        border-color: #1976d2;
        background-color: #e3f2fd;
      }

      span {
        font-size: 11px;
        text-align: center;
        margin-top: 4px;
        color: rgba(0, 0, 0, 0.87);
      }
    }

    :host-context(.dark-theme) .turnout-type-btn {
      background-color: #424242;
      border-color: rgba(255, 255, 255, 0.12);

      &:hover {
        border-color: rgba(255, 255, 255, 0.3);
        background-color: rgba(255, 255, 255, 0.08);
      }

      &.selected {
        border-color: #64b5f6;
        background-color: rgba(100, 181, 246, 0.15);
      }

      span {
        color: rgba(255, 255, 255, 0.87);
      }
    }

    .turnout-icon {
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;

      ::ng-deep svg {
        width: 100%;
        height: 100%;
      }
    }
  `]
})
export class DeviceDialogComponent {
  private dialogRef = inject(MatDialogRef<DeviceDialogComponent>);
  private sanitizer = inject(DomSanitizer);
  data: DeviceDialogData = inject(MAT_DIALOG_DATA);

  name = '';
  type: 'train' | 'switch' | 'light_signal' = 'train';
  address = 3;
  output = 0;
  output2 = 0;
  functions: DccFunction[] = [];
  imageUrl = '';
  showPreview = false;
  previewActiveFunctions = new Set<number>();
  selectedTurnoutType = '';
  signalType: '3-aspect' | '2-aspect' = '3-aspect';
  signalAspects: SignalAspect[] = [];

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

  turnoutTypes: TurnoutType[] = [
    {
      id: "left",
      name: "Left",
      description: "Turnout diverges to the left",
      svgIconCode: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><g fill='none' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'><path d='M12 32h40' stroke='#00b300'/><path d='M24 32 Q36 32 44 16' stroke='currentColor'/></g></svg>"
    },
    {
      id: "right",
      name: "Right",
      description: "Turnout diverges to the right",
      svgIconCode: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><g fill='none' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'><path d='M12 32h40' stroke='#00b300'/><path d='M24 32 Q36 32 44 48' stroke='currentColor'/></g></svg>"
    },
    {
      id: "wye",
      name: "Wye",
      description: "Symmetrical turnout diverging equally left and right",
      svgIconCode: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><g fill='none' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'><path d='M10 32h14' stroke='#00b300'/><path d='M24 32 Q36 32 48 16' stroke='currentColor'/><path d='M24 32 Q36 32 48 48' stroke='currentColor'/></g></svg>"
    },
    {
      id: "three_way",
      name: "Three-Way",
      description: "Single turnout providing three routes",
      svgIconCode: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><g fill='none' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'><path d='M10 32h44' stroke='#00b300'/><path d='M20 32 Q32 32 44 16' stroke='currentColor'/><path d='M28 32 Q40 32 52 48' stroke='currentColor'/></g></svg>"
    },
    {
      id: "double_slip",
      name: "Double Slip",
      description: "Crossing combined with two opposing turnouts",
      svgIconCode: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><g fill='none' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'><path d='M14 14l36 36' stroke='#00b300'/><path d='M14 50l36-36' stroke='#00b300'/><path d='M25 25 Q32 16 39 25' stroke='currentColor'/><path d='M25 39 Q32 48 39 39' stroke='currentColor'/></g></svg>"
    },
    {
      id: "curved_left",
      name: "Curved Left",
      description: "Curved turnout diverging left",
      svgIconCode: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><g fill='none' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'><path d='M12 50 Q40 50 54 20' stroke='#00b300'/><path d='M24 48 Q34 34 40 12' stroke='currentColor'/></g></svg>"
    },
    {
      id: "curved_right",
      name: "Curved Right",
      description: "Curved turnout diverging right",
      svgIconCode: "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><g fill='none' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'><path d='M12 14 Q40 14 54 44' stroke='#00b300'/><path d='M24 16 Q34 30 40 52' stroke='currentColor'/></g></svg>"
    }
  ];

  // v2

  turnoutTypesV2: TurnoutType[] = [
    {
            "id": "left",
            "name": "Left",
            "description": "Turnout diverges to the left",
            "svgIconCode": "<svg xmlns='http://www.w3.org/2000/svg' height='24px' viewBox='0 -960 960 960' width='24px' fill='currentColor'><path d='M480-160v-520q0-33-23.5-56.5T400-760H240v80h160q0 17 0 0v360L240-480v110l240 210Zm80-520h160v-80h-160q-66 0-113 47t-47 113v40h80v-40q0-33 23.5-56.5T560-680Z'/></svg>"
          },
          {
            "id": "right",
            "name": "Right",
            "description": "Turnout diverges to the right",
            "svgIconCode": "<svg xmlns='http://www.w3.org/2000/svg' height='24px' viewBox='0 -960 960 960' width='24px' fill='currentColor'><path d='M480-160v-520q0-33 23.5-56.5T560-760h160v80H560q0 17 0 0v360l160-160v110L480-160Zm-80-520H240v-80h160q66 0 113 47t47 113v40h-80v-40q0-33-23.5-56.5T400-680Z'/></svg>"
          },
          {
            "id": "wye",
            "name": "Wye",
            "description": "Symmetrical turnout diverging equally left and right",
            "svgIconCode": "<svg xmlns='http://www.w3.org/2000/svg' height='24px' viewBox='0 -960 960 960' width='24px' fill='currentColor'><path d='M440-160v-260L240-620v110l200 200v310h-80Zm80 0v-310l200-200v-110L520-420v260h-80ZM240-680v-80h240v80H240Zm240 0v-80h240v80H480Z'/></svg>"
          },
          {
            "id": "three_way",
            "name": "Three-Way",
            "description": "Single turnout providing three routes",
            "svgIconCode": "<svg xmlns='http://www.w3.org/2000/svg' height='24px' viewBox='0 -960 960 960' width='24px' fill='currentColor'><path d='M440-160v-260L240-620v110l200 200v310h-80Zm80 0v-520q0-33-23.5-56.5T440-760H240v80h200q0 17 0 0v360h80Zm80-520h160v-80H600q-66 0-113 47t-47 113v40h80v-40q0-33 23.5-56.5T600-680Z'/></svg>"
          },
          {
            "id": "double_slip",
            "name": "Double Slip",
            "description": "Crossing combined with two opposing turnouts",
            "svgIconCode": "<svg xmlns='http://www.w3.org/2000/svg' height='24px' viewBox='0 -960 960 960' width='24px' fill='currentColor'><path d='M240-200v-120l200-200-200-200v-120h120l200 200 200-200h120v120L680-520l200 200v120H760L560-400 360-200H240Zm160-80h160L480-360l-80 80Zm0-400 80 80 80-80H400Z'/></svg>"
          },
          {
            "id": "curved_left",
            "name": "Curved Left",
            "description": "Curved turnout diverging left",
            "svgIconCode": "<svg xmlns='http://www.w3.org/2000/svg' height='24px' viewBox='0 -960 960 960' width='24px' fill='currentColor'><path d='M520-160v-360q0-100-70-170t-170-70H240v80h40q83 0 141.5 58.5T480-480v320l-240-210v110l280 240Zm0-520h200v-80H520v80Z'/></svg>"
          },
          {
            "id": "curved_right",
            "name": "Curved Right",
            "description": "Curved turnout diverging right",
            "svgIconCode": "<svg xmlns='http://www.w3.org/2000/svg' height='24px' viewBox='0 -960 960 960' width='24px' fill='currentColor'><path d='M440-160v-360q0-100 70-170t170-70h40v-80h-40q-133 0-221.5 88.5T360-520v320l240-210v110L440-160Zm280-520H520v-80h200v80Z'/></svg>"
          }
        

  ];


  // v3

  turnoutTypesV3: TurnoutType[] = [

    
          {
            "id": "left",
            "name": "Left",
            "description": "Turnout diverges to the left",
            "svgIconCode": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 -960 960 960' width='24px' height='24px'><path d='M160-440h640v-80H160Zm200-80 240-240h113L473-520H360Z' fill='#666666'/><path d='M160-520h640v80H160Z' fill='#71c837'/></svg>"
          },
          {
            "id": "right",
            "name": "Right",
            "description": "Turnout diverges to the right",
            "svgIconCode": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 -960 960 960' width='24px' height='24px'><path d='M160-440h640v-80H160Zm200 0 240 240h113L473-440H360Z' fill='#666666'/><path d='M160-520h640v80H160Z' fill='#71c837'/></svg>"
          },
          {
            "id": "wye",
            "name": "Wye",
            "description": "Symmetrical turnout diverging equally left and right",
            "svgIconCode": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 -960 960 960' width='24px' height='24px'><path d='M160-440h200v-80H160v80Zm200-80 240-240h113L473-520H360Zm0 80 240 240h113L473-440H360Z' fill='#666666'/><path d='M160-520h313v80H160Z' fill='#71c837'/></svg>"
          },
          {
            "id": "three_way",
            "name": "Three-Way",
            "description": "Single turnout providing three routes",
            "svgIconCode": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 -960 960 960' width='24px' height='24px'><path d='M160-440h640v-80H160v80Zm200-80 240-240h113L473-520H360Zm0 80 240 240h113L473-440H360Z' fill='#666666'/><path d='M160-440h640v-80H160Zm200-80 19.53728 39.69152 84.20822 4.11311L473-520Zm0 80 222.72494-.20566L436.59897-492.85347 473-440Z' fill='#71c837'/></svg>"
          },
          {
            "id": "double_slip",
            "name": "Double Slip",
            "description": "Crossing combined with two opposing turnouts",
            "svgIconCode": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><path d='m 56.106972,31.935173 c -7.053001,1.017555 -13.489998,1.554625 -19.93169,1.65749 -2.240802,0.03578 -4.482172,0.01902 -6.750238,-0.04833 C 23.459805,33.367191 17.309904,32.840075 10.5,31.998428' fill='none' stroke='#71c837' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'/><path d='M 56.106972,39.330938 C 49.053971,38.313383 42.616974,37.776313 36.175282,37.673448 33.93448,37.637668 31.69311,37.654428 29.425044,37.721778 23.459805,37.89892 17.309904,38.426036 10.5,39.267683' fill='none' stroke='#71c837' stroke-width='5' stroke-linecap='round' stroke-linejoin='round'/><path d='M 53.258319,40.289972 C 40.191461,39.491229 29.610068,37.785319 16.061401,34.293166 13.282909,33.577012 12.403309,33.335322 12.105921,33.206305 11.292134,32.853258 10.78738,32.013473 10.96257,31.304056 c 0.186323,-0.754506 0.931623,-1.344041 1.864444,-1.474783 0.437573,-0.06133 0.913373,0.0082 1.939358,0.283395 14.600947,3.916358 25.608346,5.750254 39.315699,6.55022 0.804918,0.04698 1.564324,0.106098 1.687568,0.131389 1.13242,0.232341 1.92852,1.2122 1.708556,2.102931 -0.135638,0.549257 -0.63732,1.0803 -1.224401,1.29606 -0.595812,0.21897 -0.857268,0.227411 -2.995475,0.09671 z' fill='#666666'/><path d='m 53.358845,30.900298 c -13.065133,0.826467 -23.642882,2.554825 -37.184109,6.075718 -2.776967,0.722047 -3.65605,0.965605 -3.953164,1.095253 -0.813036,0.354772 -1.316008,1.195625 -1.139312,1.904669 0.187922,0.754109 0.934473,1.342062 1.867569,1.470825 0.437701,0.0604 0.913353,-0.01014 1.938752,-0.287511 14.592604,-3.947329 25.596086,-5.804577 39.301712,-6.633626 0.804816,-0.04868 1.564095,-0.109418 1.687285,-0.13497 1.131924,-0.234743 1.925944,-1.216289 1.704089,-2.106552 -0.136802,-0.548966 -0.639609,-1.078945 -1.227147,-1.293458 -0.596276,-0.217706 -0.857749,-0.225592 -2.995673,-0.09036 z' fill='#666666'/></svg>"
          },
          {
            "id": "curved_left",
            "name": "Curved Left",
            "description": "Curved turnout diverging left",
            "svgIconCode": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><path d='M14 46C24 38 32 30 40 16' stroke='#666666' stroke-width='5' stroke-linecap='round' fill='none'/><path d='M14 46C28 38 38 30 50 18' stroke='#71c837' stroke-width='5' stroke-linecap='round' fill='none'/></svg>"
          },
          {
            "id": "curved_right",
            "name": "Curved Right",
            "description": "Curved turnout diverging right",
            "svgIconCode": "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><path d='M12 44C22 40 32 38 50 36' stroke='#666666' stroke-width='5' stroke-linecap='round' fill='none'/><path d='M12 44C24 34 36 28 52 20' stroke='#71c837' stroke-width='5' stroke-linecap='round' fill='none'/></svg>"
          }
        


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
      this.output = this.data.device.output || 0;
      this.output2 = this.data.device.output2 || 0;
      this.functions = [...(this.data.device.functions || [])];
      this.imageUrl = this.data.device.imageUrl || '';
      this.selectedTurnoutType = this.data.device.turnoutType || '';
      this.signalType = this.data.device.signalType || '3-aspect';
      this.signalAspects = this.data.device.signalAspects
        ? [...this.data.device.signalAspects.map(a => ({ ...a }))]
        : this.defaultAspects(this.signalType);
    } else if (this.type === 'light_signal') {
      this.signalAspects = this.defaultAspects(this.signalType);
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

  previewFunctions(): void {
    this.showPreview = true;
    this.previewActiveFunctions.clear();
  }

  closePreview(): void {
    this.showPreview = false;
    this.previewActiveFunctions.clear();
  }

  getPreviewFunctions(group: string): DccFunction[] {
    return this.functions.filter(f => f.group === group);
  }

  togglePreviewFunction(fn: DccFunction): void {
    if (fn.momentary) {
      // For momentary functions, just flash the active state
      this.previewActiveFunctions.add(fn.id);
      setTimeout(() => {
        this.previewActiveFunctions.delete(fn.id);
      }, 200);
    } else {
      // For toggle functions, toggle the state
      if (this.previewActiveFunctions.has(fn.id)) {
        this.previewActiveFunctions.delete(fn.id);
      } else {
        this.previewActiveFunctions.add(fn.id);
      }
    }
  }

  getGroupIcon(group: string): string {
    const icons: Record<string, string> = {
      'lights': 'lightbulb',
      'sounds': 'volume_up',
      'other': 'more_horiz'
    };
    return icons[group] || 'settings';
  }

  getSafeHtml(svgCode: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(svgCode);
  }

  selectTurnoutType(typeId: string): void {
    this.selectedTurnoutType = typeId;
  }

  private defaultAspects(type: '3-aspect' | '2-aspect'): SignalAspect[] {
    if (type === '3-aspect') {
      return [
        { name: 'Red', vgpioAddress: 0, reverse: false },
        { name: 'Yellow', vgpioAddress: 0, reverse: false },
        { name: 'Green', vgpioAddress: 0, reverse: false }
      ];
    }
    return [
      { name: 'Red', vgpioAddress: 0, reverse: false },
      { name: 'Green', vgpioAddress: 0, reverse: false }
    ];
  }

  onTypeChange(newType: 'train' | 'switch' | 'light_signal'): void {
    if (newType === 'light_signal' && this.signalAspects.length === 0) {
      this.signalAspects = this.defaultAspects(this.signalType);
    }
  }

  onSignalTypeChange(type: '3-aspect' | '2-aspect'): void {
    this.signalAspects = this.defaultAspects(type);
  }

  getAspectColor(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('red')) return '#e53935';
    if (n.includes('yellow') || n.includes('amber')) return '#fdd835';
    if (n.includes('green')) return '#43a047';
    return '#757575';
  }

  isValid(): boolean {
    if (this.type === 'light_signal') {
      return this.name.trim().length > 0;
    }
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
      output: this.type === 'switch' ? this.output : undefined,
      output2: this.type === 'switch' ? this.output2 : undefined,
      turnoutType: this.type === 'switch' ? this.selectedTurnoutType : undefined,
      functions: this.type === 'train' ? this.functions : undefined,
      imageUrl: this.type === 'train' ? this.imageUrl : undefined,
      signalType: this.type === 'light_signal' ? this.signalType : undefined,
      signalAspects: this.type === 'light_signal' ? this.signalAspects : undefined,
      signalState: this.type === 'light_signal' ? -1 : undefined
    };

    this.dialogRef.close(device);
  }
}
