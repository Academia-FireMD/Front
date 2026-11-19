import { presentacionHidraulicaIntegrada } from '../cursos/ui/hidraulica-presentacion.util';
import { adaptarPsico } from '../psicotecnicos/psico-adaptador';
import { adaptarLibrillo } from '../documentacion/librillo-adaptador';
import { RecursoEstudio } from './estudio-api.service';
import { ConfigFrame } from './estudio-frame-runtime';
import bridge from './estudio-bridge.frame';
import {
  LIBRILLO_PRESENTACION,
  PSICO_PRESENTACION,
} from './estudio-presentacion';

const CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; base-uri 'none'; form-action 'none'";

export function prepararDocumentoEstudio(
  html: string,
  recurso: RecursoEstudio,
  config: ConfigFrame,
): string {
  const documento =
    recurso.tipo === 'psico' ? adaptarPsico(html) : adaptarLibrillo(html);
  if (!/<head\s*>/i.test(documento) || !/<\/head\s*>/i.test(documento))
    throw new Error('El visor no recibió un documento completo');
  const params = JSON.stringify(config).replaceAll('<', '\\u003c');
  const tema = presentacionHidraulicaIntegrada().tema;
  // Tokens de plataforma validados por la misma utilidad que Hidráulica.
  const marca = `color-mix(in srgb, ${tema?.primario} 74%, #171717)`;
  const css = `
    :root { --hd: ${tema?.fuente}; --bd: ${tema?.fuente}; --f-display: ${tema?.fuente}; --f-body: ${tema?.fuente}; }
    @media screen {
      :root {
        --campus-fondo: #fff; --campus-superficie: #fff; --campus-suave: #f4f6f8;
        --campus-texto: ${tema?.texto}; --campus-secundario: ${tema?.textoSecundario}; --campus-borde: ${tema?.borde};
        --campus-accion: ${marca}; --campus-acento: ${marca};
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --campus-fondo: #171a20; --campus-superficie: #22262e; --campus-suave: #30353e;
          --campus-texto: #f0f2f5; --campus-secundario: #bdc4cf; --campus-borde: #494e58;
          --campus-acento: color-mix(in srgb, ${marca}, white 44%);
        }
      }
      :focus-visible { outline: 2px solid var(--campus-acento); outline-offset: 2px; }
      @media (max-width: 560px) { .alias { display: flex; flex-wrap: wrap; } .alias input { min-width: 0; max-width: 100%; } }
      ${recurso.tipo === 'psico' ? PSICO_PRESENTACION : LIBRILLO_PRESENTACION}
    }
  `;
  return documento
    .replace(/<link\b[^>]*fonts\.(?:googleapis|gstatic)\.com[^>]*>/gi, '')
    .replace(
      /<head\s*>/i,
      () =>
        `<head><meta http-equiv="Content-Security-Policy" content="${CSP}"><meta name="referrer" content="no-referrer"><script>${bridge}\nwindow.TF_ESTUDIO=iniciarPuenteEstudio(${params});</script>`,
    )
    .replace(/<\/head\s*>/i, () => `<style>${css}</style></head>`);
}
