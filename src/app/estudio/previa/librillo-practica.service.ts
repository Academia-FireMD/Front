import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ContextoPdfLibrillo } from './librillo-contexto-pdf.service';

export type TipoPracticaLibrillo = 'test' | 'flashcards';
export type ModoPracticaLibrillo = 'practica' | 'simulacro';
export type AlcancePracticaLibrillo = 'tema' | 'pagina';
export type RepasoLibrillo = 'todo' | 'fallos' | 'dudas';
export type SegundosPorPreguntaLibrillo = 0 | 45 | 60;
export type PenalizacionLibrillo = 0 | 2 | 3 | 4;

export interface OrigenPracticaLibrillo extends Partial<ContextoPdfLibrillo> {
  temaId: number;
  modo: ModoPracticaLibrillo;
  alcance: AlcancePracticaLibrillo;
  penalizacion?: PenalizacionLibrillo;
}

export interface ReferenciaPracticaLibrillo {
  id: number;
  pagina: number;
  preguntaId?: number;
  flashcardId?: number;
}

export interface IntentoPendienteLibrillo {
  id: number;
  origenLibrillo?: OrigenPracticaLibrillo;
}

export interface IntentoPracticaLibrillo extends IntentoPendienteLibrillo {
  origenLibrillo: OrigenPracticaLibrillo;
}

export interface ConflictoPracticaLibrillo extends IntentoPendienteLibrillo {
  codigo: 'intento_pendiente';
  temas: number[];
  coincide: boolean;
  reemplazable: boolean;
}

interface ProgresoPracticaLibrillo {
  preguntas: { total: number; vistas: number; acertadas: number };
  tarjetas: { total: number; vistas: number; dominadas: number };
}

export interface ResumenPracticaLibrillo {
  test: number;
  flashcards: number;
  testPagina: number;
  flashcardsPagina: number;
  pendientes?: Record<TipoPracticaLibrillo, IntentoPendienteLibrillo | null>;
  progreso: ProgresoPracticaLibrillo;
  progresoPagina: ProgresoPracticaLibrillo | null;
  referencias: ReferenciaPracticaLibrillo[];
}

export interface ConfiguracionPracticaLibrillo extends Partial<ContextoPdfLibrillo> {
  modo: ModoPracticaLibrillo;
  alcance: AlcancePracticaLibrillo;
  repaso: RepasoLibrillo;
  cantidad: number;
  segundosPorPregunta?: SegundosPorPreguntaLibrillo;
  penalizacion?: PenalizacionLibrillo;
  reemplazarPendienteId?: number;
}

export interface ConteoTestLibrillo {
  aciertos: number;
  fallos: number;
  blancas: number;
}

export interface ResultadoPracticaLibrillo extends ConteoTestLibrillo {
  total: number;
  nota: number | null;
}

export type SesionHistorialLibrillo = {
  id: number;
  fecha: string;
  mixto: boolean;
  total: number;
} & (
  | ConteoTestLibrillo
  | { aprendidas: number; paraRepasar: number; dificultad: number }
);

export interface HistorialPracticaLibrillo {
  items: SesionHistorialLibrillo[];
  siguienteCursor: number | null;
}

@Injectable({ providedIn: 'root' })
export class LibrilloPracticaService {
  private readonly http = inject(HttpClient);

  resumen(
    temaId: number,
    pdf: ContextoPdfLibrillo | null,
  ): Observable<ResumenPracticaLibrillo> {
    return this.http
      .get<ResumenPracticaLibrillo>(this.url(temaId), {
        withCredentials: true,
        params: pdf ? { ...pdf } : {},
      })
      .pipe(timeout(15000));
  }

  iniciar(
    temaId: number,
    tipo: TipoPracticaLibrillo,
    configuracion: ConfiguracionPracticaLibrillo,
  ): Observable<IntentoPracticaLibrillo> {
    return this.http
      .post<IntentoPracticaLibrillo>(
        this.url(temaId) + '/' + tipo,
        configuracion,
        { withCredentials: true },
      )
      .pipe(timeout(15000));
  }

  resultado(temaId: number, id: number): Observable<ResultadoPracticaLibrillo> {
    return this.http
      .get<ResultadoPracticaLibrillo>(
        this.url(temaId) + '/test/' + id + '/resultado',
        { withCredentials: true },
      )
      .pipe(timeout(15000));
  }

  historial(temaId: number, tipo: TipoPracticaLibrillo, cursor: number | null) {
    return this.http
      .get<HistorialPracticaLibrillo>(this.url(temaId) + '/historial', {
        withCredentials: true,
        params: cursor === null ? { tipo } : { tipo, cursor },
      })
      .pipe(timeout(15000));
  }

  private url(temaId: number) {
    return environment.apiUrl + '/librillos/temas/' + temaId + '/practica';
  }
}
