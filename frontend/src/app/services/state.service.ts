import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { Device, WeeklySchedule, Settings, ConnectionStatus, ScheduleRunStatus } from '../models';
import { ApiService } from './api.service';
import { APP_CONFIG, BACKEND_CONNECTION, persistBackendConnection } from './app-config';


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

    // Back-end connection resolved before bootstrap (appconfig.json + storage + URL).
    private backend = inject(BACKEND_CONNECTION);
    private appConfig = inject(APP_CONFIG);

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

    // Live progress of the running schedule program (null when idle)
    private _scheduleRun = signal<ScheduleRunStatus | null>(null);
    readonly scheduleRun = this._scheduleRun.asReadonly();

    // Emergency-stop latch (set on e-stop, cleared by any throttle input)
    private _estop = signal<boolean>(false);
    readonly estop = this._estop.asReadonly();
    setEstop(value: boolean): void {
        this._estop.set(value);
    }

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
        // Poll every 20s (was 5s) to cut idle CPU/radio wakeups on the Pi battery.
        setInterval(() => this.getStatus(), 20000);
    }

    restoreSettings() {
        // The back-end host/port were resolved before bootstrap via the lookup
        // sequence (session storage -> local storage -> appconfig.json -> URL
        // -> defaults). We seed a minimal settings object using that resolved
        // connection so the effect below can start the WebSocket immediately;
        // every other param is (re)loaded from the back-end on connection.
        this.api.setBaseUrl(`http://${this.backend.host}:${this.backend.port}/api`);

        this._settings.set(this._settings() || {
            backend: { host: this.backend.host, port: this.backend.port },
            dccex: { host: '192.168.4.1', port: 2560, autoConnect: true },
            ui: { theme: 'system', showAdvancedControls: false }
        });
    }

    initSystem(settings: Settings): void {
        // The resolved connection is the source of truth for where the back-end
        // is; the WebSocket drives connectivity (with its own retry loop) and we
        // load all back-end data each time it (re)connects.
        this.api.setBaseUrl(`http://${settings.backend.host}:${settings.backend.port}/api`);
        this.initWebSocket();
    }

    /**
     * (Re)load everything the back-end owns. Called on every (re)connection so
     * the UI recovers after the back-end starts late or restarts. The resolved
     * connection always wins over whatever host/port the back-end reports.
     */
    private loadFromBackend(): void {
        this._loading.set(true);

        this.api.getSettings().subscribe({
            next: (settings) => {
                if (settings) {
                    settings.backend = { host: this.backend.host, port: this.backend.port };
                    this._settings.set(settings);
                }
            },
            error: (err) => console.error('Failed to load settings', err)
        });

        this.api.getDevices().subscribe({
            next: (devices) => this._devices.set(devices),
            error: (err) => console.error('Failed to load devices', err)
        });

        this.api.getSchedules().subscribe({
            next: (schedules) => this._schedules.set(schedules),
            error: (err) => console.error('Failed to load schedules', err)
        });

        this.api.getStatus().subscribe({
            next: (status) => {
                if (status) this._status.set({ ...status, backend: true });
                this._loading.set(false);
            },
            error: () => this._loading.set(false)
        });
    }

    setSettings(settings: Settings) {
        this._settings.set(settings);
        localStorage.setItem('settings', JSON.stringify(settings));
        // Keep the dedicated back-end connection cache in sync with an explicit
        // host/port change so it takes precedence on the next load.
        if (settings.backend?.host) {
            persistBackendConnection(
                { host: settings.backend.host, port: settings.backend.port },
                this.appConfig
            );
        }
    }

    initWebSocket(): void {
        const settings = this.settings();
        if (!settings) return;

        // Don't open a second socket if one is already connecting/open. initSystem
        // can fire repeatedly (the settings effect re-runs whenever back-end data
        // loads); without this guard each run would spawn a parallel socket and a
        // parallel reconnect loop.
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return;
        }

        try {
            const url = `ws://${settings.backend.host}:${settings.backend.port}/ws`;
            this.ws = new WebSocket(url);

            this.ws.onopen = () => {
                console.log('WebSocket connected to', url);
                this._status.update(s => ({ ...s, backend: true }));
                // Cache the working connection so future loads find it first
                // (steps 1 & 2 of the lookup), respecting the appconfig flags.
                persistBackendConnection(this.backend, this.appConfig);
                // Connection (re)established — load everything from the back-end.
                this.loadFromBackend();
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
            case 'schedule-run': {
                const run = message.data as ScheduleRunStatus | null;
                this._scheduleRun.set(run && !run.completed ? run : null);
                // Devices' speed/functions changed on the backend during the run
                if (run) this.refreshDevices();
                break;
            }
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
