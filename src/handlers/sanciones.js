import {
  addAdvertencia,
  resetAdvertencias,
  registrarSancion,
  isWhitelisted,
} from '../database/db.js';
import { NIVELES } from '../filters/contenido.js';

const MAX_ADV = { strict: 1, moderate: 2, observer: 999 };

export async function aplicarSancion(sock, msg, grupoJid, usuarioJid, nivel, razon, modo) {
  if (nivel === NIVELES.LIMPIO) return;
  if (isWhitelisted(grupoJid, usuarioJid)) return;

  const maxAdv        = MAX_ADV[modo] || 2;
  const nombreUsuario = '@' + usuarioJid.split('@')[0];

  console.log('[Simon/sancion] nivel=' + nivel + ' usuario=' + usuarioJid.split('@')[0]);

  try {
    await sock.sendMessage(grupoJid, { delete: msg.key });
    console.log('[Simon/sancion] Mensaje eliminado');
  } catch (err) {
    console.log('[Simon/sancion] Sin permisos para eliminar: ' + err.message);
    return;
  }

  if (nivel === NIVELES.ADVERTENCIA || nivel === NIVELES.ELIMINAR) {
    const conteo = addAdvertencia(grupoJid, usuarioJid, razon);
    registrarSancion(grupoJid, usuarioJid,
      nivel === NIVELES.ADVERTENCIA ? 'advertencia' : 'eliminacion', razon);

    if (conteo >= maxAdv) {
      registrarSancion(grupoJid, usuarioJid, 'expulsion', 'Alcanzo ' + maxAdv + ' infracciones');
      await sock.sendMessage(grupoJid, {
        text: '🚫 *' + nombreUsuario + ' ha sido removido del grupo.*\n\n' +
              '📋 *Lo que se detectó:*\n_' + razon + '_\n\n' +
              '⚠️ Esta fue su infracción número ' + conteo + ' de ' + maxAdv + '.',
        mentions: [usuarioJid]
      });
      try {
        await sock.groupParticipantsUpdate(grupoJid, [usuarioJid], 'remove');
      } catch (err) {
        console.error('[Simon/sancion] Error al expulsar:', err.message);
      }
      resetAdvertencias(grupoJid, usuarioJid);
    } else {
      const restantes = maxAdv - conteo;
      await sock.sendMessage(grupoJid, {
        text: '⚠️ *Atención ' + nombreUsuario + '*\n\n' +
              'Tu mensaje fue eliminado por contener contenido no permitido en este grupo.\n\n' +
              '📋 *Lo que se detectó:*\n_' + razon + '_\n\n' +
              '🔢 Esta es tu *advertencia ' + conteo + ' de ' + maxAdv + '*. ' +
              (restantes === 1
                ? '❗ *La próxima infracción resultará en tu expulsión del grupo.*'
                : 'Te quedan ' + restantes + ' oportunidades.') +
              '\n\n_Si crees que esta advertencia es un error, comunícate con un administrador del grupo._',
        mentions: [usuarioJid]
      });
      console.log('[Simon/sancion] Advertencia ' + conteo + '/' + maxAdv + ' enviada');
    }
  } else if (nivel === NIVELES.EXPULSAR) {
    registrarSancion(grupoJid, usuarioJid, 'expulsion_directa', razon);
    await sock.sendMessage(grupoJid, {
      text: '🚫 *' + nombreUsuario + ' fue removido del grupo.*\n\n' +
            '📋 *Motivo:*\n_' + razon + '_',
      mentions: [usuarioJid]
    });
    try {
      await sock.groupParticipantsUpdate(grupoJid, [usuarioJid], 'remove');
    } catch (err) {
      console.error('[Simon/sancion] Error al expulsar:', err.message);
    }
  }
}
