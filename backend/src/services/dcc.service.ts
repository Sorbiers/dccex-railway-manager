import * as net from 'net';
import { EventEmitter } from 'events';

export interface DccStatus {
  connected: boolean;
  power: boolean;
  lastError?: string;
}

export class DccService extends EventEmitter {
  private socket: net.Socket | null = null;
  private host: string = '192.168.4.1';
  private port: number = 2560;
  private status: DccStatus = {
    connected: false,
    power: false
  };
  private reconnectTimer: NodeJS.Timeout | null = null;
  private buffer: string = '';

  constructor() {
    super();
  }

  configure(host: string, port: number): void {
    this.host = host;
    this.port = port;
  }

  connect(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.socket) {
        this.disconnect();
      }

      this.socket = new net.Socket();

      this.socket.on('connect', () => {
        console.log(`Connected to DCC-EX at ${this.host}:${this.port}`);
        this.status.connected = true;
        this.status.lastError = undefined;
        this.emit('connected');
        this.emit('status', this.status);

        // Request current status
        this.sendCommand('<s>');
        resolve(true);
      });

      this.socket.on('data', (data) => {
        this.handleData(data.toString());
      });

      this.socket.on('error', (err) => {
        console.error('DCC-EX connection error:', err.message);
        this.status.connected = false;
        this.status.lastError = err.message;
        this.emit('error', err);
        this.emit('status', this.status);
        resolve(false);
      });

      this.socket.on('close', () => {
        console.log('DCC-EX connection closed');
        this.status.connected = false;
        this.emit('disconnected');
        this.emit('status', this.status);
        this.scheduleReconnect();
      });

      this.socket.connect(this.port, this.host);
    });
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }

    this.status.connected = false;
    this.emit('status', this.status);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      console.log('Attempting to reconnect to DCC-EX...');
      this.connect();
    }, 5000);
  }

  private handleData(data: string): void {
    this.buffer += data;

    // Process complete messages (enclosed in < >)
    let startIdx = this.buffer.indexOf('<');
    let endIdx = this.buffer.indexOf('>');

    while (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      const message = this.buffer.substring(startIdx + 1, endIdx);
      this.buffer = this.buffer.substring(endIdx + 1);
      this.parseMessage(message);

      startIdx = this.buffer.indexOf('<');
      endIdx = this.buffer.indexOf('>');
    }
  }

  private parseMessage(message: string): void {
    console.log('DCC-EX response:', message);
    this.emit('message', message);

    // Parse power status
    if (message.startsWith('p')) {
      this.status.power = message.charAt(1) === '1';
      this.emit('power', this.status.power);
      this.emit('status', this.status);
    }

    // Parse other responses as needed
    if (message.startsWith('iDCC-EX')) {
      this.emit('version', message);
    }
  }

  sendCommand(command: string): boolean {
    if (!this.socket || !this.status.connected) {
      console.warn('Cannot send command: not connected');
      return false;
    }

    // Ensure command is wrapped in angle brackets
    const formattedCommand = command.startsWith('<') ? command : `<${command}>`;
    console.log('Sending DCC command:', formattedCommand);
    this.socket.write(formattedCommand);
    return true;
  }

  sendCommandWithResponse(command: string, timeout: number = 2000): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.status.connected) {
        reject(new Error('Not connected to DCC-EX'));
        return;
      }

      const responseHandler = (message: string) => {
        clearTimeout(timer);
        this.removeListener('message', responseHandler);
        resolve(message);
      };

      const timer = setTimeout(() => {
        this.removeListener('message', responseHandler);
        reject(new Error('Command timeout - no response received'));
      }, timeout);

      this.once('message', responseHandler);

      // Ensure command is wrapped in angle brackets
      const formattedCommand = command.startsWith('<') ? command : `<${command}>`;
      console.log('Sending DCC command with response:', formattedCommand);
      this.socket.write(formattedCommand);
    });
  }

  // Throttle control: <t REGISTER CAB SPEED DIRECTION>
  setThrottle(address: number, speed: number, direction: 'forward' | 'reverse'): boolean {
    const dir = direction === 'forward' ? 1 : 0;
    const clampedSpeed = Math.max(0, Math.min(126, Math.round(speed)));
    return this.sendCommand(`<t 1 ${address} ${clampedSpeed} ${dir}>`);
  }

  // Function control: <F CAB FUNCTION STATE>
  setFunction(address: number, functionId: number, state: boolean): boolean {
    const stateVal = state ? 1 : 0;
    return this.sendCommand(`<F ${address} ${functionId} ${stateVal}>`);
  }

  // Power control: <0> off, <1> on
  setPower(on: boolean): boolean {
    return this.sendCommand(on ? '<1>' : '<0>');
  }

  // Emergency stop: <!>
  emergencyStop(): boolean {
    return this.sendCommand('<!>');
  }

  // Turnout/Switch control: <T ID THROW> where THROW is 0 (closed) or 1 (thrown)
  setTurnout(id: number, thrown: boolean): boolean {
    return this.sendCommand(`<T ${id} ${thrown ? 1 : 0}>`);
  }

  // Virtual GPIO pin control: <z pin> to set HIGH, <z -pin> to set LOW
  setVirtualPin(pin: number, active: boolean): boolean {
    return this.sendCommand(active ? `<z ${pin}>` : `<z -${pin}>`);
  }

  getStatus(): DccStatus {
    return { ...this.status };
  }

  isConnected(): boolean {
    return this.status.connected;
  }
}

// Singleton instance
export const dccService = new DccService();
