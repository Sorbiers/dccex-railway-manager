import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import * as dataService from '../services/data.service';

const router = Router();

// GET /api/schedules - List all schedules
router.get('/', (_req: Request, res: Response) => {
  try {
    const schedules = dataService.getSchedules();
    res.json({ success: true, data: schedules });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get schedules' });
  }
});

// GET /api/schedules/:id - Get single schedule
router.get('/:id', (req: Request, res: Response) => {
  try {
    const schedule = dataService.getSchedule(req.params.id);
    if (!schedule) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }
    res.json({ success: true, data: schedule });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get schedule' });
  }
});

// POST /api/schedules - Create schedule
router.post('/', (req: Request, res: Response) => {
  try {
    const schedule = {
      id: `schedule-${uuidv4().substring(0, 8)}`,
      name: req.body.name,
      enabled: req.body.enabled ?? true,
      days: req.body.days || [],
      items: (req.body.items || []).map((item: any) => ({
        ...item,
        id: item.id || `item-${uuidv4().substring(0, 8)}`
      }))
    };

    const created = dataService.createSchedule(schedule);
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create schedule' });
  }
});

// PUT /api/schedules/:id - Update schedule
router.put('/:id', (req: Request, res: Response) => {
  try {
    const updates = { ...req.body };
    if (updates.items) {
      updates.items = updates.items.map((item: any) => ({
        ...item,
        id: item.id || `item-${uuidv4().substring(0, 8)}`
      }));
    }

    const updated = dataService.updateSchedule(req.params.id, updates);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update schedule' });
  }
});

// DELETE /api/schedules/:id - Delete schedule
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const deleted = dataService.deleteSchedule(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete schedule' });
  }
});

export default router;
