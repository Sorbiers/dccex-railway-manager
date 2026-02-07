export interface DccFunction {
  id: number;
  name: string;
  icon?: string;
  momentary?: boolean;
  group?: 'lights' | 'sounds' | 'other';
}

export interface Device {
  id: string;
  name: string;
  type: 'train' | 'switch';
  address: number;
  enabled: boolean;
  speed?: number;
  direction?: 'forward' | 'reverse';
  functions?: DccFunction[];
  activeFunctions?: number[];
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

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ConnectionStatus {
  backend: boolean;
  dccex: boolean;
  power: boolean;
}

export interface DccCommand {
  type: 'throttle' | 'function' | 'power' | 'emergency' | 'turnout' | 'direction';
  address?: number;
  value?: number;
  state?: boolean;
}
