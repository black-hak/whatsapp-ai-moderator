import { getPalabrasProhibidas } from '../database/db.js';
import { detectarURLComercial } from '../utils/urls.js';
import { analizarTextoIA, analizarImagenIA } from '../utils/ia.js';

export const NIVELES = {
  LIMPIO:      'limpio',
  ADVERTENCIA: 'advertencia',
  ELIMINAR:    'eliminar',
  EXPULSAR:    'expulsar',
};

const SPAM_REPETIDO   = /(.{5,})\1{3,}/gi;
const NUMEROS_MASIVOS = /(?:\+?\d[\d\s\-(). ]{7,}\d[\s,|]){2,}/g;
const LINK_PHISHING   = /(?:https?:\/\/)?(?:bit\.ly|tinyurl|t\.co|goo\.gl|ow\.ly|short\.io|cutt\.ly)[^\s]*/gi;

const PALABRAS_COMERCIALES = [
  'remesa','remesas','tasa','tasas','cambio','divisas','dolar','dolares',
  'bolivar','bolivares','transferencia','envio','enviar dinero',
  'vendo','venta','ventas','ofrezco','oferta','precio','precios',
  'contactar','contactame','escribeme','whatsapp','pedidos',
  'zapatos','ropa','torta','tortas','comida','pasaje','pasajes',
  'vuelo','vuelos','excursion','paquete','viaje'
];

export async function analizarMensaje(msg, grupoJid, modo) {
  if (msg.message?.imageMessage) {
    const caption = msg.message.imageMessage.caption || '';
    console.log('[Simon/filtro] Imagen recibida, caption="' + caption.substring(0,80) + '"');

    // Capa 1: vision IA
    const resImg = await analizarImagenIA(msg);
    console.log('[Simon/filtro] Vision IA resultado: ' + JSON.stringify(resImg));
    if (resImg && resImg.nivel !== NIVELES.LIMPIO) return resImg;

    // Capa 2: caption
    if (caption.length >= 1) {
      console.log('[Simon/filtro] Analizando caption...');
      return analizarTexto(caption, grupoJid, modo, msg);
    }

    // Capa 3: imagen sin caption
    return filtroImagenSinCaption(msg);
  }

  const texto = extraerTexto(msg);
  if (!texto || texto.trim().length < 2) return { nivel: NIVELES.LIMPIO, razon: null };

  return analizarTexto(texto, grupoJid, modo, msg);
}

function filtroImagenSinCaption(msg) {
  const quoted = msg.message?.imageMessage?.contextInfo?.quotedMessage?.conversation || '';
  if (quoted.length > 3) {
    const lower = quoted.toLowerCase();
    for (const palabra of PALABRAS_COMERCIALES) {
      if (lower.includes(palabra)) {
        return { nivel: NIVELES.ELIMINAR, razon: 'Imagen con contexto comercial detectado' };
      }
    }
  }
  return { nivel: NIVELES.LIMPIO, razon: null };
}

async function analizarTexto(texto, grupoJid, modo, msg) {
  const local = filtroLocal(texto, grupoJid);
  if (local.nivel !== NIVELES.LIMPIO) return local;

  if (msg && msg.message?.imageMessage) {
    const lower = texto.toLowerCase();
    for (const palabra of PALABRAS_COMERCIALES) {
      if (lower.includes(palabra)) {
        return { nivel: NIVELES.ELIMINAR, razon: 'Caption con contenido comercial: ' + palabra };
      }
    }
  }

  if (modo !== 'observer' && texto.trim().length > 6) {
    const ia = await analizarTextoIA(texto);
    if (ia && ia.nivel !== 'limpio') {
      return { nivel: ia.nivel, razon: ia.razon };
    }
  }

  return { nivel: NIVELES.LIMPIO, razon: null };
}

function filtroLocal(texto, grupoJid) {
  if (LINK_PHISHING.test(texto)) {
    LINK_PHISHING.lastIndex = 0;
    return { nivel: NIVELES.EXPULSAR, razon: 'Link de spam/phishing detectado' };
  }

  const urlRes = detectarURLComercial(texto);
  if (urlRes.detectado) {
    return { nivel: NIVELES.ELIMINAR, razon: 'Link comercial: ' + urlRes.dominio };
  }

  if (SPAM_REPETIDO.test(texto)) {
    SPAM_REPETIDO.lastIndex = 0;
    return { nivel: NIVELES.ELIMINAR, razon: 'Mensaje repetitivo (spam)' };
  }

  if (NUMEROS_MASIVOS.test(texto)) {
    NUMEROS_MASIVOS.lastIndex = 0;
    return { nivel: NIVELES.ADVERTENCIA, razon: 'Multiples numeros de telefono' };
  }

  const prohibidas = getPalabrasProhibidas(grupoJid);
  const lower = texto.toLowerCase();
  for (const p of prohibidas) {
    if (lower.includes(p)) {
      return { nivel: NIVELES.ADVERTENCIA, razon: 'Palabra no permitida: "' + p + '"' };
    }
  }

  return { nivel: NIVELES.LIMPIO, razon: null };
}

export function extraerTexto(msg) {
  return (
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    msg.message?.documentMessage?.caption ||
    ''
  );
}
