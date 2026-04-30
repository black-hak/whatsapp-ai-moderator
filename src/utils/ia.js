import fetch from 'node-fetch';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import 'dotenv/config';

const AI_URL  = process.env.AI_API_URL;
const AI_KEY  = process.env.AI_API_KEY;
const MDL     = process.env.AI_MODEL || 'meta-llama/Llama-3.3-70B-Instruct-Turbo';

const OR_URL  = 'https://openrouter.ai/api/v1/chat/completions';
const OR_KEY  = process.env.OPENROUTER_API_KEY;
const VMDL    = process.env.OPENROUTER_VISION_MODEL || 'qwen/qwen3.6-flash';

const SYSTEM_PROMPT =
  'Eres moderador del grupo de WhatsApp "Venezolanos en Joinville". ' +
  'Grupo para venezolanos en Joinville, Santa Catarina, Brasil. ' +
  'PERMITIDO: conversacion general, preguntas sobre servicios/lugares, compartir noticias, pedir ayuda. ' +
  'PROHIBIDO: vender productos (ropa, zapatos, comida, tortas, electronicos), ' +
  'ofrecer remesas/cambio de divisas/envio de dinero, vender pasajes/excursiones, ' +
  'publicidad de negocios, links de tiendas. ' +
  'REGLA CLAVE distinguir PREGUNTA de OFERTA: ' +
  '"donde hago remesas?" => limpio. ' +
  '"hago remesas Venezuela Brasil precio especial" => eliminar. ' +
  '"donde compro zapatos?" => limpio. ' +
  '"vendo zapatos importados contactame" => eliminar. ' +
  'Responde UNICAMENTE con JSON sin texto extra: ' +
  '{"nivel":"limpio|advertencia|eliminar|expulsar","razon":"frase corta"} ' +
  'Niveles: limpio=normal, advertencia=groseria leve, eliminar=venta/remesa/pasaje/publicidad, expulsar=spam masivo/acoso/amenaza/ilegal';

function parseRespuesta(raw) {
  if (!raw) return null;
  const match = raw.match(/\{[^}]+\}/);
  if (!match) return null;
  try {
    const p = JSON.parse(match[0]);
    if (!['limpio','advertencia','eliminar','expulsar'].includes(p.nivel)) return null;
    return p;
  } catch { return null; }
}

export async function analizarTextoIA(texto) {
  if (!AI_KEY || !AI_URL || !texto || texto.trim().length < 4) return null;
  try {
    const res = await fetch(AI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + AI_KEY },
      body: JSON.stringify({
        model: MDL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: 'Analiza este mensaje del grupo: "' + texto + '"' }
        ],
        max_tokens: 80, temperature: 0.1
      }),
      signal: AbortSignal.timeout(12000)
    });
    if (!res.ok) throw new Error('API error ' + res.status);
    const data = await res.json();
    const resultado = parseRespuesta(data.choices?.[0]?.message?.content?.trim());
    console.log('[Simon/IA texto] resultado=' + JSON.stringify(resultado) + ' texto="' + texto.substring(0,60) + '"');
    return resultado;
  } catch (err) {
    console.error('[Simon/IA texto] ERROR:', err.message);
    return null;
  }
}

export async function analizarImagenIA(msg) {
  if (!OR_KEY) { console.log('[Simon/IA imagen] Sin OPENROUTER_API_KEY'); return null; }
  try {
    console.log('[Simon/IA imagen] Descargando imagen...');
    const buffer = await downloadMediaMessage(msg, 'buffer', {});
    const b64  = buffer.toString('base64');
    const mime = msg.message?.imageMessage?.mimetype || 'image/jpeg';
    console.log('[Simon/IA imagen] Imagen descargada, size=' + buffer.length + ' bytes, model=' + VMDL);

    const res = await fetch(OR_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + OR_KEY,
        'HTTP-Referer': 'https://github.com/simon-bot',
        'X-Title': 'Simon Bot'
      },
      body: JSON.stringify({
        model: VMDL,
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: 'data:' + mime + ';base64,' + b64 } },
            { type: 'text', text:
              'Esta imagen fue enviada en un grupo de WhatsApp de venezolanos en Brasil. ' +
              'Contiene publicidad de productos, lista de precios, oferta de ventas de ropa/zapatos/comida, ' +
              'servicios de remesas o tasas de cambio, oferta de pasajes aereos, o cualquier contenido comercial? ' +
              'Responde SOLO con JSON: {"esComercial":true,"razon":"descripcion breve"} o {"esComercial":false}'
            }
          ]
        }],
        max_tokens: 150
      }),
      signal: AbortSignal.timeout(20000)
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[Simon/IA imagen] OpenRouter error ' + res.status + ': ' + errText.substring(0,200));
      return null;
    }
    const data = await res.json();
    const raw  = data.choices?.[0]?.message?.content?.trim();
    console.log('[Simon/IA imagen] Respuesta raw: ' + (raw || 'null'));
    const match = raw?.match(/\{[^}]+\}/);
    if (!match) { console.log('[Simon/IA imagen] No se pudo parsear JSON'); return null; }
    const parsed = JSON.parse(match[0]);
    console.log('[Simon/IA imagen] Parsed: esComercial=' + parsed.esComercial + ' razon="' + (parsed.razon||'') + '"');
    if (!parsed.esComercial) return null;
    return { nivel: 'eliminar', razon: 'Imagen comercial: ' + (parsed.razon || '') };
  } catch (err) {
    console.error('[Simon/IA imagen] ERROR:', err.message);
    return null;
  }
}
