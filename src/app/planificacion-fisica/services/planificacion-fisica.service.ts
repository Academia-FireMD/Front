import { HttpClient, HttpParams } from '@angular/common/http';
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

/**
 * Semana de la vista de BLOQUE COMPLETO (`GET /mi-plan-completo`): añade
 * `enVentana` para saber qué días son navegables al detalle (`/dia/:fecha`
 * rechaza con 403 cualquier día fuera de la ventana de 4 semanas — la vista
 * completa es solo visión global, no relaja esa restricción).
 */
export interface SemanaCalendarioCompleta extends SemanaCalendario {
  enVentana: boolean;
}

export interface MiPlanCompleto extends Omit<MiPlan, 'semanas'> {
  semanas: SemanaCalendarioCompleta[];
}

/**
 * Opción del selector multi-oposición (`GET /mis-bloques`, Fase 2 switcher):
 * un bloque que le aplica al alumno. Cuando tiene más de uno (ej. bloque
 * específico de Valencia + bloque específico de Madrid) puede elegir cuál
 * ver; con uno solo (v1) el componente no muestra selector. `esActivo`
 * marca el que se ve por defecto (el más específico, mismo criterio que
 * `GET /mi-plan` sin `bloqueId`).
 */
export interface BloqueOpcion {
  id: number;
  identificador: string;
  relevancia: Oposicion[];
  esActivo: boolean;
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

/**
 * Disciplina resumida de un día, para el "bridge" temario↔física: la
 * indicación ("🏋️ Cuerda 2, Carrera 2") que se pinta en el calendario del
 * temario del alumno. Solo trae lo mínimo para pintar la indicación — el
 * detalle completo se carga en `/dia/:fecha` al navegar desde ahí.
 */
export interface DisciplinaResumenDia {
  nombre: string;
  grupo: GrupoDisciplina;
  color: string;
  /** Estado hecho del alumno sobre esa disciplina (rediseño 2026-07-22 del
   * bridge a sub-bloque vinculado): permite al temario derivar el estado del
   * bloque de entrenamiento sin llamadas extra. */
  realizado: boolean;
}

export interface ResumenDiaFisica {
  fecha: string;
  disciplinas: DisciplinaResumenDia[];
}

/**
 * Marca personal del alumno en una prueba física (Task "marcas", Fase 2):
 * su propio histórico de resultados (mejor tiempo, repeticiones...), NO
 * ligado a ningún bloque/semana de la planificación del entrenador — de ahí
 * que no lleve `asignacionId`. Ordenadas por el backend `disciplinaId asc,
 * fecha desc` (`GET /marcas`); el front decide si las agrupa visualmente.
 */
export interface MarcaPersonal {
  id: number;
  disciplinaId: number;
  disciplinaNombre: string;
  grupo: GrupoDisciplina;
  color: string;
  valor: number;
  unidad: string;
  fecha: string;
  notas: string | null;
}

/**
 * Prueba (disciplina) del catálogo global, para poblar el selector al
 * añadir una marca personal (`GET /planificacion-fisica/disciplinas`). A
 * diferencia de `DetalleDisciplina`/`ChipDisciplina` (ligadas a un
 * bloque/plan concreto), esto es el catálogo COMPLETO — no depende de que
 * el alumno tenga plan asignado ni marcas previas.
 */
export interface DisciplinaCatalogo {
  id: number;
  nombre: string;
  grupo: GrupoDisciplina;
  color: string;
}

/**
 * Body de `POST /planificacion-fisica/marcas`. `alumnoId` NUNCA viaja aquí
 * — el backend lo saca siempre de `req.user.id` (mismo criterio anti-IDOR
 * que el resto del módulo).
 */
export interface CrearMarcaDto {
  disciplinaId: number;
  valor: number;
  unidad: string;
  /** ISO "YYYY-MM-DD". */
  fecha: string;
  notas?: string;
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
   *
   * `bloqueId` (opcional, Fase 2 switcher multi-oposición): pide el
   * calendario de ESE bloque en vez del más específico por defecto. El
   * backend valida que sea uno de los aplicables al alumno — si no, cae en
   * silencio al de siempre, así que este método nunca necesita validar
   * nada del lado del cliente.
   */
  miPlan(bloqueId?: number): Observable<MiPlan | null> {
    const params =
      bloqueId != null ? new HttpParams().set('bloqueId', bloqueId) : undefined;
    return this.http.get<MiPlan | null>(`${this.base}/mi-plan`, { params });
  }

  /**
   * Vista de BLOQUE COMPLETO (todas las semanas del bloque, sin recorte de
   * ventana) para la pantalla "Ver bloque completo". Mismo contrato y gating
   * que `miPlan` (403 `TIER_TOO_LOW` como estado de UI); cada semana trae
   * `enVentana` para que la vista solo deje navegar al detalle los días que
   * el backend aceptaría.
   */
  miPlanCompleto(bloqueId?: number): Observable<MiPlanCompleto | null> {
    const params =
      bloqueId != null ? new HttpParams().set('bloqueId', bloqueId) : undefined;
    return this.http.get<MiPlanCompleto | null>(
      `${this.base}/mi-plan-completo`,
      { params },
    );
  }

  /**
   * Lista de bloques que le aplican al alumno (Fase 2 switcher
   * multi-oposición), para poblar el selector. El componente decide si lo
   * muestra (solo si hay más de uno).
   */
  misBloques(): Observable<BloqueOpcion[]> {
    return this.http.get<BloqueOpcion[]>(`${this.base}/mis-bloques`);
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

  /**
   * Resumen de entrenamiento físico por día (fechas ISO "YYYY-MM-DD"), para
   * el "bridge" que se pinta en el calendario del temario. `[]` (NUNCA 403)
   * cuando el alumno no tiene bloque activo que le aplique — el llamador
   * debe tratar cualquier fallo (red, 5xx) como "sin indicación de física",
   * nunca como error que bloquee el calendario del temario.
   */
  resumenDias(desde: string, hasta: string): Observable<ResumenDiaFisica[]> {
    const params = new HttpParams().set('desde', desde).set('hasta', hasta);
    return this.http.get<ResumenDiaFisica[]>(`${this.base}/resumen-dias`, {
      params,
    });
  }

  /**
   * Marcas del propio alumno en pruebas físicas. Mismo gate 403
   * `TIER_TOO_LOW` que `miPlan()`/`dia()` — el componente lo trata como
   * estado de UI (píldora de upsell), no como error a tragar.
   */
  marcas(): Observable<MarcaPersonal[]> {
    return this.http.get<MarcaPersonal[]>(`${this.base}/marcas`);
  }

  crearMarca(dto: CrearMarcaDto): Observable<MarcaPersonal> {
    return this.http.post<MarcaPersonal>(`${this.base}/marcas`, dto);
  }

  borrarMarca(id: number): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(`${this.base}/marcas/${id}`);
  }

  /**
   * Catálogo completo de pruebas (disciplinas) para poblar el selector al
   * añadir una marca personal. Es GLOBAL — no depende del plan/bloque ni
   * de las marcas previas del alumno, así que un alumno sin plan asignado
   * ni marcas registradas también tiene opciones para su primera marca.
   * Mismo gate 403 `TIER_TOO_LOW` que `marcas()`/`miPlan()`.
   */
  catalogoDisciplinas(): Observable<DisciplinaCatalogo[]> {
    return this.http.get<DisciplinaCatalogo[]>(`${this.base}/disciplinas`);
  }
}
