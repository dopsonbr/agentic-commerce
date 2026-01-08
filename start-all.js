#!/usr/bin/env node

/**
 * Agentic Commerce POC - Start All Services
 * Node.js 24+ startup script with auto-dependency installation
 */

import { spawn, execSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, createWriteStream } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = join(__dirname, '.logs');

// Colors for terminal output
const colors = {
  red: '\x1b[0;31m',
  green: '\x1b[0;32m',
  yellow: '\x1b[1;33m',
  blue: '\x1b[0;34m',
  reset: '\x1b[0m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}${msg}${colors.reset}`),
};

// Service definitions
const services = [
  {
    name: 'shop-api',
    dir: 'shop-api',
    cmd: 'bun',
    args: ['run', 'dev'],
    port: 3000,
    healthUrl: 'http://localhost:3000/health',
    description: 'REST API for products and cart',
    packageManager: 'bun',
  },
  {
    name: 'shop-ui',
    dir: 'shop-ui',
    cmd: 'pnpm',
    args: ['start'],
    port: 4200,
    healthUrl: 'http://localhost:4200',
    description: 'Angular shopping SPA with NgRx',
    packageManager: 'pnpm',
  },
  {
    name: 'headless-session-manager',
    dir: 'headless-session-manager',
    cmd: 'pnpm',
    args: ['run', 'dev'],
    port: 3002,
    healthUrl: 'http://localhost:3002/health',
    description: 'Playwright browser sessions',
    packageManager: 'pnpm',
  },
  {
    name: 'mcp-tools',
    dir: 'mcp-tools',
    cmd: 'bun',
    args: ['run', 'dev'],
    port: 3001,
    healthUrl: 'http://localhost:3001/health',
    description: 'MCP tool server (5 tools)',
    packageManager: 'bun',
  },
  {
    name: 'chat-ui',
    dir: 'chat-ui',
    cmd: 'bun',
    args: ['run', 'dev'],
    port: 5173,
    healthUrl: 'http://localhost:5173',
    description: 'Chat interface with scripted agent',
    packageManager: 'bun',
  },
];

// Track spawned processes for cleanup
const processes = new Map();

/**
 * Check if a command exists in PATH
 */
