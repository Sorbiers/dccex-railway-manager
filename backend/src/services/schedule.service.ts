import { EventEmitter } from 'events';
import { dccService } from './dcc.service';
import * as dataService from './data.service';
import { Device, ScheduleItem, WeeklySchedule } from './data.service';

export type RunMode = 'simulation' | 'manual' | 'scheduled';

export interface RunStatus {
  scheduleId: string;
  scheduleName: string;
  mode: RunMode;
  currentIndex: number;
  totalItems: number;
  isRunning: boolean;
  completed: boolean;
  speedFactor: number;
}

interface ActiveRun {
  scheduleId: string;
  scheduleName: string;
  mode: RunMode;
  items: ScheduleItem[];
  currentIndex: number;
  isRunning: boolean;
  speedFactor: number;
  resetAtEnd: boolean;
  timer: NodeJS.Timeout | null;
}

const FIRED_STATE_FILE = 'scheduler-state.json';
const TICK_MS = 5000;
// A schedule fires if "now" is within this many seconds past its startTime.
// Must comfortably exceed the tick interval; also bounds the catch-up window
// after a backend restart.
const FIRE_WINDOW_SECONDS = 90;

function timeToSeconds(t: string): number {
  const [h = 0, m = 0, s = 0] = (t || '0:0:0').split(':').map(Number);
  return h * 3600 + m * 60 + s;
}

