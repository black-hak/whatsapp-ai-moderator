import {
  getModo, setModo,
  addWhitelist, removeWhitelist,
  addPalabraProhibida, getHistorial,
  resetAdvertencias, registrarSancion,
} from '../database/db.js';

const PREFIX = process.env.CMD_PREFIX || '!';

async function esAdmin(sock, grupoJid, usuarioJid) {
  try {
    const meta = await sock.groupMetadata(grupoJid);
    return meta.participants.some(
      p => p.id === usuarioJid && (p.admin === 'admin' || p.admin === 'superadmin')
    );
  } catch { return false; }
}

export async function manejarComando(sock, msg, grupoJid, usuarioJid, texto) {
  if (!texto.startsWith(PREFIX)) return false;
  const partes = texto.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = partes[0].toLowerCase();
  const args = partes.slice(1);
  const admin = await esAdmin(sock, grupoJid, usuarioJid);

  switch (cmd) {
    case 'ping':
      await sock.sendMessage(grupoJid, { text: 'Bot activo!' });
      return true;
    case 'modo':
      if (!admin) { await sock.sendMessage(grupoJid, { text: 'Solo administradores.' }); return true; }
      if (!['strict','moderate','observer'].includes(args[0])) {
        await sock.sendMessage(grupoJid, { text: 'Modos: strict | moderate | observer. Actual: ' + getModo(grupoJid) });
        return true;
      }
      setModo(grupoJid, args[0]);
      await sock.sendMessage(grupoJid, { text: 'Modo cambiado a ' + args[0] });
      return true;
    case 'whitelist':
      if (!admin) return true;
      const m = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      if (!m.length) { await sock.sendMessage(grupoJid, { text: 'Uso: !whitelist @usuario' }); return true; }
      for (const j of m) addWhitelist(grupoJid, j);
      await sock.sendMessage(grupoJid, { text: 'En whitelist: ' + m.map(j=>'@'+j.split('@')[0]).join(', '), mentions: m });
      return true;
    case 'ban':
      if (!admin) return true;
      const t = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      if (!t.length) { await sock.sendMessage(grupoJid, { text: 'Uso: !ban @usuario' }); return true; }
      const rb = args.slice(t.length).join(' ') || 'Ban manual';
      for (const j of t) {
        registrarSancion(grupoJid, j, 'ban_manual', rb);
        await sock.sendMessage(grupoJid, { text: '@'+j.split('@')[0]+' expulsado. Razon: '+rb, mentions: [j] });
        await sock.groupParticipantsUpdate(grupoJid, [j], 'remove');
      }
      return true;
    case 'resetadv':
      if (!admin) return true;
      const tr = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      for (const j of tr) resetAdvertencias(grupoJid, j);
      await sock.sendMessage(grupoJid, { text: 'Advertencias reseteadas.', mentions: tr });
      return true;
    case 'addpalabra':
      if (!admin) return true;
      if (!args[0]) { await sock.sendMessage(grupoJid, { text: 'Uso: !addpalabra <palabra>' }); return true; }
      addPalabraProhibida(grupoJid, args[0]);
      await sock.sendMessage(grupoJid, { text: 'Palabra "' + args[0] + '" anadida.' });
      return true;
    case 'historial':
      if (!admin) return true;
      await sock.sendMessage(grupoJid, { text: 'Para ver el historial escribeme en PRIVADO: !historial' });
      return true;
    case 'ayuda':
      await sock.sendMessage(grupoJid, {
        text: 'Comandos del Bot Admin\n\nPublicos:\n!ping\n!ayuda\n\nSolo admins:\n!modo [strict|moderate|observer]\n!ban @usuario\n!whitelist @usuario\n!resetadv @usuario\n!addpalabra <palabra>\n\nReportes: escribeme en PRIVADO con !historial'
      });
      return true;
    default:
      return false;
  }
}

function delayChatPrivado() {
  const h = new Date().getHours();
  const noche = h >= 22 || h < 7;
  const min = noche ? 300000 : 60000;
  const max = noche ? 900000 : 180000;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function manejarComandoPrivado(sock, msg, remitenteJid, texto) {
  if (!texto.startsWith(PREFIX)) return;
  const partes = texto.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = partes[0].toLowerCase();

  const espera = delayChatPrivado();
  console.log('[Simon/privado] Respuesta en ' + (espera/60000).toFixed(1) + ' min');
  await new Promise(r => setTimeout(r, espera));

  switch (cmd) {
    case 'historial': {
      let grupos;
      try { grupos = await sock.groupFetchAllParticipating(); }
      catch { await sock.sendMessage(remitenteJid, { text: 'No pude obtener los grupos. Intentalo de nuevo.' }); return; }

      const gruposAdmin = [];
      for (const [jid, meta] of Object.entries(grupos)) {
        const esAdminAqui = meta.participants.some(
          p => p.id === remitenteJid && (p.admin === 'admin' || p.admin === 'superadmin')
        );
        if (esAdminAqui) gruposAdmin.push({ jid, nombre: meta.subject });
      }

      if (!gruposAdmin.length) {
        await sock.sendMessage(remitenteJid, { text: 'No eres administrador en ningun grupo donde yo este activo.' });
        return;
      }

      const ahora = new Date().toLocaleDateString('es-ES', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
      let reporte = 'Reporte de Sanciones - Simon\n' + ahora + '\n\n';

      for (const { jid, nombre } of gruposAdmin) {
        const registros = getHistorial(jid, 15);
        reporte += nombre + '\n';
        if (!registros.length) {
          reporte += 'Sin sanciones registradas.\n\n';
        } else {
          const emojis = { advertencia:'Warning', eliminacion:'Eliminado', expulsion:'Expulsado', expulsion_directa:'Expulsado directo', ban_manual:'Ban manual' };
          registros.forEach(function(r, i) {
            const cuando = r.aplicado_en ? new Date(r.aplicado_en).toLocaleString('es-ES', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '-';
            reporte += (i+1) + '. @' + r.usuario_jid.split('@')[0] + ' | ' + (emojis[r.tipo] || r.tipo) + ' | ' + (r.razon || '-') + ' | ' + cuando + '\n';
          });
          reporte += '\n';
        }
        reporte += '--------------------\n\n';
      }

      await sock.sendMessage(remitenteJid, { text: reporte.trim() });
      return;
    }
    case 'ayuda':
      await sock.sendMessage(remitenteJid, {
        text: 'Comandos de Simon\n\nAqui en privado:\n!historial - Reporte de sanciones de todos tus grupos\n!ayuda - Este menu\n\nEn el grupo (solo admins):\n!modo [strict|moderate|observer]\n!ban @usuario [razon]\n!whitelist @usuario\n!resetadv @usuario\n!addpalabra <palabra>\n!ping\n\nLos reportes siempre en privado. Solo tu los ves.'
      });
      return;
    default:
      await sock.sendMessage(remitenteJid, { text: 'Comando no reconocido. Escribe !ayuda para ver los disponibles.' });
  }
}
