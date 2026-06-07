import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { Device, WeeklySchedule, Settings, ConnectionStatus } from '../models';
import { ApiService } from './api.service';
import { Observable, tap } from 'rxjs';


interface TrainState {
    address: number;
    power: boolean;
    speed: number;
    direction: 'forward' | 'reverse';
    timestamp: number;
}

interface ControllerState {
    model: string;
    maxTrains: number;
    currentMilliAmps: number;
    currentMaxMilliAmps: number;
    mainTrackId: string;
    timestamp: number;
}

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
    readonly lightSignals = computed(() => this._devices().filter(d => d.type === 'light_signal'));

    readonly selectedTrain = computed(() => {
        const id = this._selectedTrainId();
        if (!id) return this.enabledTrains()[0] || null;
        return this.enabledTrains().find(t => t.id === id) || this.enabledTrains()[0] || null;
    });

    private ws: WebSocket | null = null;

    // MAIN track power state
    private _statePowerMAIN = signal<boolean>(false);
    readonly statePowerMAIN = this._statePowerMAIN.asReadonly();

    // Loco states
    private _stateTrains = signal<{ [key: string]: TrainState }>({});
    readonly stateTrains = this._stateTrains.asReadonly();

    // Controller states
    private _stateController = signal<ControllerState>({ model: '', currentMilliAmps: 0, maxTrains: 0, mainTrackId: 'A', timestamp: 0, currentMaxMilliAmps: 2000 });
    readonly stateController = this._stateController.asReadonly();

    constructor() {
        this.restoreSettings();
        effect(() => {
            const settings = this.settings();
            console.log(' ========== settings', settings);
            if (settings) {
                this.initSystem(settings);
            }
        });
        setInterval(() => this.getStatus(), 5000);
    }

    restoreSettings() {
        let _settings: Settings = this._settings() ||
        {
            backend: { host: window.location.hostname, port: 3000 },
            dccex: { host: '192.168.4.1', port: 2560, autoConnect: true },
            ui: { theme: 'system', showAdvancedControls: false }
        };

        if (window.location.hostname === 'localhost') {
            const settings = localStorage.getItem('settings');
            if (settings) {
                const parsedSettings = JSON.parse(settings) as Settings;
                _settings = parsedSettings;
            } else {
                _settings.backend.host = 'localhost';
            }
        }

        this.api.setBaseUrl(`http://${_settings.backend.host}:${_settings.backend.port}/api`);

        this.api.getSettings().subscribe({
            next: (settings) => {
                if (settings) {
                    _settings = settings;
                }
                this._settings.set(_settings);
            },
            error: (err) => {
                console.error('Failed to load settings', err);
            }
        });

    }

    initSystem(settings: Settings): void {
        this.api.setBaseUrl(`http://${settings.backend.host}:${settings.backend.port}/api`);
        this.loadInitialData().subscribe({
            next: (status) => {
                if (status) this._status.set(status);
                this.initWebSocket();
            },
            error: (err) => {
                console.error('Failed to load status', err);
                this._status.set({ backend: false, dccex: false, power: false });

            }
        });
    }

    setSettings(settings: Settings) {
        this._settings.set(settings);
        localStorage.setItem('settings', JSON.stringify(settings));
    }

    initWebSocket(): void {
        const settings = this.settings();
        if (!settings) return;
        try {
            this.ws = new WebSocket(`ws://${settings.backend.host}:${settings.backend.port}/ws`);

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

    private getStatus(): void {
        if (this.status().dccex) {
            this.enabledTrains().forEach((train: Device) => {
                this.sendCommand(`<t ${train.address}>`);
            });
        } else {
            Object.values(this.stateTrains()).forEach((train: TrainState) => {
                train.speed = 0;
            });
        }
    }

    private sendCommand(command: string): void {
        console.log('Sending command:', command, 'to', this.ws?.url);
        //this.ws?.send(command);
        this.api.sendFreeCommand(0, command).subscribe({
            next: (response) => {
                console.log('Command response:', response);
            },
            error: (err) => console.error('Failed to send command', err)
        })
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
                this.handleDccMessage(message.data as string);
                break;
        }
    }

    private handleDccMessage(message: string): void {
        const parts = message.split(' ');
        const command = parts[0];
        const address = parts[1];
        switch (command) {
            // Power state
            case 'p0':
                if (address === 'A' || address === 'MAIN') {
                    this._statePowerMAIN.set(false);
                }
                break;
            case 'p1':
                if (address === 'A' || address === 'MAIN') {
                    this._statePowerMAIN.set(true);
                }
                break;
            // Controller state
            case 'c':
                {
                    const controller = this._stateController();
                    controller.currentMilliAmps = parseInt(parts[2]);
                    controller.currentMaxMilliAmps = parseInt(parts[6]);
                    controller.timestamp = Date.now();
                    this._stateController.set(controller);
                }
                break;
            case '#':
                {
                    const controller = this._stateController();
                    controller.maxTrains = parseInt(parts[1]);
                    this._stateController.set(controller);
                }
                break;
            case 'iDCC-EX':
                {
                    const controller = this._stateController();
                    controller.model = message;
                    this._stateController.set(controller);
                }
                break;
            // Loco state
            case 'l':
                console.log(' ========== l', parts);
                const locoAddress = parseInt(parts[1]);
                const speedByte = parseInt(parts[3]);
                var speed: number = 0;
                var direction: 'forward' | 'reverse' = 'forward';
                if ([0, 1, 128, 129].includes(speedByte)) {
                    speed = 0;
                    if ([0,1].includes(speedByte)) {
                        direction = 'reverse';
                    } else {
                        direction = 'forward';
                    }
                } else {
                    if (speedByte < 128) {
                        speed = speedByte - 1;
                        direction = 'reverse';
                    } else {
                        speed = speedByte - 128;
                        direction = 'forward';
                    }
                }
                console.log(' ========== locoAddress', locoAddress, speed, direction);
                const states = this._stateTrains();
                const timestamp = Date.now();
                if (!states[locoAddress]) {
                    states[locoAddress] = { address: locoAddress, power: false, speed: 0, direction: 'forward', timestamp };
                }
                states[locoAddress] = { address: locoAddress, power: true, speed, direction, timestamp };
                this._stateTrains.set(states);
                console.log(' ========== stateTrains', this.stateTrains());
                break;

        }
    }

    private loadInitialData(): Observable<ConnectionStatus | null> {
        this._loading.set(true);

        this.api.getDevices().subscribe({
            next: (devices) => this._devices.set(devices),
            error: (err) => console.error('Failed to load devices', err)
        });

        this.api.getSchedules().subscribe({
            next: (schedules) => this._schedules.set(schedules),
            error: (err) => console.error('Failed to load schedules', err)
        });

        // this.api.getSettings().subscribe({
        //     next: (settings) => this._settings.set(settings),
        //     error: (err) => console.error('Failed to load settings', err)
        // });

        return this.api.getStatus().pipe(
            tap((status) => {
                if (status) this._status.set(status);
                this._loading.set(false);
            }));
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
