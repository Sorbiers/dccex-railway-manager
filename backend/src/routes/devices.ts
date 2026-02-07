import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as dataService from '../services/data.service';

const router = Router();

// GET /api/devices - List all devices
router.get('/', (_req: Request, res: Response) => {
  try {
    const devices = dataService.getDevices();
    res.json({ success: true, data: devices });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get devices' });
  }
});

// GET /api/devices/:id - Get single device
router.get('/:id', (req: Request, res: Response) => {
  try {
    const device = dataService.getDevice(req.params.id);
    if (!device) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    res.json({ success: true, data: device });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get device' });
  }
});

// POST /api/devices - Create device
router.post('/', (req: Request, res: Response) => {
  try {
    const device = {
      id: `${req.body.type}-${uuidv4().substring(0, 8)}`,
      name: req.body.name,
      type: req.body.type || 'train',
      address: req.body.address,
      enabled: req.body.enabled ?? true,
      speed: req.body.type === 'train' ? 0 : undefined,
      direction: req.body.type === 'train' ? 'forward' as const : undefined,
      functions: req.body.functions || [],
      activeFunctions: []
    };

    const created = dataService.createDevice(device);
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create device' });
  }
});

// PUT /api/devices/:id - Update device
router.put('/:id', (req: Request, res: Response) => {
  try {
    const updated = dataService.updateDevice(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update device' });
  }
});

// DELETE /api/devices/:id - Delete device
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const deleted = dataService.deleteDevice(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete device' });
  }
});

export default router;
