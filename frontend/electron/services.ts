import { spawn, ChildProcess, execFile } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'
import * as http from 'http'
import {
  API_PORT,
  FP_PORT,
  PG_PORT,
  SCHEMA_VERSION,
  binName,
  ensureDir,
  getUserDataPaths,
  resolveResources,
  type ResourcePaths,
} from './paths'

export type ServiceStatus = {
  phase: string
  detail?: string
  ready: boolean
  error?: string
  fingerprintMock?: boolean
}

type Credentials = {
  dbUser: string
  dbPassword: string
  dbName: string
}

type StatusListener = (status: ServiceStatus) => void

function run(
  file: string,
  args: string[],
  opts: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number } = {}
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      file,
      args,
      {
        cwd: opts.cwd,
        env: { ...process.env, ...opts.env },
        timeout: opts.timeoutMs ?? 120_000,
        windowsHide: true,
        maxBuffer: 10 * 1024 * 1024,
      },
      (err, stdout, stderr) => {
        if (err) {
          const message = `${err.message}\n${stderr || stdout || ''}`.trim()
          reject(new Error(message))
          return
        }
        resolve({ stdout: String(stdout), stderr: String(stderr) })
      }
    )
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

function httpGet(url: string, timeoutMs = 3000): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: timeoutMs }, res => {
      const chunks: Buffer[] = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        resolve({
          status: res.statusCode || 0,
          body: Buffer.concat(chunks).toString('utf8'),
        })
      })
    })
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`Timeout requesting ${url}`))
    })
  })
}

async function waitFor(
  label: string,
  check: () => Promise<boolean>,
  timeoutMs = 60_000,
  intervalMs = 500
): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      if (await check()) return
    } catch {
      // retry
    }
    await sleep(intervalMs)
  }
  throw new Error(`Timed out waiting for ${label}`)
}

export class ServiceSupervisor {
  private resources: ResourcePaths
  private userData = getUserDataPaths()
  private children: ChildProcess[] = []
  private listeners: StatusListener[] = []
  private credentials: Credentials | null = null
  private fingerprintMock = false
  private stopping = false

  constructor() {
    this.resources = resolveResources()
  }

  onStatus(listener: StatusListener): void {
    this.listeners.push(listener)
  }

  private emit(status: ServiceStatus): void {
    for (const listener of this.listeners) {
      try {
        listener(status)
      } catch {
        // ignore listener errors
      }
    }
  }

  private loadOrCreateCredentials(): Credentials {
    ensureDir(this.userData.base)
    if (fs.existsSync(this.userData.credentials)) {
      this.credentials = JSON.parse(
        fs.readFileSync(this.userData.credentials, 'utf8')
      ) as Credentials
      return this.credentials
    }

    const creds: Credentials = {
      dbUser: 'ubaka',
      dbPassword: crypto.randomBytes(18).toString('base64url'),
      dbName: 'ubaka_attendance',
    }
    fs.writeFileSync(this.userData.credentials, JSON.stringify(creds, null, 2), {
      mode: 0o600,
    })
    this.credentials = creds
    return creds
  }

  private pgBin(name: string): string {
    return path.join(this.resources.postgresql, 'bin', binName(name))
  }

  private nodeBin(): string {
    const bundled = path.join(this.resources.node, binName('node'))
    if (fs.existsSync(bundled)) return bundled
    return process.platform === 'win32' ? 'node.exe' : 'node'
  }

  private async ensurePostgresqlLayout(): Promise<void> {
    const initdb = this.pgBin('initdb')
    if (!fs.existsSync(initdb)) {
      throw new Error(
        `Portable PostgreSQL not found at ${this.resources.postgresql}. ` +
          'Run scripts/package-windows to download vendor/postgresql-win.'
      )
    }
  }