function localDateKey(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/**
 * Runs schedule programs (sequences of relative-offset actions) and fires
 * enabled schedules automatically at their startTime on active days.
 *
 * Only one program runs at a time, whatever started it (simulation, manual
 * "Run now", or the scheduler) — overlapping programs would fight over the
 * same locos. Emits 'run-update' (RunStatus) on every state change so the
 * server can broadcast progress over WebSocket.
 */
class ScheduleService extends EventEmitter {
  private run: ActiveRun | null = null;
  private tickTimer: NodeJS.Timeout | null = null;
  // scheduleId -> local date last auto-fired, persisted so a restart inside
  // the fire window does not re-run the program.
  private lastFired: Record<string, string> = {};

  startScheduler(): void {
    if (this.tickTimer) return;
    this.lastFired = dataService.readDataFile<Record<string, string>>(FIRED_STATE_FILE, {});
    this.tickTimer = setInterval(() => this.tick(), TICK_MS);
    console.log('[Scheduler] Started (tick every ' + TICK_MS / 1000 + 's)');
  }

  stopScheduler(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  private tick(): void {
    const now = new Date();
    const today = DAY_KEYS[now.getDay()];
    const todayKey = localDateKey(now);
    const nowSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

    let schedules: WeeklySchedule[];
    try {
      schedules = dataService.getSchedules();
    } catch (e) {
      console.error('[Scheduler] Failed to read schedules', e);
      return;
    }

    for (const schedule of schedules) {
      if (!schedule.enabled || !schedule.items.length) continue;
      if (!schedule.days.includes(today)) continue;
      if (this.lastFired[schedule.id] === todayKey) continue;

      const startSeconds = timeToSeconds(schedule.startTime);
      if (nowSeconds >= startSeconds && nowSeconds < startSeconds + FIRE_WINDOW_SECONDS) {
        this.lastFired[schedule.id] = todayKey;
        dataService.writeDataFile(FIRED_STATE_FILE, this.lastFired);

        console.log(`[Scheduler] Firing "${schedule.name}" (${schedule.id}) at ${schedule.startTime}`);
        const started = this.startRun(schedule, schedule.items, 'scheduled', 1);
        if (!started) {
          console.warn(`[Scheduler] Skipped "${schedule.name}" — another program is already running`);
        }
      }
    }
  }

  /**
   * Start a program. Returns false if another program is already running.
   * Delay before item i = offset(i) - offset(i-1), with offset(-1) = 0, so a
   * non-zero first offset is honored relative to the (virtual) start moment.
   * speedFactor > 1 compresses time (simulation fast-forward).
   */
  startRun(
    schedule: Pick<WeeklySchedule, 'id' | 'name' | 'resetAtEnd'>,
    items: ScheduleItem[],
    mode: RunMode,
    speedFactor = 1
  ): boolean {
    if (this.run?.isRunning) return false;

    const sorted = [...items].sort((a, b) =>
      ((a.offset ?? (a as any).time ?? '') as string).localeCompare((b.offset ?? (b as any).time ?? '') as string));

    this.run = {
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      mode,
      items: sorted,
      currentIndex: -1,
      isRunning: true,
      speedFactor: Math.max(speedFactor, 1),
      resetAtEnd: !!schedule.resetAtEnd,
      timer: null
    };
    this.emitUpdate();
    this.scheduleStep();
    return true;
  }

  cancelRun(reason = 'cancelled'): boolean {
    if (!this.run) return false;
    const run = this.run;
    run.isRunning = false;
    if (run.timer) {
      clearTimeout(run.timer);
      run.timer = null;
    }
    console.log(`[Scheduler] Run "${run.scheduleName}" ${reason}`);
    this.run = null;
    this.emit('run-update', null);
    return true;
  }

  getStatus(): RunStatus | null {
    if (!this.run) return null;
    return this.toStatus(this.run);
  }

  private toStatus(run: ActiveRun): RunStatus {
    return {
      scheduleId: run.scheduleId,
      scheduleName: run.scheduleName,
      mode: run.mode,
      currentIndex: run.currentIndex,
      totalItems: run.items.length,
      isRunning: run.isRunning,
      completed: !run.isRunning && run.currentIndex >= run.items.length,
      speedFactor: run.speedFactor
    };
  }

  private emitUpdate(): void {
    this.emit('run-update', this.run ? this.toStatus(this.run) : null);
  }

  /** Wait for the next item's offset delta, then execute it. */
  private scheduleStep(): void {
    const run = this.run;
    if (!run || !run.isRunning) return;

    const nextIndex = run.currentIndex + 1;
    if (nextIndex >= run.items.length) {
      this.finishRun(run);
      return;
    }

    const prevOffset = run.currentIndex >= 0
      ? timeToSeconds(run.items[run.currentIndex].offset ?? (run.items[run.currentIndex] as any).time)
      : 0;
    const nextOffset = timeToSeconds(run.items[nextIndex].offset ?? (run.items[nextIndex] as any).time);
    const delay = Math.max(((nextOffset - prevOffset) * 1000) / run.speedFactor, 100);

    run.timer = setTimeout(() => {
      if (!this.run || !this.run.isRunning) return;
      const item = this.run.items[nextIndex];
      this.run.currentIndex = nextIndex;
      console.log(`[Scheduler] Step ${nextIndex + 1}/${this.run.items.length} (+${item.offset})`);

      const device = dataService.getDevices().find(d => d.id === item.deviceId);
      if (device) {
        this.executeAction(device, item.action, item.params);
      } else {
        console.warn(`[Scheduler] Device ${item.deviceId} not found — skipping step`);
      }

      this.emitUpdate();
      this.scheduleStep();
    }, delay);
  }

  private finishRun(run: ActiveRun): void {
    run.isRunning = false;
    run.currentIndex = run.items.length;

    if (run.resetAtEnd) {
      const deviceIds = [...new Set(run.items.map(i => i.deviceId))];
      console.log(`[Scheduler] Resetting ${deviceIds.length} device(s) at end of "${run.scheduleName}"`);
      for (const id of deviceIds) {
        const device = dataService.getDevices().find(d => d.id === id);
        if (device && device.type === 'train') {
          this.executeAction(device, 'reset');
        }
      }
    }

    console.log(`[Scheduler] Run "${run.scheduleName}" completed`);
    this.emit('run-update', { ...this.toStatus(run), completed: true });
    this.run = null;
  }

  /** Execute one schedule action against a device. Shared by runs and the one-off API. */
  executeAction(device: Device, action: string, params?: ScheduleItem['params']): boolean {
    switch (action) {
      case 'start': {
        const ok = dccService.setThrottle(device.address, params?.speed || 0, params?.direction || 'forward');
        dataService.updateDevice(device.id, {
          speed: params?.speed || 0,
          direction: params?.direction || 'forward'
        });
        return ok;
      }

      case 'stop': {
        const ok = dccService.setThrottle(device.address, 0, device.direction || 'forward');
        dataService.updateDevice(device.id, { speed: 0 });
        return ok;
      }

      case 'speed': {
        const ok = dccService.setThrottle(device.address, params?.speed || 0, device.direction || 'forward');
        dataService.updateDevice(device.id, { speed: params?.speed || 0 });
        return ok;
      }

      case 'function': {
        if (params?.functionId === undefined) return false;
        const ok = dccService.setFunction(device.address, params.functionId, params.functionState || false);

        let activeFunctions = device.activeFunctions || [];
        if (params.functionState) {
          if (!activeFunctions.includes(params.functionId)) {
            activeFunctions = [...activeFunctions, params.functionId];
          }
        } else {
          activeFunctions = activeFunctions.filter((f: number) => f !== params.functionId);
        }
        dataService.updateDevice(device.id, { activeFunctions });

        if (params.momentary && params.duration) {
          const functionId = params.functionId;
          setTimeout(() => {
            dccService.setFunction(device.address, functionId, false);
            const current = dataService.getDevices().find(d => d.id === device.id);
            const activeFns = current?.activeFunctions?.filter((f: number) => f !== functionId) || [];
            dataService.updateDevice(device.id, { activeFunctions: activeFns });
          }, params.duration * 1000);
        }
        return ok;
      }

      case 'reset': {
        const ok = dccService.setThrottle(device.address, 0, device.direction || 'forward');
        (device.functions || []).forEach(fn => {
          dccService.setFunction(device.address, fn.id, false);
        });
        dataService.updateDevice(device.id, { speed: 0, activeFunctions: [] });
        return ok;
      }

      default:
        return false;
    }
  }
}

export const scheduleService = new ScheduleService();
