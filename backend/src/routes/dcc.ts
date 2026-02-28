import { Router, Request, Response } from 'express';
import { dccService } from '../services/dcc.service';
import * as dataService from '../services/data.service';

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

    let success = false;

    switch (action) {
      case 'start':
        success = dccService.setThrottle(
          device.address,
          params?.speed || 0,
          params?.direction || 'forward'
        );
        if (success) {
          dataService.updateDevice(device.id, {
            speed: params?.speed || 0,
            direction: params?.direction || 'forward'
          });
        }
        break;

      case 'stop':
        success = dccService.setThrottle(device.address, 0, device.direction || 'forward');
        if (success) {
          dataService.updateDevice(device.id, { speed: 0 });
        }
        break;

      case 'speed':
        success = dccService.setThrottle(
          device.address,
          params?.speed || 0,
          device.direction || 'forward'
        );
        if (success) {
          dataService.updateDevice(device.id, { speed: params?.speed || 0 });
        }
        break;

      case 'function':
        if (params?.functionId !== undefined) {
          success = dccService.setFunction(
            device.address,
            params.functionId,
            params.functionState || false
          );

          if (success) {
            let activeFunctions = device.activeFunctions || [];
            if (params.functionState) {
              if (!activeFunctions.includes(params.functionId)) {
                activeFunctions = [...activeFunctions, params.functionId];
              }
            } else {
              activeFunctions = activeFunctions.filter(f => f !== params.functionId);
            }
            dataService.updateDevice(device.id, { activeFunctions });
          }

          // Handle momentary with duration
          if (params.momentary && params.duration) {
            setTimeout(() => {
              dccService.setFunction(device.address, params.functionId, false);
              const activeFunctions = device.activeFunctions?.filter(f => f !== params.functionId) || [];
              dataService.updateDevice(device.id, { activeFunctions });
            }, params.duration * 1000);
          }
        }
        break;

      case 'reset':
        // Stop the train
        success = dccService.setThrottle(device.address, 0, device.direction || 'forward');

        // Reset all functions
        const functions = device.functions || [];
        functions.forEach(fn => {
          dccService.setFunction(device.address, fn.id, false);
        });

        if (success) {
          dataService.updateDevice(device.id, { speed: 0, activeFunctions: [] });
        }
        break;

      default:
        return res.status(400).json({ success: false, error: 'Unknown action type' });
    }

    res.json({ success });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to execute schedule action' });
  }
});

// Schedule simulation state
interface SimulationState {
  scheduleId: string;
  items: any[];
  currentIndex: number;
  isRunning: boolean;
  timer: NodeJS.Timeout | null;
}

let activeSimulation: SimulationState | null = null;

// POST /api/dcc/simulate-schedule - Start schedule simulation
router.post('/simulate-schedule', (req: Request, res: Response) => {
  try {
    const { scheduleId, items } = req.body;

    if (!scheduleId || !items || !Array.isArray(items)) {
      return res.status(400).json({ success: false, error: 'Schedule ID and items are required' });
    }

    // Stop any existing simulation
    if (activeSimulation) {
      if (activeSimulation.timer) {
        clearTimeout(activeSimulation.timer);
      }
      activeSimulation = null;
    }

    // Sort items by time
    const sortedItems = [...items].sort((a, b) => a.time.localeCompare(b.time));

    // Initialize simulation state
    activeSimulation = {
      scheduleId,
      items: sortedItems,
      currentIndex: 0,
      isRunning: true,
      timer: null
    };

    // Start executing
    executeNextSimulationStep();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to start simulation' });
  }
});

