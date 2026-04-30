import 'dotenv/config';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  isJidGroup,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { analizarMensaje, extraerTexto, NIVELES } from './filters/contenido.js';
import { aplicarSancion } from './handlers/sanciones.js';
import { manejarComando, manejarComandoPrivado } from './handlers/comandos.js';
import { registrarGrupo, getModo } from './database/db.js';
import { encolarAccion } from './utils/delay.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSION_PATH = join(__dirname, '../session');

const logger = pino({ level: 'silent' });

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH);
  const { version }          = await fetchLatestBaileysVersion();

  console.log(`\n🤖 Simon iniciando... (WA v${version.join('.')})\n`);

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger,
    printQRInTerminal: false,
    browser: ['Simon', 'Chrome', '1.0'],
    getMessage: async () => ({ conversation: '' }),
    markOnlineOnConnect: false,
  });

  // ── QR y estado de conexión ──
  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\n📱 Escanea este QR con WhatsApp:\n');
      qrcode.generate(qr, { small: true });
      console.log('\nVe a WhatsApp → Dispositivos vinculados → Vincular dispositivo\n');
    }

    if (connection === 'close') {
      const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
      if (code === DisconnectReason.loggedOut) {
        console.log('\n❌ Sesión cerrada. Elimina la carpeta session/ y reinicia.');
        process.exit(1);
      }
      const delay = Math.floor(Math.random() * 8000) + 4000;
      console.log(`🔄 Reconectando en ${(delay/1000).toFixed(1)}s...`);
      setTimeout(startBot, delay);
    }

    if (connection === 'open') {
      console.log('\n✅ Simon conectado! Vigilando el grupo silenciosamente.\n');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('groups.update', async (updates) => {
    for (const u of updates) {
      if (u.subject) registrarGrupo(u.id, u.subject);
    }
  });

  // ── Motor principal ──
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      try {
        if (msg.key.fromMe) continue;
        if (!msg.message) continue;

        const texto = extraerTexto(msg);

        // ── Mensajes PRIVADOS: solo comandos de admins ──
        if (!isJidGroup(msg.key.remoteJid)) {
          if (texto.startsWith(process.env.CMD_PREFIX || '!')) {
            await manejarComandoPrivado(sock, msg, msg.key.remoteJid, texto);
          }
          continue;
        }

        // ── Mensajes de GRUPO ──
        const grupoJid   = msg.key.remoteJid;
        const usuarioJid = msg.key.participant || msg.participant;
        if (!usuarioJid) continue;

        const modo = getModo(grupoJid);

        // Comandos en grupo
        if (texto.startsWith(process.env.CMD_PREFIX || '!')) {
          await manejarComando(sock, msg, grupoJid, usuarioJid, texto);
          continue;
        }

        // Modo observador: escucha pero no actúa
        if (modo === 'observer') continue;

        // Analizar contenido
        const { nivel, razon } = await analizarMensaje(msg, grupoJid, modo);

        if (nivel !== NIVELES.LIMPIO) {
          encolarAccion(msg.key.id, async () => {
            await aplicarSancion(sock, msg, grupoJid, usuarioJid, nivel, razon, modo);
          });
        }

      } catch (err) {
        console.error('[Simon] Error:', err.message);
      }
    }
  });
}

startBot().catch(console.error);
