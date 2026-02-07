import { Router, Request, Response } from 'express';
import { dccService } from '../services/dcc.service';

const router = Router();

// GET /api/status - Get connection status
router.get('/', (_req: Request, res: Response) => {
  try {
    const dccStatus = dccService.getStatus();
    res.json({
      success: true,
      data: {
        backend: true,
        dccex: dccStatus.connected,
        power: dccStatus.power
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get status' });
  }
});

export default router;
