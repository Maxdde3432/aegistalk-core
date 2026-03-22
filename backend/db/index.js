import pkg from 'pg';
const { Pool } = pkg;
import dns from 'node:dns';
import dotenv from 'dotenv';

dns.setDefaultResultOrder('ipv4first');

dotenv.config();

const parseBoolean = (value, fallback = false) => {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
};

const getDatabaseTarget = (value) => {
  if (!value) {
    return { host: 'localhost', port: '5432', database: 'aegistalk', isLocal: true };
  }

  try {
    const url = new URL(value);
    const host = (url.hostname || 'localhost').toLowerCase();
    return {
      host,
      port: url.port || '5432',
      database: (url.pathname || '/aegistalk').replace(/^\//, ''),
      isLocal: ['localhost', '127.0.0.1', '::1'].includes(host)
    };
  } catch {
    const host = String(value).trim().toLowerCase() || 'localhost';
    return {
      host,
      port: String(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'aegistalk',
      isLocal: ['localhost', '127.0.0.1', '::1'].includes(host)
    };
  }
};

const databaseUrl = process.env.DATABASE_URL || '';
const localHost = process.env.DB_HOST || 'localhost';
const target = getDatabaseTarget(databaseUrl || localHost);
const sslEnabled = parseBoolean(process.env.DB_SSL ?? process.env.DATABASE_SSL, !target.isLocal);

const basePoolConfig = {
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
  client_encoding: 'UTF8'
};

let dbConfig;

if (databaseUrl) {
  dbConfig = {
    connectionString: databaseUrl,
    ...basePoolConfig,
    connectionOptions: {
      family: 4
    }
  };
} else {
  dbConfig = {
    host: localHost,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'aegistalk',
    user: process.env.DB_USER || 'aegistalk',
    password: process.env.DB_PASSWORD || 'changeme_secure_123',
    ...basePoolConfig,
    family: 4
  };
}

if (sslEnabled) {
  dbConfig.ssl = { rejectUnauthorized: false };
}

if (process.env.DB_LOG !== 'silent') {
  console.log('[DB] Target configuration', {
    mode: databaseUrl ? 'database-url' : 'local-params',
    host: target.host,
    port: target.port,
    database: target.database,
    sslEnabled
  });
}

const pool = new Pool(dbConfig);

let didLogConnect = false;
pool.on('connect', () => {
  if (process.env.DB_LOG !== 'silent' && !didLogConnect) {
    didLogConnect = true;
    console.log('[DB] Connected to PostgreSQL');
  }
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client', err);
});

export const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.DB_LOG === 'verbose') {
      console.log('[DB] Query executed', { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('[DB] Query error', { text, error: error.message });
    throw error;
  }
};

export const getClient = async () => {
  const client = await pool.connect();
  const query = client.query.bind(client);
  const release = client.release.bind(client);

  const timeout = setTimeout(() => {
    console.error('[DB] A client has been checked out for more than 5 seconds');
  }, 5000);

  client.release = () => {
    clearTimeout(timeout);
    release.call(client);
  };

  return client;
};

export default pool;
