const STORAGE_KEY = 'covercam_logs_v1';
const MAX_ENTRIES = 500;

class Logger {
  constructor() {
    this.entries = [];
    this.listeners = new Set();
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.entries = parsed.slice(-MAX_ENTRIES);
        }
      }
    } catch {
      this.entries = [];
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries));
    } catch {
      this.entries = this.entries.slice(-250);
    }
  }

  log(level, message, meta = null) {
    const entry = {
      ts: new Date().toISOString(),
      level,
      message,
      meta: meta !== null && meta !== undefined ? this.serializeMeta(meta) : null
    };
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries.splice(0, this.entries.length - MAX_ENTRIES);
    }
    this.save();
    for (const fn of this.listeners) {
      fn(entry);
    }
  }

  serializeMeta(meta) {
    if (meta instanceof Error) {
      return { name: meta.name, message: meta.message };
    }
    if (typeof meta === 'object') {
      try {
        return JSON.parse(JSON.stringify(meta));
      } catch {
        return String(meta);
      }
    }
    return meta;
  }

  debug(msg, meta) { this.log('debug', msg, meta); }
  info(msg, meta) { this.log('info', msg, meta); }
  warn(msg, meta) { this.log('warn', msg, meta); }
  error(msg, meta) { this.log('error', msg, meta); }

  getAll() {
    return [...this.entries];
  }

  clear() {
    this.entries = [];
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    for (const fn of this.listeners) {
      fn(null);
    }
  }

  formatText() {
    return this.entries
      .map(e => {
        const time = e.ts.replace('T', ' ').replace('Z', '');
        const detail = e.meta ? ` | ${JSON.stringify(e.meta)}` : '';
        return `[${time}] [${e.level.toUpperCase()}] ${e.message}${detail}`;
      })
      .join('\n');
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export const logger = new Logger();
