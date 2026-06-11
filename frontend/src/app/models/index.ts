export interface DccFunction {
  id: number;
  name: string;
  icon?: string;
  momentary?: boolean;
  group?: 'quick' | 'lights' | 'sounds' | 'other';
}

export interface SignalAspect {
  name: string;
  vgpioAddress: number;
  reverse: boolean;
}

export interface TurnoutType {
  id: string;
  name: string;
  description: string;
  svgIconCode: string;
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
  imageUrl?: string;
  output?: number;
  output2?: number;
  turnoutType?: string;
  turnoutState?: number;
  signalType?: '3-aspect' | '2-aspect';
  signalAspects?: SignalAspect[];
  signalState?: number;
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

/** Live progress of a running schedule program (simulation, manual run, or scheduled). */
export interface ScheduleRunStatus {
  scheduleId: string;
  scheduleName: string;
  mode: 'simulation' | 'manual' | 'scheduled';
  currentIndex: number;
  totalItems: number;
  isRunning: boolean;
  completed: boolean;
  speedFactor: number;
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
    /** Kiosk: when true, never auto-blank the screen on idle. */
    disableScreenOff?: boolean;
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
  type: 'throttle' | 'function' | 'power' | 'emergency' | 'turnout' | 'direction' | 'signal';
  address?: number;
  value?: number;
  state?: boolean;
  deviceId?: string;
}
