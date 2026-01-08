#!/usr/bin/env node

/**
 * Agentic Commerce POC - Stop All Services
 * Node.js 24+ shutdown script
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = join(__dirname, '.logs');

// Colors for terminal output
const colors = {
  green: '\x1b[0;32m',
  yellow: '\x1b[1;33m',
  reset: '\x1b[0m',
};

const log = {
  success: (msg) => console.log(`${colors.green}${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}${msg}${colors.reset}`),
};

// Services in reverse startup order
const services = ['chat-ui', 'mcp-tools', 'headless-session-manager', 'shop-ui', 'shop-api'];
const ports = [5173, 3001, 3002, 4200, 3000];

/**
 * Check if a process is running
 */
function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Stop a service by PID file
 */
function stopService(name) {
  const pidFile = join(LOG_DIR, `${name}.pid`);

  if (!existsSync(pidFile)) {
    return;
  }

  const pid = parseInt(readFileSync(pidFile, 'utf-8').trim(), 10);

  if (isProcessRunning(pid)) {
    console.log(`  Stopping ${name} (PID: ${pid})...`);

    try {
      process.kill(pid, 'SIGTERM');

      // Wait up to 5 seconds for graceful shutdown
      let count = 0;
      while (isProcessRunning(pid) && count < 50) {
        execSync('sleep 0.1');
        count++;
      }

      // Force kill if still running
      if (isProcessRunning(pid)) {
        console.log(`  Force killing ${name}...`);
        process.kill(pid, 'SIGKILL');
      }
    } catch {
      // Process may have already exited
    }
  } else {
    console.log(`  ${name} not running (stale PID file)`);
  }

  unlinkSync(pidFile);
}

/**
 * Kill processes on a port using lsof
 */
function killPort(port) {
  try {
    const pids = execSync(`lsof -ti :${port} 2>/dev/null`, { encoding: 'utf-8' })
      .trim()
      .split('\n')
      .filter(Boolean);

    for (const pidStr of pids) {
      const pid = parseInt(pidStr, 10);
      if (pid) {
        console.log(`  Killing process on port ${port} (PID: ${pid})...`);
        try {
          process.kill(pid, 'SIGTERM');
        } catch {
          // Process may have already exited
        }
      }
    }
  } catch {
    // No processes on this port
  }
}

/**
 * Main shutdown sequence
 */
function main() {
  log.warn('Stopping Agentic Commerce services...');

  // Stop services by PID file (reverse order of startup)
  for (const service of services) {
    stopService(service);
  }

  // Also kill any remaining processes on known ports
  for (const port of ports) {
    killPort(port);
  }

  log.success('All services stopped.');
}

main();