  private async initDatabaseIfNeeded(creds: Credentials): Promise<void> {
    ensureDir(this.userData.logs)
    const pgData = this.userData.pgData

    if (!fs.existsSync(path.join(pgData, 'PG_VERSION'))) {
      this.emit({ phase: 'database', detail: 'Initializing PostgreSQL data directory…', ready: false })
      ensureDir(path.dirname(pgData))
      // Trust local connections for the bundled single-user desktop install
      await run(this.pgBin('initdb'), [
        '-D',
        pgData,
        '-U',
        creds.dbUser,
        '-A',
        'trust',
        '-E',
        'UTF8',
        '--locale=C',
      ])

      const confPath = path.join(pgData, 'postgresql.conf')
      let conf = fs.readFileSync(confPath, 'utf8')
      if (!/^port\s*=/m.test(conf)) {
        conf += `\nport = ${PG_PORT}\n`
      } else {
        conf = conf.replace(/^port\s*=.*/m, `port = ${PG_PORT}`)
      }
      conf = conf.replace(/^#?listen_addresses\s*=.*/m, "listen_addresses = '127.0.0.1'")
      fs.writeFileSync(confPath, conf)

      const hbaPath = path.join(pgData, 'pg_hba.conf')
      fs.writeFileSync(
        hbaPath,
        [
          '# Ubaka desktop — local only',
          'host all all 127.0.0.1/32 trust',
          'host all all ::1/128 trust',
          'local all all trust',
          '',
        ].join('\n')
      )
    }
  }

  private async startPostgres(): Promise<void> {
    this.emit({ phase: 'database', detail: 'Starting PostgreSQL…', ready: false })
    const logFile = path.join(this.userData.logs, 'postgres.log')

    // pg_ctl start is fire-and-forget; postgres keeps running detached
    await run(this.pgBin('pg_ctl'), [
      '-D',
      this.userData.pgData,
      '-l',
      logFile,
      '-o',
      `-p ${PG_PORT}`,
      'start',
    ])

    await waitFor('PostgreSQL', async () => {
      await run(this.pgBin('pg_isready'), ['-h', '127.0.0.1', '-p', String(PG_PORT)])
      return true
    })
  }

  private async stopPostgres(): Promise<void> {
    const pgData = this.userData.pgData
    if (!fs.existsSync(path.join(pgData, 'PG_VERSION'))) return
    try {
      await run(this.pgBin('pg_ctl'), ['-D', pgData, '-m', 'fast', 'stop'], {
        timeoutMs: 30_000,
      })
    } catch {
      // already stopped
    }
  }

  private async applySchemaIfNeeded(creds: Credentials): Promise<void> {
    if (
      fs.existsSync(this.userData.schemaStamp) &&
      fs.readFileSync(this.userData.schemaStamp, 'utf8').trim() === SCHEMA_VERSION
    ) {
      return
    }

    this.emit({ phase: 'database', detail: 'Creating database and applying schema…', ready: false })

    // Create DB if missing
    try {
      await run(this.pgBin('createdb'), [
        '-h',
        '127.0.0.1',
        '-p',
        String(PG_PORT),
        '-U',
        creds.dbUser,
        creds.dbName,
      ])
    } catch (err) {
      const msg = (err as Error).message || ''
      if (!/already exists/i.test(msg)) {
        // On Windows, createdb may fail differently; try psql CREATE DATABASE
        try {
          await run(this.pgBin('psql'), [
            '-h',
            '127.0.0.1',
            '-p',
            String(PG_PORT),
            '-U',
            creds.dbUser,
            '-d',
            'postgres',
            '-c',
            `CREATE DATABASE ${creds.dbName};`,
          ])
        } catch (err2) {
          const msg2 = (err2 as Error).message || ''
          if (!/already exists/i.test(msg2)) throw err2
        }
      }
    }

    const schemaFile = path.join(this.resources.databaseSql, 'schema.sql')
    const migrationFile = path.join(
      this.resources.databaseSql,
      'migrations',
      '001_daily_wage.sql'
    )

    if (!fs.existsSync(schemaFile)) {
      throw new Error(`Schema file missing: ${schemaFile}`)
    }

    await run(this.pgBin('psql'), [
      '-h',
      '127.0.0.1',
      '-p',
      String(PG_PORT),
      '-U',
      creds.dbUser,
      '-d',
      creds.dbName,
      '-v',
      'ON_ERROR_STOP=1',
      '-f',
      schemaFile,
    ])

    if (fs.existsSync(migrationFile)) {
      await run(this.pgBin('psql'), [
        '-h',
        '127.0.0.1',
        '-p',
        String(PG_PORT),
        '-U',
        creds.dbUser,
        '-d',
        creds.dbName,
        '-v',
        'ON_ERROR_STOP=1',
        '-f',
        migrationFile,
      ])
    }

    fs.writeFileSync(this.userData.schemaStamp, SCHEMA_VERSION)
  }

  private writeBackendEnv(creds: Credentials): void {
    const lines = [
      `PORT=${API_PORT}`,
      `DB_HOST=127.0.0.1`,
      `DB_PORT=${PG_PORT}`,
      `DB_NAME=${creds.dbName}`,
      `DB_USER=${creds.dbUser}`,
      `DB_PASSWORD=${creds.dbPassword}`,
      `DB_MAX_CONNECTIONS=10`,
      `LOG_LEVEL=info`,
      `LOG_DIR=${this.userData.logs}`,
      `FINGERPRINT_SERVICE_URL=http://127.0.0.1:${FP_PORT}`,
      '',
    ]
    fs.writeFileSync(this.userData.backendEnv, lines.join('\n'), { mode: 0o600 })
  }

  private track(child: ChildProcess): void {
    this.children.push(child)
    child.on('exit', () => {
      this.children = this.children.filter(c => c !== child)
    })
  }

  private async startBackend(creds: Credentials): Promise<void> {
    this.emit({ phase: 'backend', detail: 'Starting API server…', ready: false })

    const serverJs = path.join(this.resources.backend, 'dist', 'server.js')
    if (!fs.existsSync(serverJs)) {
      throw new Error(`Backend build missing: ${serverJs}`)
    }

    this.writeBackendEnv(creds)

    const child = spawn(
      this.nodeBin(),
      [serverJs],
      {
        cwd: this.resources.backend,
        env: {
          ...process.env,
          PORT: String(API_PORT),
          DB_HOST: '127.0.0.1',
          DB_PORT: String(PG_PORT),
          DB_NAME: creds.dbName,
          DB_USER: creds.dbUser,
          DB_PASSWORD: creds.dbPassword,
          DB_MAX_CONNECTIONS: '10',
          LOG_LEVEL: 'info',
          LOG_DIR: this.userData.logs,
          DOTENV_CONFIG_PATH: this.userData.backendEnv,
        },
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    )
    this.track(child)

    const logPath = path.join(this.userData.logs, 'backend.log')
    const logStream = fs.createWriteStream(logPath, { flags: 'a' })
    child.stdout?.pipe(logStream)
    child.stderr?.pipe(logStream)

    await waitFor('backend /health', async () => {
      const res = await httpGet(`http://127.0.0.1:${API_PORT}/health`)
      return res.status === 200
    })
  }

  private hasWindowsSdk(): boolean {
    const dll = path.join(this.resources.sdkWindows, 'libzkfp.dll')
    return fs.existsSync(dll)
  }

  private async startFingerprint(): Promise<void> {
    this.emit({ phase: 'fingerprint', detail: 'Starting fingerprint service…', ready: false })

    const useMock = !this.hasWindowsSdk()
    this.fingerprintMock = useMock

    const exePath = path.join(this.resources.fingerprint, binName('fingerprint-service'))
    const pyScript = path.join(this.resources.fingerprint, 'zkfinger_service.py')

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      ALLOW_MOCK: useMock ? '1' : '0',
      SCANNER_MATCH_THRESHOLD: '50',
    }

    if (fs.existsSync(this.resources.sdkWindows)) {
      env.PATH = `${this.resources.sdkWindows}${path.delimiter}${env.PATH || ''}`
      env.ZKFP_LIB_DIR = this.resources.sdkWindows
    }

    let child: ChildProcess
    if (fs.existsSync(exePath)) {
      child = spawn(exePath, [], {
        cwd: this.resources.fingerprint,
        env,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } else if (fs.existsSync(pyScript)) {
      const python = process.platform === 'win32' ? 'python' : 'python3'
      child = spawn(python, [pyScript], {
        cwd: this.resources.fingerprint,
        env,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    } else {
      throw new Error(
        `Fingerprint service not found at ${exePath} or ${pyScript}`
      )
    }

    this.track(child)
    const logPath = path.join(this.userData.logs, 'fingerprint.log')
    const logStream = fs.createWriteStream(logPath, { flags: 'a' })
    child.stdout?.pipe(logStream)
    child.stderr?.pipe(logStream)

    await waitFor('fingerprint /health', async () => {
      const res = await httpGet(`http://127.0.0.1:${FP_PORT}/health`)
      return res.status === 200
    }, 45_000)
  }

  async startAll(): Promise<ServiceStatus> {
    this.stopping = false
    try {
      const creds = this.loadOrCreateCredentials()
      await this.ensurePostgresqlLayout()
      await this.initDatabaseIfNeeded(creds)
      await this.startPostgres()
      await this.applySchemaIfNeeded(creds)
      await this.startBackend(creds)
      await this.startFingerprint()

      const status: ServiceStatus = {
        phase: 'ready',
        detail: this.fingerprintMock
          ? 'Services ready (fingerprint mock — Windows ZKFinger DLLs not found).'
          : 'All services ready.',
        ready: true,
        fingerprintMock: this.fingerprintMock,
      }
      this.emit(status)
      return status
    } catch (err) {
      const status: ServiceStatus = {
        phase: 'error',
        ready: false,
        error: (err as Error).message,
      }
      this.emit(status)
      await this.stopAll()
      throw err
    }
  }

  async stopAll(): Promise<void> {
    if (this.stopping) return
    this.stopping = true
    this.emit({ phase: 'shutdown', detail: 'Stopping services…', ready: false })

    for (const child of [...this.children].reverse()) {
      try {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', String(child.pid), '/f', '/t'], {
            windowsHide: true,
            stdio: 'ignore',
          })
        } else if (child.pid) {
          process.kill(-child.pid, 'SIGTERM')
        } else {
          child.kill('SIGTERM')
        }
      } catch {
        try {
          child.kill('SIGKILL')
        } catch {
          // ignore
        }
      }
    }
    this.children = []

    await this.stopPostgres()
  }
}
