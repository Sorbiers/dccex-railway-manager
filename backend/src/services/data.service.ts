import * as fs from 'fs';
import * as path from 'path';

const DATA_DIR = path.join(__dirname, '..', 'data');

// Ensure data directory exists
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`Created data directory: ${DATA_DIR}`);
  }
}

// Initialize data files with defaults if they don't exist
function initializeDataFiles(): void {
  ensureDataDir();

  const defaultDevices: Device[] = [];
  const defaultSchedules: WeeklySchedule[] = [];
  const defaultSettings: Settings = {
    backend: {
      host: "localhost",
      port: 3000
    },
    dccex: {
      host: "192.168.4.1",
      port: 2560,
      autoConnect: false
    },
    ui: {
      theme: "system",
      showAdvancedControls: false
    }
  };

  const files = [
    { name: 'devices.json', defaultData: defaultDevices },
    { name: 'schedules.json', defaultData: defaultSchedules },
    { name: 'settings.json', defaultData: defaultSettings }
  ];

  files.forEach(({ name, defaultData }) => {
    const filePath = path.join(DATA_DIR, name);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), 'utf-8');
      console.log(`Created ${name} with default data`);
    }
  });
}

// Initialize on module load
initializeDataFiles();

function readJsonFile<T>(filename: string): T {
  const filePath = path.join(DATA_DIR, filename);
  const data = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(data) as T;
}

function writeJsonFile<T>(filename: string, data: T): void {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export interface SignalAspect {
  name: string;
  vgpioAddress: number;
  reverse: boolean;
}

export interface Device {
  id: string;
  name: string;
  type: 'train' | 'switch' | 'light_signal';
  address: number;
  enabled: boolean;
  speed?: number;
  direction?: 'forward' | 'reverse';
  functions?: DccFunction[];
  activeFunctions?: number[];
  output?: number;
  output2?: number;
  turnoutType?: string;
  turnoutState?: number;
  signalType?: '3-aspect' | '2-aspect';
  signalAspects?: SignalAspect[];
  signalState?: number;
}

export interface DccFunction {
  id: number;
  name: string;
  icon?: string;
  momentary?: boolean;
  group?: 'lights' | 'sounds' | 'other';
}

export interface ScheduleItem {
  id: string;
  time: string;
  deviceId: string;
  action: 'start' | 'stop' | 'speed' | 'function';
  params?: {
    speed?: number;
    direction?: 'forward' | 'reverse';
    functionId?: number;
    functionState?: boolean;
  };
}

export interface WeeklySchedule {
  id: string;
  name: string;
  enabled: boolean;
  days: ('mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun')[];
  items: ScheduleItem[];
}

export interface Settings {
  backend: {
    host: string;
    port: number;
  };
  dccex: {
    host: string;
    port: number;
    autoConnect: boolean;
  };
  ui: {
    theme: 'light' | 'dark' | 'system';
    showAdvancedControls: boolean;
  };
}

// Devices
export function getDevices(): Device[] {
  return readJsonFile<Device[]>('devices.json');
}

export function getDevice(id: string): Device | undefined {
  const devices = getDevices();
  return devices.find(d => d.id === id);
}

export function createDevice(device: Device): Device {
  const devices = getDevices();
  devices.push(device);
  writeJsonFile('devices.json', devices);
  return device;
}

export function updateDevice(id: string, updates: Partial<Device>): Device | undefined {
  const devices = getDevices();
  const index = devices.findIndex(d => d.id === id);
  if (index === -1) return undefined;

  devices[index] = { ...devices[index], ...updates, id };
  writeJsonFile('devices.json', devices);
  return devices[index];
}

export function deleteDevice(id: string): boolean {
  const devices = getDevices();
  const index = devices.findIndex(d => d.id === id);
  if (index === -1) return false;

  devices.splice(index, 1);
  writeJsonFile('devices.json', devices);
  return true;
}

// Schedules
export function getSchedules(): WeeklySchedule[] {
  return readJsonFile<WeeklySchedule[]>('schedules.json');
}

export function getSchedule(id: string): WeeklySchedule | undefined {
  const schedules = getSchedules();
  return schedules.find(s => s.id === id);
}

export function createSchedule(schedule: WeeklySchedule): WeeklySchedule {
  const schedules = getSchedules();
  schedules.push(schedule);
  writeJsonFile('schedules.json', schedules);
  return schedule;
}

export function updateSchedule(id: string, updates: Partial<WeeklySchedule>): WeeklySchedule | undefined {
  const schedules = getSchedules();
  const index = schedules.findIndex(s => s.id === id);
  if (index === -1) return undefined;

  schedules[index] = { ...schedules[index], ...updates, id };
  writeJsonFile('schedules.json', schedules);
  return schedules[index];
}

export function deleteSchedule(id: string): boolean {
  const schedules = getSchedules();
  const index = schedules.findIndex(s => s.id === id);
  if (index === -1) return false;

  schedules.splice(index, 1);
  writeJsonFile('schedules.json', schedules);
  return true;
}

// Settings
export function getSettings(): Settings {
  return readJsonFile<Settings>('settings.json');
}

export function updateSettings(updates: Partial<Settings>): Settings {
  const settings = getSettings();
  const updated = {
    backend: { ...settings.backend, ...updates.backend },
    dccex: { ...settings.dccex, ...updates.dccex },
    ui: { ...settings.ui, ...updates.ui }
  };
  writeJsonFile('settings.json', updated);
  return updated;
}