function commandExists(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a port is in use
 */
function isPortInUse(port) {
  try {
    execSync(`lsof -Pi :${port} -sTCP:LISTEN -t`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if dependencies are properly installed
 * Verifies both node_modules exists AND lockfile is present
 * If lockfile exists but node_modules is missing/incomplete, needs install
 */
function hasDependencies(service) {
  const serviceDir = join(__dirname, service.dir);
  const nodeModulesPath = join(serviceDir, 'node_modules');

  // Check if node_modules exists
  if (!existsSync(nodeModulesPath)) return false;

  // Check for lockfile based on package manager
  const lockfiles = {
    bun: 'bun.lock',
    pnpm: 'pnpm-lock.yaml',
    npm: 'package-lock.json',
  };
  const lockfile = lockfiles[service.packageManager];
  const lockfilePath = join(serviceDir, lockfile);

  // If no lockfile, dependencies may not be installed properly
  if (!existsSync(lockfilePath)) return false;

  // For bun projects, verify a sample production dependency exists
  // This catches cases where node_modules exists but deps weren't installed
  if (service.packageManager === 'bun') {
    // Read package.json to find a production dependency to verify
    try {
      const pkgPath = join(serviceDir, 'package.json');
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      const deps = Object.keys(pkg.dependencies || {});
      if (deps.length > 0) {
        // Check if first dependency exists in node_modules
        const firstDep = deps[0];
        if (!existsSync(join(nodeModulesPath, firstDep))) {
          return false;
        }
      }
    } catch {
      return false;
    }
  }

  return true;
}

/**
 * Install dependencies for a service
 */
function installDependencies(service) {
  const serviceDir = join(__dirname, service.dir);
  const pm = service.packageManager;

  console.log(`  Installing dependencies for ${service.name} using ${pm}...`);

  try {
    execSync(`${pm} install`, {
      cwd: serviceDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    log.success(`  ${service.name} dependencies installed`);
    return true;
  } catch (error) {
    log.error(`  Failed to install ${service.name} dependencies`);
    console.error(`  ${error.message}`);
    return false;
  }
}

/**
 * Check and install dependencies for all services
 */
function ensureDependencies() {
  log.warn('Checking dependencies...');

  let allInstalled = true;

  for (const service of services) {
    if (!hasDependencies(service)) {
      console.log(`  ${colors.yellow}Missing dependencies in ${service.name}${colors.reset}`);
      if (!installDependencies(service)) {
        allInstalled = false;
      }
    } else {
      console.log(`  ${colors.green}${service.name} dependencies OK${colors.reset}`);
    }
  }

  return allInstalled;
}

/**
 * Wait for a service to respond to health check
 */
async function waitForService(service, maxAttempts = 90) {
  process.stdout.write(`  Waiting for ${service.name}...`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(service.healthUrl);
      if (response.ok || response.status < 500) {
        log.success(' ready');
        return true;
      }
    } catch {
      // Service not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  log.error(' timeout');
  return false;
}

/**
 * Start a service
 */
function startService(service) {
  const serviceDir = join(__dirname, service.dir);
  const logFile = join(LOG_DIR, `${service.name}.log`);
  const pidFile = join(LOG_DIR, `${service.name}.pid`);

  console.log(`  ${colors.blue}${service.name}${colors.reset} - ${service.description}`);
  log.warn(`[${service.name}] Starting on port ${service.port}...`);

  // Check if port is already in use
  if (isPortInUse(service.port)) {
    log.error(`  Port ${service.port} already in use!`);
    console.log("  Run './stop-all.sh' to stop existing services");
    return false;
  }

  // Open log file stream
  const logStream = createWriteStream(logFile);

  // Spawn the process
  const proc = spawn(service.cmd, service.args, {
    cwd: serviceDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });

  // Write logs
  proc.stdout.pipe(logStream);
  proc.stderr.pipe(logStream);

  // Save PID
  writeFileSync(pidFile, String(proc.pid));
  processes.set(service.name, proc);

  // Allow process to run independently
  proc.unref();

  return true;
}

/**
 * Stop all running services
 */
function stopAll() {
  for (const [name, proc] of processes) {
    try {
      process.kill(-proc.pid, 'SIGTERM');
      console.log(`  Stopped ${name}`);
    } catch {
      // Process may already be dead
    }
  }
}

/**
 * Main startup sequence
 */
async function main() {
  console.log(`${colors.blue}========================================${colors.reset}`);
  console.log(`${colors.blue}  Agentic Commerce POC - Starting...   ${colors.reset}`);
  console.log(`${colors.blue}========================================${colors.reset}`);
  console.log('');

  // Check prerequisites
  log.warn('Checking prerequisites...');
  const prereqs = ['bun', 'pnpm', 'node'];
  for (const cmd of prereqs) {
    if (!commandExists(cmd)) {
      log.error(`${cmd} is required but not installed.`);
      process.exit(1);
    }
  }
  log.success('  All prerequisites found');
  console.log('');

  // Create log directory
  mkdirSync(LOG_DIR, { recursive: true });

  // Check and install dependencies
  if (!ensureDependencies()) {
    log.error('Failed to install some dependencies.');
    process.exit(1);
  }
  log.success('  Dependencies OK');
  console.log('');

  // Start services
  log.warn('Starting services...');
  console.log('');

  let failed = false;
  for (const service of services) {
    if (!startService(service)) {
      failed = true;
      break;
    }
    // Brief pause between starts
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (failed) {
    log.error('Some services failed to start.');
    stopAll();
    process.exit(1);
  }

  console.log('');
  log.warn('Waiting for services to be ready...');

  // Wait for health checks
  for (const service of services) {
    if (!(await waitForService(service))) {
      failed = true;
    }
  }

  if (failed) {
    log.error(`Some services failed health checks. Check logs in ${LOG_DIR}/`);
    process.exit(1);
  }

  // Success message
  console.log('');
  log.success('════════════════════════════════════════════════════════════════');
  log.success('  All 5 services are running!');
  log.success('════════════════════════════════════════════════════════════════');
  console.log('');
  log.warn('Running Services:');
  console.log('');
  console.log('  Service                     Port    URL');
  console.log('  ─────────────────────────────────────────────────────────────');
  console.log('  shop-api                    3000    http://localhost:3000');
  console.log('  shop-ui                     4200    http://localhost:4200');
  console.log('  headless-session-manager    3002    http://localhost:3002');
  console.log('  mcp-tools                   3001    http://localhost:3001');
  console.log(`  ${colors.green}chat-ui                     5173    http://localhost:5173${colors.reset}`);
  console.log('');
  log.warn('Quick Start:');
  console.log(`  Open ${colors.green}http://localhost:5173${colors.reset} in your browser to start the demo`);
  console.log('');
  log.warn('Demo Commands to Try:');
  console.log('  "my customer id is 123456"    - Set your customer ID');
  console.log('  "show me hammers"              - Search for products');
  console.log('  "add it to my cart"            - Add last product to cart');
  console.log('  "what\'s in my cart"            - View cart contents');
  console.log('');
  log.warn(`Logs: ${LOG_DIR}/`);
  log.warn('Stop: ./stop-all.sh');
  console.log('');
}

main().catch((error) => {
  log.error(`Startup failed: ${error.message}`);
  stopAll();
  process.exit(1);
});
