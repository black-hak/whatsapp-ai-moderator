import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '../../data/bot.db');

const db = new Database(DB_PATH);

// Habilitar WAL para mejor rendimiento concurrente
db.pragma('journal_mode = WAL');

// Crear tablas
db.exec(`
  CREATE TABLE IF NOT EXISTS grupos (
    jid TEXT PRIMARY KEY,
    nombre TEXT,
    modo TEXT DEFAULT 'moderate',
    activo INTEGER DEFAULT 1,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sanciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grupo_jid TEXT NOT NULL,
    usuario_jid TEXT NOT NULL,
    tipo TEXT NOT NULL,
    razon TEXT,
    mensaje TEXT,
    aplicado_en DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS advertencias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grupo_jid TEXT NOT NULL,
    usuario_jid TEXT NOT NULL,
    razon TEXT,
    contador INTEGER DEFAULT 1,
    ultima_vez DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(grupo_jid, usuario_jid)
  );

  CREATE TABLE IF NOT EXISTS whitelist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grupo_jid TEXT NOT NULL,
    usuario_jid TEXT NOT NULL,
    UNIQUE(grupo_jid, usuario_jid)
  );

  CREATE TABLE IF NOT EXISTS palabras_prohibidas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    grupo_jid TEXT,
    palabra TEXT NOT NULL,
    UNIQUE(grupo_jid, palabra)
  );
`);

// ── Grupos ──
export const registrarGrupo = (jid, nombre) => {
  db.prepare(`INSERT OR IGNORE INTO grupos (jid, nombre) VALUES (?, ?)`)
    .run(jid, nombre);
};

export const getModo = (jid) => {
  const row = db.prepare(`SELECT modo FROM grupos WHERE jid = ?`).get(jid);
  return row?.modo || 'moderate';
};

export const setModo = (jid, modo) => {
  db.prepare(`UPDATE grupos SET modo = ? WHERE jid = ?`).run(modo, jid);
};

// ── Advertencias ──
export const addAdvertencia = (grupoJid, usuarioJid, razon) => {
  const exists = db.prepare(
    `SELECT contador FROM advertencias WHERE grupo_jid = ? AND usuario_jid = ?`
  ).get(grupoJid, usuarioJid);

  if (exists) {
    db.prepare(
      `UPDATE advertencias SET contador = contador + 1, razon = ?, ultima_vez = CURRENT_TIMESTAMP
       WHERE grupo_jid = ? AND usuario_jid = ?`
    ).run(razon, grupoJid, usuarioJid);
    return exists.contador + 1;
  } else {
    db.prepare(
      `INSERT INTO advertencias (grupo_jid, usuario_jid, razon) VALUES (?, ?, ?)`
    ).run(grupoJid, usuarioJid, razon);
    return 1;
  }
};

export const getAdvertencias = (grupoJid, usuarioJid) => {
  const row = db.prepare(
    `SELECT contador FROM advertencias WHERE grupo_jid = ? AND usuario_jid = ?`
  ).get(grupoJid, usuarioJid);
  return row?.contador || 0;
};

export const resetAdvertencias = (grupoJid, usuarioJid) => {
  db.prepare(
    `DELETE FROM advertencias WHERE grupo_jid = ? AND usuario_jid = ?`
  ).run(grupoJid, usuarioJid);
};

// ── Sanciones ──
export const registrarSancion = (grupoJid, usuarioJid, tipo, razon, mensaje = '') => {
  db.prepare(
    `INSERT INTO sanciones (grupo_jid, usuario_jid, tipo, razon, mensaje) VALUES (?, ?, ?, ?, ?)`
  ).run(grupoJid, usuarioJid, tipo, razon, mensaje);
};

export const getHistorial = (grupoJid, limit = 20) => {
  return db.prepare(
    `SELECT * FROM sanciones WHERE grupo_jid = ? ORDER BY aplicado_en DESC LIMIT ?`
  ).all(grupoJid, limit);
};

// ── Whitelist ──
export const isWhitelisted = (grupoJid, usuarioJid) => {
  return !!db.prepare(
    `SELECT 1 FROM whitelist WHERE grupo_jid = ? AND usuario_jid = ?`
  ).get(grupoJid, usuarioJid);
};

export const addWhitelist = (grupoJid, usuarioJid) => {
  db.prepare(`INSERT OR IGNORE INTO whitelist (grupo_jid, usuario_jid) VALUES (?, ?)`)
    .run(grupoJid, usuarioJid);
};

export const removeWhitelist = (grupoJid, usuarioJid) => {
  db.prepare(`DELETE FROM whitelist WHERE grupo_jid = ? AND usuario_jid = ?`)
    .run(grupoJid, usuarioJid);
};

// ── Palabras prohibidas ──
export const getPalabrasProhibidas = (grupoJid) => {
  return db.prepare(
    `SELECT palabra FROM palabras_prohibidas WHERE grupo_jid = ? OR grupo_jid IS NULL`
  ).all(grupoJid).map(r => r.palabra);
};

export const addPalabraProhibida = (grupoJid, palabra) => {
  db.prepare(`INSERT OR IGNORE INTO palabras_prohibidas (grupo_jid, palabra) VALUES (?, ?)`)
    .run(grupoJid, palabra.toLowerCase());
};

export default db;

