import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Display backlight control (kiosk power saving).
 *
 * Writes the panel brightness sysfs attribute so the frontend can blank the
 * screen after an idle timeout and restore it on touch. On the Raspberry Pi DSI
 * panel this is /sys/class/backlight/10-0045/brightness (0 = off, max = full).
 * The path/max are overridable via BACKLIGHT_PATH / BACKLIGHT_MAX env vars.
 *
 * In Docker the brightness file must be bind-mounted into the container (see
 * docker-compose.yml); the container runs as root so it can write it.
 */
const router = Router();

const BRIGHTNESS_PATH = process.env.BACKLIGHT_PATH || '/sys/class/backlight/10-0045/brightness';
const MAX_FROM_ENV = process.env.BACKLIGHT_MAX ? parseInt(process.env.BACKLIGHT_MAX, 10) : undefined;

function readMax(): number {
    if (MAX_FROM_ENV && MAX_FROM_ENV > 0) return MAX_FROM_ENV;
    try {
        const maxPath = path.join(path.dirname(BRIGHTNESS_PATH), 'max_brightness');
        const v = parseInt(fs.readFileSync(maxPath, 'utf8').trim(), 10);
        if (v > 0) return v;
    } catch {
        /* fall through */
    }
    return 255;
}

function readBrightness(): number | null {
    try {
        return parseInt(fs.readFileSync(BRIGHTNESS_PATH, 'utf8').trim(), 10);
    } catch {
        return null;
    }
}

function writeBrightness(value: number): boolean {
    try {
        fs.writeFileSync(BRIGHTNESS_PATH, String(value));
        return true;
    } catch (err) {
        console.error('display: failed to write brightness', err);
        return false;
    }
}

// GET /api/display - current backlight state / availability
router.get('/', (_req: Request, res: Response) => {
    const max = readMax();
    const brightness = readBrightness();
    res.json({
        success: true,
        data: { available: brightness !== null, brightness, max, path: BRIGHTNESS_PATH }
    });
});

// POST /api/display  body: { on: boolean }  or  { brightness: number }
router.post('/', (req: Request, res: Response) => {
    const max = readMax();
    let target: number;

    if (typeof req.body?.brightness === 'number') {
        target = Math.max(0, Math.min(max, Math.round(req.body.brightness)));
    } else if (typeof req.body?.on === 'boolean') {
        target = req.body.on ? max : 0;
    } else {
        return res.status(400).json({ success: false, error: 'Provide { on: boolean } or { brightness: number }' });
    }

    const ok = writeBrightness(target);
    res.json({ success: ok, data: { brightness: target, max } });
});

export default router;
