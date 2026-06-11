import * as fs from 'fs';
import * as path from 'path';

// Persist runtime data in a stable, run-mode-independent location so settings
// survive rebuilds and switching between `npm run dev` and the built server.
// Override with the DATA_DIR env var; otherwise use ./data under the process
// working directory (the dir you launch the server from).
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), 'data');

// Legacy locations used before DATA_DIR was stabilized. On first run we migrate
// any existing files from here so saved settings aren't lost. Ordered by
// preference: the source data dir (the real saved config) before the
// build-output copy.
const LEGACY_DATA_DIRS = [
  path.join(__dirname, '..', '..', 'src', 'data'),
  path.join(__dirname, '..', 'data')
];

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
    if (fs.existsSync(filePath)) return;

    // Migrate from a legacy location if available, else seed defaults.
    const legacy = LEGACY_DATA_DIRS
      .map(dir => path.join(dir, name))
      .find(p => p !== filePath && fs.existsSync(p));
    if (legacy) {
      fs.copyFileSync(legacy, filePath);
      console.log(`Migrated ${name} from ${legacy} to ${filePath}`);
    } else {
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

// Generic state files (e.g. scheduler fired-guard) stored beside the data files.
export function readDataFile<T>(filename: string, fallback: T): T {
  try {
    return readJsonFile<T>(filename);
  } catch {
    return fallback;
  }
}

export function writeDataFile<T>(filename: string, data: T): void {
  writeJsonFile(filename, data);
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
  /** Offset from the schedule start time, "HH:MM:SS". */
  offset: string;
  deviceId: string;
  action: 'start' | 'stop' | 'speed' | 'function' | 'reset';
  params?: {
    speed?: number;
    direction?: 'forward' | 'reverse';
    functionId?: number;
    functionState?: boolean;
    momentary?: boolean;
    duration?: number;
  };
}

export interface WeeklySchedule {
  id: string;
  name: string;
  enabled: boolean;
  /** Wall-clock time the program starts, "HH:MM:SS". Item offsets are relative to this. */
  startTime: string;
  days: ('mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun')[];
  items: ScheduleItem[];
  /** When true, all devices used by the program are reset after the last item. */
  resetAtEnd?: boolean;
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
    disableScreenOff?: boolean;
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

function timeToSeconds(t: string): number {
  const [h = 0, m = 0, s = 0] = t.split(':').map(Number);
  return h * 3600 + m * 60 + s;
}

function secondsToTime(total: number): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

// Legacy schedules stored an absolute wall-clock `time` per item and no
// startTime. Convert on read: startTime = earliest item time, each item gets
// an `offset` relative to it. Persist the converted form once.
function migrateSchedules(schedules: any[]): { schedules: WeeklySchedule[]; changed: boolean } {
  let changed = false;
  const migrated = schedules.map(schedule => {
    if (schedule.startTime && schedule.items.every((i: any) => i.offset !== undefined)) {
      return schedule as WeeklySchedule;
    }
    changed = true;
    const itemTimes = schedule.items.map((i: any) => timeToSeconds(i.offset ?? i.time ?? '00:00:00'));
    const startSeconds = schedule.startTime
      ? timeToSeconds(schedule.startTime)
      : (itemTimes.length ? Math.min(...itemTimes) : 0);
    return {
      ...schedule,
      startTime: schedule.startTime || secondsToTime(startSeconds),
      items: schedule.items.map((item: any, idx: number) => {
        const { time, ...rest } = item;
        return {
          ...rest,
          offset: item.offset ?? secondsToTime(Math.max(itemTimes[idx] - startSeconds, 0))
        };
      })
    } as WeeklySchedule;
  });
  return { schedules: migrated, changed };
}

export function getSchedules(): WeeklySchedule[] {
  const raw = readJsonFile<any[]>('schedules.json');
  const { schedules, changed } = migrateSchedules(raw);
  if (changed) {
    writeJsonFile('schedules.json', schedules);
    console.log('Migrated schedules to startTime + relative offsets');
  }
  return schedules;
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
