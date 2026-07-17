import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Oposicion } from '../../shared/models/subscription.model';

export interface ErrorImport {
  hoja: string;
  fila: number;
  motivo: string;
}

export interface ResumenImport {
  identificador: string;
  numSemanas: number;
  totalAsignaciones: number;
  totalDetalles: number;
  relevancia: Oposicion[];
}

export interface PreviewImportResponse {
  resumen: ResumenImport | null;
  errores: ErrorImport[];
}

export interface ImportResponse {
  bloqueId: number;
  errores: ErrorImport[];
}

export type EstadoBloque = 'BORRADOR' | 'PUBLICADO';

export interface BloqueEntrenamiento {
  id: number;
  identificador: string;
  comentarioGeneral: string | null;
  fechaInicioSemana1: string;
  numSemanas: number;
  relevancia: Oposicion[];
  estado: EstadoBloque;
  _count: { semanas: number };
}

/**
 * Cuerpo real del error 409 de `DELETE /planificacion-fisica/bloques/:id`
 * cuando el bloque tiene progreso de alumnos registrado. Repetir la
 * petición con `?force=true` para borrar de todas formas.
 */
export interface EliminarBloqueConProgreso {
  message: string;
  progreso: number;
  confirmar: boolean;
}

/**
 * Grupo de una disciplina. Determina el color con el que se pinta en la
 * parrilla (igual que en el Excel del entrenador). Conjunto cerrado —
 * definido en el backend, replicado aquí como unión literal.
 */
export type GrupoDisciplina =
  | 'CUERDA'
  | 'CARRERA'
  | 'NATACION'
  | 'PRESS'
  | 'FUERZA'
  | 'ESCALERAS'
  | 'DESCANSO'
  | 'TEST';

/** Colores fijos por grupo de disciplina, replicados del backend. */
export const GRUPO_DISCIPLINA_COLORES: Record<GrupoDisciplina, string> = {
  CUERDA: '#9fe2d0',
  CARRERA: '#fdeaa8',
  NATACION: '#a9d3f0',
  PRESS: '#c9c0ec',
  FUERZA: '#f4b8b8',
  ESCALERAS: '#ef8a7f',
  DESCANSO: '#ffffff',
  TEST: '#b6e3b6',
};

/**
 * Un "hueco" de la parrilla: una disciplina asignada a una semana concreta.
 * El entrenador sube la parrilla por Excel (qué disciplina toca cada día);
 * el `contenido` (texto de los ejercicios) se escribe DESPUÉS aquí, en la
 * plataforma — por eso puede venir `null`/`vacio: true`.
 */
export interface DetalleDisciplina {
  id: number;
  disciplinaId: number;
  disciplinaNombre: string;
  grupo: GrupoDisciplina;
  contenido: string | null;
  comentario: string | null;
  vacio: boolean;
}

export interface SemanaConDetalles {
  semanaId: number;
  indice: number;
  numeroAno: number;
  comentarioSemana: string | null;
  detalles: DetalleDisciplina[];
}

/**
 * Un "chip" de disciplina dentro de un día del calendario del alumno
 * (`GET /mi-plan`). Trae ya el color resuelto por el backend — el frontend
 * NO recalcula el color a partir del grupo, solo lo pinta.
 */
export interface ChipDisciplina {
  disciplinaId: number;
  nombre: string;
  grupo: GrupoDisciplina;
  color: string;
  realizado: boolean;
}

export interface DiaCalendario {
  fecha: string;
  /** 1..7, Lunes..Domingo. */
  diaSemana: number;
  chips: ChipDisciplina[];
}

export interface ProgresoSemana {
  hechas: number;
  total: number;
}

export interface SemanaCalendario {
  id: number;
  indice: number;
  numeroAno: number;
  fechaInicio: string;
  /** 0-100. Más intensidad = tono de fondo más oscuro en la rejilla. */
  intensidad: number;
  comentarioSemana: string | null;
  esActual: boolean;
  esAnterior: boolean;
  /** Semana anterior: solo lectura, no se puede marcar progreso. */
  soloLectura: boolean;
  dias: DiaCalendario[];
  progreso: ProgresoSemana;
}

