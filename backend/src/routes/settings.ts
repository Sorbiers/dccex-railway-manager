import { Router, Request, Response } from 'express';
import * as dataService from '../services/data.service';
import { dccService } from '../services/dcc.service';

const router = Router();

// GET /api/settings - Get settings
router.get('/', (_req: Request, res: Response) => {
  try {
    const settings = dataService.getSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get settings' });
  }
});

// PUT /api/settings - Update settings
router.put('/', (req: Request, res: Response) => {
  try {
    const updated = dataService.updateSettings(req.body);

    // Apply DCC-EX connection settings if changed
    if (req.body.dccex) {
      dccService.configure(updated.dccex.host, updated.dccex.port);
      if (updated.dccex.autoConnect) {
        dccService.connect();
      }
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
});

export default router;
