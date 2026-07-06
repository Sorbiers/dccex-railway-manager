import { Router, Request, Response } from 'express';
import { dccService } from '../services/dcc.service';
import * as os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const router = Router();
const execFileAsync = promisify(execFile);

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

async function run(command: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync(command, args, { timeout: 2500 });
    return stdout.trim();
  } catch {
    return '';
  }
}

async function getWifiDetails(name: string): Promise<{ ssid?: string; signal?: string }> {
  if (!/^wl|^wlan|^wifi/i.test(name)) {
    return {};
  }

  if (process.platform === 'win32') {
    const output = await run('netsh', ['wlan', 'show', 'interfaces']);
    return {
      ssid: output.match(/^\s*SSID\s*:\s*(.+)$/mi)?.[1]?.trim(),
      signal: output.match(/^\s*Signal\s*:\s*(.+)$/mi)?.[1]?.trim()
    };
  }

  const iw = await run('iw', ['dev', name, 'link']);
  const ssid = iw.match(/SSID:\s*(.+)/)?.[1]?.trim();
  const signal = iw.match(/signal:\s*([-\d.]+\s*dBm)/)?.[1]?.trim();
  if (ssid || signal) {
    return { ssid, signal };
  }

  const iwconfig = await run('iwconfig', [name]);
  return {
    ssid: iwconfig.match(/ESSID:"([^"]+)"/)?.[1],
    signal: iwconfig.match(/Signal level=([-\d]+\s*dBm)/)?.[1]
  };
}

async function getDefaultGateway(): Promise<string | null> {
  if (process.platform === 'win32') {
    const output = await run('route', ['print', '0.0.0.0']);
    return output.match(/^\s*0\.0\.0\.0\s+0\.0\.0\.0\s+(\S+)/m)?.[1] || null;
  }

  const output = await run('ip', ['route', 'show', 'default']);
  return output.match(/default via (\S+)/)?.[1] || null;
}

async function isReachable(host: string | null): Promise<boolean> {
  if (!host) {
    return false;
  }
  const args = process.platform === 'win32'
    ? ['-n', '1', '-w', '1000', host]
    : ['-c', '1', '-W', '1', host];
  return (await run('ping', args)).length > 0;
}

async function getDiskInfo(): Promise<{ total: number; free: number; used: number; freePercent: number } | null> {
  if (process.platform === 'win32') {
    const drive = process.cwd().slice(0, 2);
    const output = await run('wmic', ['logicaldisk', 'where', `DeviceID="${drive}"`, 'get', 'FreeSpace,Size', '/value']);
    const free = Number(output.match(/FreeSpace=(\d+)/)?.[1]);
    const total = Number(output.match(/Size=(\d+)/)?.[1]);
    if (Number.isFinite(free) && Number.isFinite(total) && total > 0) {
      return { total, free, used: total - free, freePercent: Math.round((free / total) * 100) };
    }
    return null;
  }

  const output = await run('df', ['-k', '/']);
  const fields = output.split('\n')[1]?.trim().split(/\s+/);
  if (!fields || fields.length < 5) {
    return null;
  }
  const total = Number(fields[1]) * 1024;
  const used = Number(fields[2]) * 1024;
  const free = Number(fields[3]) * 1024;
  return { total, used, free, freePercent: Math.round((free / total) * 100) };
}

// GET /api/status/info - Kiosk diagnostics for network and host resources
router.get('/info', async (_req: Request, res: Response) => {
  try {
    const interfaces = await Promise.all(
      Object.entries(os.networkInterfaces()).map(async ([name, addresses]) => ({
        name,
        addresses: (addresses || [])
          .filter(addr => !addr.internal)
          .map(addr => ({ family: addr.family, address: addr.address, mac: addr.mac })),
        wifi: await getWifiDetails(name)
      }))
    );
    const gateway = await getDefaultGateway();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const disk = await getDiskInfo();
    const cores = os.cpus().length || 1;

    res.json({
      success: true,
      data: {
        interfaces: interfaces.filter(item => item.addresses.length > 0),
        gateway: {
          address: gateway,
          reachable: await isReachable(gateway)
        },
        cpu: {
          cores,
          loadPercent: Math.round(Math.min(100, (os.loadavg()[0] / cores) * 100))
        },
        memory: {
          total: totalMem,
          free: freeMem,
          used: totalMem - freeMem,
          freePercent: Math.round((freeMem / totalMem) * 100)
        },
        disk
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get system info' });
  }
});

export default router;
