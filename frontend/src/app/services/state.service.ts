import { Injectable, inject, signal, computed } from '@angular/core';
import { Device, WeeklySchedule, Settings, ConnectionStatus } from '../models';
import { ApiService } from './api.service';

@Injectable({
  providedIn: 'root'
})
export class StateService {
  private api = inject(ApiService);

  // Signals for state management
  private _devices = signal<Device[]>([]);
  private _schedules = signal<WeeklySchedule[]>([]);
  private _settings = signal<Settings | null>(null);
  private _status = signal<ConnectionStatus>({ backend: false, dccex: false, power: false });
  private _loading = signal<boolean>(false);
  private _selectedTrainId = signal<string | null>(null);

  // Public readonly signals
  readonly devices = this._devices.asReadonly();
  readonly schedules = this._schedules.asReadonly();
  readonly settings = this._settings.asReadonly();
  readonly status = this._status.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly selectedTrainId = this._selectedTrainId.asReadonly();

  // Computed signals
  readonly trains = computed(() => this._devices().filter(d => d.type === 'train'));
  readonly enabledTrains = computed(() => this.trains().filter(d => d.enabled));
  readonly switches = computed(() => this._devices().filter(d => d.type === 'switch'));

  readonly selectedTrain = computed(() => {
    const id = this._selectedTrainId();
    if (!id) return this.enabledTrains()[0] || null;
    return this.enabledTrains().find(t => t.id === id) || this.enabledTrains()[0] || null;
  });

  private ws: WebSocket | null = null;

  constructor() {
    this.initWebSocket();
    this.loadInitialData();
  }

  private initWebSocket(): void {
    try {
      this.ws = new WebSocket(`ws://${window.location.hostname}:3000/ws`);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this._status.update(s => ({ ...s, backend: true }));
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleWebSocketMessage(message);
        } catch (e) {
          console.error('Failed to parse WebSocket message', e);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this._status.update(s => ({ ...s, backend: false, dccex: false }));
        // Attempt to reconnect after 5 seconds
        setTimeout(() => this.initWebSocket(), 5000);
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error', error);
      };
    } catch (e) {
      console.error('Failed to connect WebSocket', e);
      setTimeout(() => this.initWebSocket(), 5000);
    }
  }

  private handleWebSocketMessage(message: { type: string; data: unknown }): void {
    switch (message.type) {
      case 'status':
        this._status.set(message.data as ConnectionStatus);
        break;
      case 'power':
        this._status.update(s => ({ ...s, power: message.data as boolean }));
        break;
      case 'dcc-message':
        // Handle DCC-EX responses if needed
        console.log('DCC-EX message:', message.data);
        break;
    }
  }

  private loadInitialData(): void {
    this._loading.set(true);

    this.api.getDevices().subscribe({
      next: (devices) => this._devices.set(devices),
      error: (err) => console.error('Failed to load devices', err)
    });

    this.api.getSchedules().subscribe({
      next: (schedules) => this._schedules.set(schedules),
      error: (err) => console.error('Failed to load schedules', err)
    });

    this.api.getSettings().subscribe({
      next: (settings) => this._settings.set(settings),
      error: (err) => console.error('Failed to load settings', err)
    });

    this.api.getStatus().subscribe({
      next: (status) => {
        if (status) this._status.set(status);
        this._loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load status', err);
        this._loading.set(false);
      }
    });
  }

  selectTrain(id: string): void {
    this._selectedTrainId.set(id);
  }

  refreshDevices(): void {
    this.api.getDevices().subscribe({
      next: (devices) => this._devices.set(devices),
      error: (err) => console.error('Failed to refresh devices', err)
    });
  }

  refreshSchedules(): void {
    this.api.getSchedules().subscribe({
      next: (schedules) => this._schedules.set(schedules),
      error: (err) => console.error('Failed to refresh schedules', err)
    });
  }

  updateDeviceLocally(id: string, updates: Partial<Device>): void {
    this._devices.update(devices =>
      devices.map(d => d.id === id ? { ...d, ...updates } : d)
    );
  }
}
