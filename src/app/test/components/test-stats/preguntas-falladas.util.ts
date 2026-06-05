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
