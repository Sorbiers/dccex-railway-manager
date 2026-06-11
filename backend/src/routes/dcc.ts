import { Router, Request, Response } from 'express';
import { dccService } from '../services/dcc.service';
import * as dataService from '../services/data.service';
import { scheduleService } from '../services/schedule.service';

const router = Router();

// POST /api/dcc/command - Send DCC command
router.post('/command', (req: Request, res: Response) => {
  try {
    const { type, address, value, state } = req.body;

    let success = false;

    switch (type) {
      case 'throttle':
        if (address !== undefined && value !== undefined) {
          const device = dataService.getDevices().find(d => d.address === address);
          const direction = device?.direction || 'forward';
          success = dccService.setThrottle(address, value, direction);

          // Update device state
          if (device) {
            dataService.updateDevice(device.id, { speed: value });
          }
        }
        break;

      case 'direction':
        if (address !== undefined) {
          const device = dataService.getDevices().find(d => d.address === address);
          if (device) {
            const newDirection = state ? 'forward' : 'reverse';
            const speed = device.speed || 0;
            success = dccService.setThrottle(address, speed, newDirection);
            dataService.updateDevice(device.id, { direction: newDirection });
          }
        }
        break;

      case 'function':
        if (address !== undefined && value !== undefined && state !== undefined) {
          success = dccService.setFunction(address, value, state);

          // Update device active functions
          const device = dataService.getDevices().find(d => d.address === address);
          if (device) {
            let activeFunctions = device.activeFunctions || [];
            if (state) {
              if (!activeFunctions.includes(value)) {
                activeFunctions = [...activeFunctions, value];
              }
            } else {
              activeFunctions = activeFunctions.filter(f => f !== value);
            }
            dataService.updateDevice(device.id, { activeFunctions });
          }
        }
        break;

      case 'power':
        success = dccService.setPower(state ?? false);
        break;

      case 'emergency':
        // Safety interlock: a running schedule program must not keep driving
        // trains after an emergency stop.
        scheduleService.cancelRun('cancelled by emergency stop');
        success = dccService.emergencyStop();
        // Also set all train speeds to 0
        const trains = dataService.getDevices().filter(d => d.type === 'train');
        for (const train of trains) {
          dataService.updateDevice(train.id, { speed: 0 });
        }
        break;

      case 'turnout':
        if (address !== undefined && state !== undefined) {
          success = dccService.setTurnout(address, state);
        }
        break;

      case 'signal': {
        const { deviceId, value: aspectIndex } = req.body;
        if (deviceId !== undefined && aspectIndex !== undefined) {
          const signalDevice = dataService.getDevices().find(d => d.id === deviceId);
          if (signalDevice && signalDevice.signalAspects) {
            const targetIdx: number = aspectIndex; // -1 = all off
            signalDevice.signalAspects.forEach((aspect, i) => {
              const isActive = i === targetIdx;
              const pinActive = aspect.reverse ? !isActive : isActive;
              dccService.setVirtualPin(aspect.vgpioAddress, pinActive);
            });
            dataService.updateDevice(signalDevice.id, { signalState: targetIdx });
            success = true;
          }
        }
        break;
      }

      default:
        return res.status(400).json({ success: false, error: 'Unknown command type' });
    }

    res.json({ success });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to send DCC command' });
  }
});

// POST /api/dcc/connect - Connect to DCC-EX
router.post('/connect', async (_req: Request, res: Response) => {
  try {
    const settings = dataService.getSettings();
    dccService.configure(settings.dccex.host, settings.dccex.port);
    const connected = await dccService.connect();
    res.json({ success: connected });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to connect to DCC-EX' });
  }
});

// POST /api/dcc/disconnect - Disconnect from DCC-EX
router.post('/disconnect', (_req: Request, res: Response) => {
  try {
    dccService.disconnect();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to disconnect from DCC-EX' });
  }
});

// POST /api/dcc/free-command - Send free-form DCC command
router.post('/free-command', async (req: Request, res: Response) => {
  try {
    const { trainAddress, command } = req.body;

    if (!command || typeof command !== 'string') {
      return res.status(400).json({ success: false, error: 'Command is required' });
    }

    // Send the command and wait for response
    try {
      const response = await dccService.sendCommandWithResponse(command);
      res.json({
        success: true,
        data: response
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Not connected')) {
          return res.status(503).json({
            success: false,
            error: 'Not connected to DCC-EX',
            data: null
          });
        }
        return res.status(500).json({
          success: false,
          error: error.message,
          data: null
        });
      }
      throw error;
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to send free command',
      data: null
    });
  }
});

// POST /api/dcc/execute-schedule-action - Execute a single schedule action
router.post('/execute-schedule-action', (req: Request, res: Response) => {
  try {
    const { deviceId, action, params } = req.body;

    const device = dataService.getDevices().find(d => d.id === deviceId);
    if (!device) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }

    const success = scheduleService.executeAction(device, action, params);
    res.json({ success });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to execute schedule action' });
  }
});

// POST /api/dcc/simulate-schedule - Run a program immediately (simulation)
router.post('/simulate-schedule', (req: Request, res: Response) => {
  try {
    const { scheduleId, items, speedFactor } = req.body;

    if (!scheduleId || !items || !Array.isArray(items)) {
      return res.status(400).json({ success: false, error: 'Schedule ID and items are required' });
    }

    const saved = dataService.getSchedule(scheduleId);
    const started = scheduleService.startRun(
      { id: scheduleId, name: saved?.name || 'Simulation', resetAtEnd: saved?.resetAtEnd },
      items,
      'simulation',
      speedFactor || 1
    );

    if (!started) {
      return res.status(409).json({ success: false, error: 'Another program is already running' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to start simulation' });
  }
});

// POST /api/dcc/run-schedule - Run a saved schedule program now (real-time)
router.post('/run-schedule', (req: Request, res: Response) => {
  try {
    const { scheduleId } = req.body;
    const schedule = dataService.getSchedule(scheduleId);
    if (!schedule) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }
    if (!schedule.items.length) {
      return res.status(400).json({ success: false, error: 'Schedule has no actions' });
    }

    const started = scheduleService.startRun(schedule, schedule.items, 'manual', 1);
    if (!started) {
      return res.status(409).json({ success: false, error: 'Another program is already running' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to run schedule' });
  }
});

// POST /api/dcc/cancel-simulation - Cancel the running program (any mode)
router.post('/cancel-simulation', (_req: Request, res: Response) => {
  try {
    const cancelled = scheduleService.cancelRun('cancelled by user');
    res.json(cancelled ? { success: true } : { success: false, error: 'No program running' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to cancel' });
  }
});

// GET /api/dcc/simulation-status - Get current program run status
router.get('/simulation-status', (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: scheduleService.getStatus() });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get status' });
  }
});

export default router;