/**
 * Bloque tal y como lo ve el alumno en `GET /mi-plan`. Mismos campos base
 * que `BloqueEntrenamiento` (vista admin) pero sin `_count` — no aplica en
 * esta vista.
 */
export interface BloquePlanAlumno {
  id: number;
  identificador: string;
  comentarioGeneral: string | null;
  fechaInicioSemana1: string;
  numSemanas: number;
  relevancia: Oposicion[];
  estado: EstadoBloque;
}

export interface MiPlan {
  bloque: BloquePlanAlumno;
  semanas: SemanaCalendario[];
  /** Fecha ISO ("2026-07-17") del día de hoy, según el backend — no `new Date()` del cliente. */
  hoy: string;
}

export interface DisciplinaDia {
  asignacionId: number;
  disciplinaId: number;
  nombre: string;
  grupo: GrupoDisciplina;
  color: string;
  contenido: string | null;
  comentario: string | null;
  realizado: boolean;
}

export interface DiaDetalle {
  fecha: string;
  comentarioSemana: string | null;
  comentarioGeneral: string | null;
  disciplinas: DisciplinaDia[];
}

export interface ProgresoActualizado {
  realizado: boolean;
  realizadoEn: string | null;
}

/**
 * Cuerpo real del 403 que devuelven `GET /mi-plan` y `GET /dia/:fecha`
 * cuando el alumno es BASIC (espejo del patrón de
 * `ai-assistant-widget.component.ts` — mismo `reason`/`requiredTier`).
 */
export interface AccesoDenegadoPlanFisica {
  reason: 'TIER_TOO_LOW';
  requiredTier: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class PlanificacionFisicaService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/planificacion-fisica`;

  preview(file: File): Observable<PreviewImportResponse> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<PreviewImportResponse>(`${this.base}/preview`, fd);
  }

  importar(file: File): Observable<ImportResponse> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<ImportResponse>(`${this.base}/import`, fd);
  }

  listarBloques(): Observable<BloqueEntrenamiento[]> {
    return this.http.get<BloqueEntrenamiento[]>(`${this.base}/bloques`);
  }

  publicar(id: number): Observable<BloqueEntrenamiento> {
    return this.http.put<BloqueEntrenamiento>(
      `${this.base}/bloques/${id}/publicar`,
      {},
    );
  }

  eliminar(id: number, force = false): Observable<void> {
    const params = force ? '?force=true' : '';
    return this.http.delete<void>(`${this.base}/bloques/${id}${params}`);
  }

  descargarPlantillaUrl(): string {
    return `${this.base}/plantilla`;
  }

  detallesDeBloque(bloqueId: number): Observable<SemanaConDetalles[]> {
    return this.http.get<SemanaConDetalles[]>(
      `${this.base}/bloques/${bloqueId}/detalles`,
    );
  }

  actualizarDetalle(
    id: number,
    body: { contenido?: string; comentario?: string },
  ): Observable<unknown> {
    return this.http.put<unknown>(`${this.base}/detalles/${id}`, body);
  }

  /**
   * Calendario de 4 semanas del alumno para su oposición. `null` cuando no
   * hay plan publicado que le aplique. 403 `TIER_TOO_LOW` cuando su
   * suscripción no llega — el componente lo trata como estado de UI
   * (píldora de upsell), no como error a tragar.
   */
  miPlan(): Observable<MiPlan | null> {
    return this.http.get<MiPlan | null>(`${this.base}/mi-plan`);
  }

  /** Detalle de un día concreto (`fecha` ISO, ej. "2026-07-15"). */
  dia(fecha: string): Observable<DiaDetalle> {
    return this.http.get<DiaDetalle>(`${this.base}/dia/${fecha}`);
  }

  marcarProgreso(
    asignacionId: number,
    realizado: boolean,
  ): Observable<ProgresoActualizado> {
    return this.http.put<ProgresoActualizado>(
      `${this.base}/progreso/${asignacionId}`,
      { realizado },
    );
  }
}
