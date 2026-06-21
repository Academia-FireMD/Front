import { Pregunta } from '../../../shared/models/pregunta.model';
import { EstadoPregunta, Test } from '../../../shared/models/test.model';

export interface PreguntaFallada {
  id: number;
  descripcion: string;
  correcta: string;
  tema: string;
}

export function extraerPreguntasFalladas(
  test: Test | undefined,
): PreguntaFallada[] {
  if (!test?.preguntas || !test?.respuestas) return [];
  const falladasIds = new Set(
    test.respuestas
      .filter((r) => r.estado === EstadoPregunta.RESPONDIDA && !r.esCorrecta)
      .map((r) => r.preguntaId),
  );
  return test.preguntas
    .filter((p) => falladasIds.has(p.id))
    .map((p) => ({
      id: p.id,
      descripcion: p.descripcion,
      correcta: p.respuestas?.[p.respuestaCorrectaIndex] ?? '',
      tema: p.tema?.descripcion ?? '',
    }));
}

export function construirMensajePregunta(pregunta: Pregunta): string {
  const opciones = (pregunta.respuestas ?? [])
    .map((r, i) => `${String.fromCharCode(97 + i)}) ${r}`)
    .join('\n');
  const correcta = pregunta.respuestas?.[pregunta.respuestaCorrectaIndex] ?? '';
  const tema = pregunta.tema?.descripcion ?? '';
  return (
    'Quiero memorizar la respuesta correcta de esta pregunta de test para el examen.\n\n' +
    `Pregunta: ${pregunta.descripcion}\n` +
    (opciones ? `Opciones:\n${opciones}\n` : '') +
    `Respuesta correcta: ${correcta}` +
    (tema ? `\nTema: ${tema}` : '') +
    `\n\nMóntame una nemotécnica para recordar que la respuesta correcta es "${correcta}". Usa SOLO esa respuesta correcta; no la cambies ni elijas otra.`
  );
}

export function construirMensajeFallos(falladas: PreguntaFallada[]): string {
  if (!falladas.length) return '';
  const lista = falladas
    .map(
      (f, i) =>
        `${i + 1}. ${f.descripcion} (respuesta correcta: ${f.correcta}${f.tema ? `, tema: ${f.tema}` : ''})`,
    )
    .join('\n');
  return `Acabo de fallar estas preguntas en un test y quiero memorizarlas para que no me vuelva a pasar. ¿Me montas una nemotécnica para cada una?\n\n${lista}`;
}