// POST /api/dcc/cancel-simulation - Cancel running simulation
router.post('/cancel-simulation', (_req: Request, res: Response) => {
  try {
    if (activeSimulation) {
      // Set isRunning to false first to prevent executeNextSimulationStep from continuing
      activeSimulation.isRunning = false;
      if (activeSimulation.timer) {
        clearTimeout(activeSimulation.timer);
        activeSimulation.timer = null;
      }
      activeSimulation = null;
      console.log('[Simulation] Cancelled by user');
      res.json({ success: true });
    } else {
      res.json({ success: false, error: 'No simulation running' });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to cancel simulation' });
  }
});

// GET /api/dcc/simulation-status - Get current simulation status
router.get('/simulation-status', (_req: Request, res: Response) => {
  try {
    if (activeSimulation) {
      res.json({
        success: true,
        data: {
          scheduleId: activeSimulation.scheduleId,
          currentIndex: activeSimulation.currentIndex,
          totalItems: activeSimulation.items.length,
          isRunning: activeSimulation.isRunning,
          completed: activeSimulation.currentIndex >= activeSimulation.items.length
        }
      });
    } else {
      res.json({
        success: true,
        data: null
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get simulation status' });
  }
});

function executeNextSimulationStep(): void {
  if (!activeSimulation || !activeSimulation.isRunning) {
    return;
  }

  const { items, currentIndex } = activeSimulation;

  if (currentIndex >= items.length) {
    // Simulation complete
    activeSimulation.isRunning = false;
    activeSimulation = null;
    return;
  }

  const currentItem = items[currentIndex];
  console.log(`[Simulation] Executing step ${currentIndex + 1}/${items.length} at ${currentItem.time}`);

  // Execute the action
  const device = dataService.getDevices().find(d => d.id === currentItem.deviceId);
  if (device) {
    executeScheduleActionInternal(device, currentItem.action, currentItem.params);
  }

  // Calculate delay to next step
  let delay = 1500; // Default 1.5 seconds if it's the last item
  if (currentIndex < items.length - 1) {
    const nextItem = items[currentIndex + 1];
    delay = calculateTimeDelta(currentItem.time, nextItem.time);
  }

  console.log(`[Simulation] Waiting ${delay}ms before next step`);

  // Move to next step
  activeSimulation.currentIndex++;

  // Schedule next step
  activeSimulation.timer = setTimeout(() => {
    executeNextSimulationStep();
  }, delay);
}

function calculateTimeDelta(time1: string, time2: string): number {
  const parseTime = (timeStr: string): number => {
    const parts = timeStr.split(':').map(Number);
    const hours = parts[0] || 0;
    const minutes = parts[1] || 0;
    const seconds = parts[2] || 0;
    return hours * 3600 + minutes * 60 + seconds;
  };

  const seconds1 = parseTime(time1);
  const seconds2 = parseTime(time2);
  const deltaSeconds = seconds2 - seconds1;

  // Scale factor: 1000ms per second for real-time simulation
  // Change to lower value for faster simulation (e.g., 100 = 10x faster)
  const scaleFactor = 1000;
  const delay = deltaSeconds * scaleFactor;

  return Math.max(delay, 100); // Minimum 100ms between actions
}

function executeScheduleActionInternal(device: any, action: string, params?: any): void {
  switch (action) {
    case 'start':
      dccService.setThrottle(device.address, params?.speed || 0, params?.direction || 'forward');
      dataService.updateDevice(device.id, {
        speed: params?.speed || 0,
        direction: params?.direction || 'forward'
      });
      break;

    case 'stop':
      dccService.setThrottle(device.address, 0, device.direction || 'forward');
      dataService.updateDevice(device.id, { speed: 0 });
      break;

    case 'speed':
      dccService.setThrottle(device.address, params?.speed || 0, device.direction || 'forward');
      dataService.updateDevice(device.id, { speed: params?.speed || 0 });
      break;

    case 'function':
      if (params?.functionId !== undefined) {
        dccService.setFunction(device.address, params.functionId, params.functionState || false);

        let activeFunctions = device.activeFunctions || [];
        if (params.functionState) {
          if (!activeFunctions.includes(params.functionId)) {
            activeFunctions = [...activeFunctions, params.functionId];
          }
        } else {
          activeFunctions = activeFunctions.filter((f: number) => f !== params.functionId);
        }
        dataService.updateDevice(device.id, { activeFunctions });

        // Handle momentary with duration
        if (params.momentary && params.duration) {
          setTimeout(() => {
            dccService.setFunction(device.address, params.functionId, false);
            const activeFns = device.activeFunctions?.filter((f: number) => f !== params.functionId) || [];
            dataService.updateDevice(device.id, { activeFunctions: activeFns });
          }, params.duration * 1000);
        }
      }
      break;

    case 'reset':
      dccService.setThrottle(device.address, 0, device.direction || 'forward');
      const functions = device.functions || [];
      functions.forEach((fn: any) => {
        dccService.setFunction(device.address, fn.id, false);
      });
      dataService.updateDevice(device.id, { speed: 0, activeFunctions: [] });
      break;
  }
}

export default router;
