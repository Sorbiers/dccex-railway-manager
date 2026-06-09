import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { StateService } from '../../services/state.service';
import { ApiService } from '../../services/api.service';
import { Settings } from '../../models';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatSelectModule,
    MatSnackBarModule,
    MatDividerModule
  ],
  template: `
    <div class="settings-page">
      <h1>Settings</h1>

      <mat-card>
        <mat-card-header>
          <mat-icon mat-card-avatar>dns</mat-icon>
          <mat-card-title>Backend Connection</mat-card-title>
          <mat-card-subtitle>Configure the connection to the backend server</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <div class="form-row">
            <mat-form-field>
              <mat-label>Host</mat-label>
              <input matInput [(ngModel)]="settings.backend.host" >
            </mat-form-field>

            <mat-form-field>
              <mat-label>Port</mat-label>
              <input matInput type="number" [(ngModel)]="settings.backend.port" min="1" max="65535">
            </mat-form-field>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card>
        <mat-card-header>
          <mat-icon mat-card-avatar>train</mat-icon>
          <mat-card-title>DCC-EX Connection</mat-card-title>
          <mat-card-subtitle>Configure the connection to your DCC-EX command station</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <div class="form-row">
            <mat-form-field>
              <mat-label>Host/IP Address</mat-label>
              <input matInput [(ngModel)]="settings.dccex.host" placeholder="192.168.1.100">
            </mat-form-field>

            <mat-form-field>
              <mat-label>Port</mat-label>
              <input matInput type="number" [(ngModel)]="settings.dccex.port" min="1" max="65535">
            </mat-form-field>
          </div>

          <mat-slide-toggle [(ngModel)]="settings.dccex.autoConnect" color="primary">
            Auto-connect on startup
          </mat-slide-toggle>

          <div class="connection-actions">
            <button mat-raised-button color="primary" (click)="connectDcc()" [disabled]="state.status().dccex">
              <mat-icon>power</mat-icon> Connect
            </button>
            <button mat-raised-button (click)="disconnectDcc()" [disabled]="!state.status().dccex">
              <mat-icon>power_off</mat-icon> Disconnect
            </button>

            <span class="connection-status">
              <span class="status-indicator" [class.connected]="state.status().dccex"></span>
              {{ state.status().dccex ? 'Connected' : 'Disconnected' }}
            </span>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card>
        <mat-card-header>
          <mat-icon mat-card-avatar>palette</mat-icon>
          <mat-card-title>User Interface</mat-card-title>
          <mat-card-subtitle>Customize the appearance and behavior</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          <mat-form-field class="form-field-full">
            <mat-label>Theme</mat-label>
            <mat-select [(ngModel)]="settings.ui.theme">
              <mat-option value="light">Light</mat-option>
              <mat-option value="dark">Dark</mat-option>
              <mat-option value="system">System Default</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-slide-toggle [(ngModel)]="settings.ui.showAdvancedControls" color="primary">
            Show advanced controls
          </mat-slide-toggle>

          <mat-slide-toggle [(ngModel)]="settings.ui.disableScreenOff" color="primary" class="toggle-row">
            Disable screen off
            <span class="toggle-hint">Keep the kiosk screen on (no idle auto-blank)</span>
          </mat-slide-toggle>
        </mat-card-content>
      </mat-card>

      <div class="actions">
        <button mat-button (click)="resetSettings()">
          <mat-icon>refresh</mat-icon> Reset to Defaults
        </button>
        <button mat-raised-button color="primary" (click)="saveSettings()">
          <mat-icon>save</mat-icon> Save Settings
        </button>
      </div>
    </div>
  `,
  styles: [`
    .settings-page {
      max-width: 800px;
      margin: 0 auto;

      h1 {
        margin-bottom: 24px;
      }
    }

    mat-card {
      margin-bottom: 16px;

      mat-card-header {
        mat-icon[mat-card-avatar] {
          font-size: 40px;
          width: 40px;
          height: 40px;
          color: #1976d2;
        }
      }

      mat-card-content {
        padding-top: 16px;
      }
    }

    :host-context(.dark-theme) mat-card mat-card-header mat-icon[mat-card-avatar] {
      color: #64b5f6;
    }

    .form-row {
      display: flex;
      gap: 16px;
      margin-bottom: 16px;

      mat-form-field {
        flex: 1;
      }
    }

    .form-field-full {
      width: 100%;
      margin-bottom: 16px;
    }

    .connection-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 16px;

      .connection-status {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 8px;

        .status-indicator {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background-color: #f44336;

          &.connected {
            background-color: #4caf50;
            box-shadow: 0 0 6px #4caf50;
          }
        }
      }
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 24px;
    }

    .toggle-row {
      display: block;
      margin-top: 16px;
    }

    .toggle-hint {
      display: block;
      font-size: 12px;
      opacity: 0.7;
      margin-left: 52px;
    }
  `]
})
export class SettingsComponent implements OnInit {
  state = inject(StateService);
  private api = inject(ApiService);
  private snackBar = inject(MatSnackBar);

  settings: Settings = {
    backend: { host: window.location.hostname, port: 3000 },
    dccex: { host: '192.168.4.1', port: 2560, autoConnect: true },
    ui: { theme: 'system', showAdvancedControls: false, disableScreenOff: false }
  };

  ngOnInit(): void {
    const currentSettings = this.state.settings();
    if (currentSettings) {
      this.settings = JSON.parse(JSON.stringify(currentSettings));
    }
  }

  saveSettings(): void {
    this.state.setSettings(this.settings);
    this.api.updateSettings(this.settings).subscribe({
      next: () => {
        this.snackBar.open('Settings saved successfully', 'Close', { duration: 3000 });
      },
      error: (err) => {
        console.error('Failed to save settings', err);
        this.snackBar.open('Failed to save settings', 'Close', { duration: 3000 });
      }
    });
  }

  resetSettings(): void {
    this.settings = {
      backend: { host: window.location.hostname, port: 3000 },
      dccex: { host: '192.168.4.1', port: 2560, autoConnect: true },
      ui: { theme: 'system', showAdvancedControls: false, disableScreenOff: false }
    };
  }

  connectDcc(): void {
    // First save settings, then connect
    this.api.updateSettings({ dccex: this.settings.dccex }).subscribe({
      next: () => {
        this.api.connectDcc().subscribe({
          next: (success) => {
            if (success) {
              this.snackBar.open('Connected to DCC-EX', 'Close', { duration: 3000 });
            } else {
              this.snackBar.open('Failed to connect to DCC-EX', 'Close', { duration: 3000 });
            }
          },
          error: () => {
            this.snackBar.open('Failed to connect to DCC-EX', 'Close', { duration: 3000 });
          }
        });
      }
    });
  }

  disconnectDcc(): void {
    this.api.disconnectDcc().subscribe({
      next: () => {
        this.snackBar.open('Disconnected from DCC-EX', 'Close', { duration: 3000 });
      },
      error: () => {
        this.snackBar.open('Failed to disconnect', 'Close', { duration: 3000 });
      }
    });
  }
}
