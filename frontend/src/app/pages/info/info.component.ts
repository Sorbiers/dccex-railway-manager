import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ApiService } from '../../services/api.service';
import { StorageInfo, SystemInfo } from '../../models';

@Component({
  selector: 'app-info',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    MatProgressBarModule
  ],
  template: `
    <div class="info-page">
      <div class="page-header">
        <h1>Info</h1>
        <button mat-stroked-button (click)="load()" [disabled]="loading()">
          <mat-icon>refresh</mat-icon>
          Refresh
        </button>
      </div>

      @if (error()) {
        <mat-card class="error-card">
          <mat-card-content>{{ error() }}</mat-card-content>
        </mat-card>
      }

      @if (info(); as data) {
        <section class="grid">
          <mat-card>
            <mat-card-header>
              <mat-icon mat-card-avatar>router</mat-icon>
              <mat-card-title>Default Gateway</mat-card-title>
              <mat-card-subtitle>{{ data.gateway.address || 'Not detected' }}</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <mat-chip-set>
                <mat-chip [class.ok]="data.gateway.reachable" [class.fail]="!data.gateway.reachable">
                  {{ data.gateway.reachable ? 'Reachable' : 'Unreachable' }}
                </mat-chip>
              </mat-chip-set>
            </mat-card-content>
          </mat-card>

          <mat-card>
            <mat-card-header>
              <mat-icon mat-card-avatar>memory</mat-icon>
              <mat-card-title>CPU</mat-card-title>
              <mat-card-subtitle>{{ data.cpu.cores }} cores</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <div class="meter-row">
                <span>Load</span>
                <strong>{{ data.cpu.loadPercent }}%</strong>
              </div>
              <mat-progress-bar mode="determinate" [value]="data.cpu.loadPercent"></mat-progress-bar>
            </mat-card-content>
          </mat-card>
        </section>

        <section class="grid">
          <mat-card>
            <mat-card-header>
              <mat-icon mat-card-avatar>developer_board</mat-icon>
              <mat-card-title>Memory</mat-card-title>
              <mat-card-subtitle>{{ formatBytes(data.memory.free) }} free of {{ formatBytes(data.memory.total) }}</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <ng-container *ngTemplateOutlet="resourceMeter; context: { item: data.memory }"></ng-container>
            </mat-card-content>
          </mat-card>

          <mat-card>
            <mat-card-header>
              <mat-icon mat-card-avatar>storage</mat-icon>
              <mat-card-title>Disk</mat-card-title>
              <mat-card-subtitle>
                @if (data.disk) {
                  {{ formatBytes(data.disk.free) }} free of {{ formatBytes(data.disk.total) }}
                } @else {
                  Not available
                }
              </mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              @if (data.disk) {
                <ng-container *ngTemplateOutlet="resourceMeter; context: { item: data.disk }"></ng-container>
              }
            </mat-card-content>
          </mat-card>
        </section>

        <mat-card>
          <mat-card-header>
            <mat-icon mat-card-avatar>wifi</mat-icon>
            <mat-card-title>Network Interfaces</mat-card-title>
            <mat-card-subtitle>{{ data.interfaces.length }} active</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="interfaces">
              @for (iface of data.interfaces; track iface.name) {
                <div class="interface-row">
                  <div>
                    <strong>{{ iface.name }}</strong>
                    @if (iface.wifi?.ssid || iface.wifi?.signal) {
                      <span class="wifi-detail">
                        {{ iface.wifi?.ssid || 'WiFi' }}
                        @if (iface.wifi?.signal) {
                          - {{ iface.wifi?.signal }}
                        }
                      </span>
                    }
                  </div>
                  <div class="addresses">
                    @for (addr of iface.addresses; track addr.address) {
                      <span>{{ addr.family }} {{ addr.address }}</span>
                    }
                  </div>
                </div>
              }
            </div>
          </mat-card-content>
        </mat-card>
      }

      <ng-template #resourceMeter let-item="item">
        <div class="meter-row">
          <span>Used {{ formatBytes(item.used) }}</span>
          <strong>{{ usedPercent(item) }}% used</strong>
        </div>
        <mat-progress-bar mode="determinate" [value]="usedPercent(item)"></mat-progress-bar>
        <div class="meter-foot">
          Total {{ formatBytes(item.total) }} &middot; Free {{ formatBytes(item.free) }} ({{ item.freePercent }}%)
        </div>
      </ng-template>
    </div>
  `,
  styles: [`
    .info-page {
      max-width: 920px;
      margin: 0 auto;
      padding-bottom: 16px;
    }

    .page-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 16px;

      h1 {
        margin: 0;
      }
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
      margin-bottom: 16px;
    }

    mat-card {
      margin-bottom: 16px;
    }

    mat-icon[mat-card-avatar] {
      color: #1976d2;
    }

    .meter-row,
    .interface-row {
      display: flex;
      justify-content: space-between;
      gap: 16px;
    }

    .meter-row {
      margin-bottom: 8px;
    }

    .meter-foot {
      margin-top: 8px;
      font-size: 12px;
      opacity: 0.72;
    }

    .interfaces {
      display: grid;
      gap: 12px;
    }

    .interface-row {
      align-items: flex-start;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.12);

      &:last-child {
        border-bottom: 0;
        padding-bottom: 0;
      }
    }

    .wifi-detail,
    .addresses {
      display: block;
      font-size: 12px;
      opacity: 0.72;
    }

    .addresses {
      text-align: right;
    }

    .ok {
      background: #c8e6c9 !important;
    }

    .fail {
      background: #ffcdd2 !important;
    }

    .error-card {
      color: #b3261e;
    }

    :host-context(.dark-theme) {
      mat-icon[mat-card-avatar] {
        color: #64b5f6;
      }

      .interface-row {
        border-bottom-color: rgba(255, 255, 255, 0.12);
      }
    }
  `]
})
export class InfoComponent implements OnInit {
  private api = inject(ApiService);

  info = signal<SystemInfo | null>(null);
  loading = signal(false);
  error = signal('');

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.getSystemInfo().subscribe({
      next: info => {
        this.info.set(info);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Unable to load system information.');
        this.loading.set(false);
      }
    });
  }

  usedPercent(item: StorageInfo): number {
    return Math.max(0, Math.min(100, 100 - item.freePercent));
  }

  formatBytes(value: number): string {
    if (!Number.isFinite(value)) {
      return '0 B';
    }
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = value;
    let unit = 0;
    while (size >= 1024 && unit < units.length - 1) {
      size /= 1024;
      unit++;
    }
    return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
  }
}
