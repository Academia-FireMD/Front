import { presentacionHidraulicaIntegrada } from '../cursos/ui/hidraulica-presentacion.util';
import { adaptarPsico } from '../psicotecnicos/psico-adaptador';
import { ConfigFrame } from './estudio-frame-runtime';
import bridge from './estudio-bridge.frame';
import { colorSuperficie, reglasTemaEstudio } from './estudio-tema';
import { PSICO_PRESENTACION } from './estudio-presentacion';

const CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; base-uri 'none'; form-action 'none'";

export function prepararDocumentoEstudio(
  html: string,
  config: ConfigFrame,
  imagenes: Record<string, string>,
): string {
  const documento = adaptarPsico(html);
  if (!/<head\s*>/i.test(documento) || !/<\/head\s*>/i.test(documento))
    throw new Error('El visor no recibió un documento completo');
  const params = JSON.stringify(config).replaceAll('<', '\\u003c');
  const tema = presentacionHidraulicaIntegrada().tema;
  // Tokens de plataforma validados por la misma utilidad que Hidráulica.
  const marca = tema?.primario;
  const imagenesJson = JSON.stringify(imagenes).replaceAll('<', '\\u003c');
  const css = `
    :root { --hd: ${tema?.fuente}; --bd: ${tema?.fuente}; }
    @media screen {
      :root {
        --primary-color: ${marca}; --secondary-color: ${colorSuperficie('--secondary-color', '#a72122')}; --primary-color-text: ${colorSuperficie('--primary-color-text', '#fff')};
        --campus-fondo: ${colorSuperficie('--surface-ground', '#f4f6f8')}; --campus-superficie: ${colorSuperficie('--surface-card', '#fff')}; --campus-suave: ${colorSuperficie('--surface-100', '#f4f6f8')};
        --campus-texto: ${tema?.texto}; --campus-secundario: ${tema?.textoSecundario}; --campus-borde: ${tema?.borde};
        --campus-accion: ${marca}; --campus-acento: ${marca};
      }
      :focus-visible { outline: 2px solid var(--campus-acento); outline-offset: 2px; }
      @media (max-width: 560px) { .alias { display: flex; flex-wrap: wrap; } .alias input { min-width: 0; max-width: 100%; } }
      ${reglasTemaEstudio()}
      ${PSICO_PRESENTACION}
    }
  `;
  return documento
    .replace(/<link\b[^>]*fonts\.(?:googleapis|gstatic)\.com[^>]*>/gi, '')
    .replace(
      /<head\s*>/i,
      () =>
        `<head><meta http-equiv="Content-Security-Policy" content="${CSP}"><meta name="referrer" content="no-referrer"><script>${bridge}\nwindow.TF_ESTUDIO=iniciarPuenteEstudio(${params});window.TF_PERFILES_IMAGENES=${imagenesJson};</script>`,
    )
    .replace(/<\/head\s*>/i, () => `<style>${css}</style></head>`);
}
