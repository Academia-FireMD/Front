import {
  Component,
  computed,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  OnDestroy,
  Output,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  CalendarEvent,
  CalendarEventTimesChangedEvent,
  CalendarView,
} from 'angular-calendar';
import { cloneDeep, debounce } from 'lodash';
import { Memoize } from 'lodash-decorators';
import { ToastrService } from 'ngx-toastr';
import { ContextMenu } from 'primeng/contextmenu';
import { map, Subject } from 'rxjs';
import {
  DisciplinaResumenDia,
  ResumenDiaFisica,
} from '../../planificacion-fisica/services/planificacion-fisica.service';
import { PlanificacionesService } from '../../services/planificaciones.service';
import {
  PlanificacionBloque,
  SubBloque,
} from '../../shared/models/planificacion.model';
import {
  formatFechaISO,
  getDateForDayOfWeek,
  getStartOfWeek,
} from '../../utils/utils';
import { EventsService } from '../services/events.service';
import { colors } from './calendar-colors';
import { COLORES_TIPO_SUBBLOQUE } from '../sub-bloque-colores';

interface ProgresoDiaIndex {
  completados: number;
  porcentaje: number;
  color: string;
}

interface FisicaDiaIndex {
  resumen: ResumenDiaFisica;
  hechas: number;
  total: number;
  etiqueta: string;
  /** Contexto completo en texto plano para tarjetas recortadas (tooltip). */
  contexto: string;
}

@Component({
  selector: 'app-vista-semanal',
  templateUrl: './vista-semanal.component.html',
  styleUrl: './vista-semanal.component.scss',
})
export class VistaSemanalComponent implements OnDestroy {
  planificacionesService = inject(PlanificacionesService);
  eventsService = inject(EventsService);
  public searchTerm = signal('');
  @Input() role: 'ADMIN' | 'ALUMNO' = 'ALUMNO';

  refresh = new Subject<void>();
  private readonly pendingProgressIds = new Set<string>();
  /** Estado optimista por clave para reaplicarlo si el padre refresca eventos. */
  private readonly pendingProgressEstados = new Map<
    string,
    { anterior: boolean; nuevo: boolean }
  >();
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  /** Modo explícito: sólo mientras está activo se puede escribir progreso. */
  modoMarcadoProgreso = false;

  // Propiedad para almacenar el evento seleccionado
  selectedEvent: CalendarEvent | null = null;

  /* ── Panel inferior de detalle del evento ──────────────────────────────
   * Una única vía de apertura para tarjetas normales, físicas y personales.
   * La tarjeta no navega ni abre editores: sólo muestra el resumen. */
  isEventSheetVisible = false;
  eventoSheet: CalendarEvent | null = null;
  comentarioBorrador = '';
  isConfirmandoBorrado = false;

  private sheetTriggerElement: HTMLElement | null = null;
  private pendingEditorEvent: CalendarEvent | null = null;
  private readonly comentariosPendientes = new Set<number>();
  private readonly borradoresComentario = new Map<number, string>();
  private readonly erroresComentario = new Map<number, string>();
  private readonly eliminacionesPendientes = new Set<string>();
  private comentarioFeedbackId: number | null = null;

  /** Guard de gesto: el click posterior a un drag/scroll no abre el panel. */
  private readonly umbralGestoPx = 6;
  private gesturePointerId: number | null = null;
  private gestureStartX = 0;
  private gestureStartY = 0;
  private gestureMoved = false;
  private gestureCancelled = false;
  private suppressNextClick = false;
  private escuchaScrollGestoActiva = false;
  private readonly onScrollDuranteGesto = () => {
    if (this.gesturePointerId !== null) {
      this.gestureCancelled = true;
    }
  };

  /** Bloqueo del scroll del contenedor del calendario mientras el panel está abierto. */
  private scrollLockElement: HTMLElement | null = null;
  private scrollLockPreviousOverflow = '';
  public editSubBloqueData!: SubBloque;
  activeDayIsOpen = false;
  view = CalendarView.Month;
  public isDialogVisible: boolean = false;
  public seleccionandoBloquesAsignables = false;
  @Input() public set events(data: CalendarEvent[]) {
    const eventos = data ?? [];
    eventos.forEach((e) => {
      if (this.mode == 'edit') e.draggable = true;
    });
    this._events = eventos;
    this.actualizarProyeccionCalendario();
    this.reaplicarProgresoPendiente();
    this.rebuildEventIndexes();
    this.sincronizarEventoSheet();
  }
  public get events() {
    return this._events;
  }

  /**
   * Copia de sólo lectura para angular-calendar. En modo de marcado suspende
   * drag/resize en la proyección, sin tocar los flags reales del padre.
   */
  public get eventsParaCalendario(): CalendarEvent[] {
    return this._eventosParaCalendario;
  }

  private _events: CalendarEvent[] = [];
  private _eventosParaCalendario: CalendarEvent[] = [];
  /** Índice O(1) por fecha local: la plantilla consulta cada día muchas veces. */
  private readonly eventosPorDia = new Map<string, CalendarEvent[]>();
  private readonly progresoPorDia = new Map<string, ProgresoDiaIndex>();
  private readonly fisicaPorDia = new Map<string, FisicaDiaIndex>();
  @Output() eventsChange = new EventEmitter<CalendarEvent[]>();
  @Output() saveChanges = new EventEmitter<void>();

  private _viewDate = new Date();
  @Input()
  set viewDate(value: Date) {
    // Validar que la fecha sea válida
    if (value && value instanceof Date && !isNaN(value.getTime())) {
      this._viewDate = value;
    } else {
      console.warn('Invalid viewDate provided, using current date');
      this._viewDate = new Date();
    }
    // La semana visible también invalida los índices: cualquier caché de
    // presentación ligada a la vista debe recalcularse al navegar.
    this.rebuildEventIndexes();
  }

  get viewDate(): Date {
    return this._viewDate;
  }

  @Input() mode: 'picker' | 'edit' = 'edit';
  /**
   * Bridge temario↔física (Task Sergio): resumen de entrenamiento físico
   * por día, para pintar una indicación en la cabecera del día ("🏋️ Cuerda
   * 2, Carrera 2") que navega a `/app/planificacion-fisica/dia/:fecha`.
   * Deliberadamente NO se mezcla con `events` (CalendarEvent[]): ese array
   * alimenta `guardarCambios()` → `fromEventsToSubbloques()` (se persiste
   * en el backend) y `getProgressPercentageForDay()` (barra de progreso del
   * temario) — un evento de física ahí falsearía ambas cosas. Este input es
   * un canal aparte, puramente aditivo: si viene vacío (bloque BASIC, sin
   * bloque activo, o fallo al cargar el bridge) simplemente no se pinta
   * nada, el resto del calendario sigue funcionando igual.
   */
  private _resumenFisica: ResumenDiaFisica[] = [];
  @Input() set resumenFisica(value: ResumenDiaFisica[] | null | undefined) {
    this._resumenFisica = value ?? [];
    this.rebuildFisicaIndex();
  }

  get resumenFisica(): ResumenDiaFisica[] {
    return this._resumenFisica;
  }
  /** Plan de temario que originó el bridge, para recuperar una URL física obsoleta. */
  @Input() originPlanificacionId: number | undefined;
  private onTimeClickedDate!: Date;
  public triggerSaveUpdateProgress = new Subject();
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  @Memoize()
  getMenuItems(role: 'ADMIN' | 'ALUMNO') {
    const addNewPersonalizado = {
      label: 'Añadir evento personal',
      icon: 'pi pi-plus-circle',
      command: () => {
        this.selectedEvent = null;
        const nuevoEvento = {
          id: undefined,
          horaInicio: this.onTimeClickedDate,
          duracion: 60,
          nombre: '',
          descripcion: '',
          color: '#4caf50', // Color diferente para distinguir
          planificacionId: Number(
            this.activatedRoute?.snapshot?.paramMap?.get('id'),
          ),
        };

        this.selectedEvent = {
          title: nuevoEvento.nombre,
          start: this.onTimeClickedDate,
          draggable: true,
          end: new Date(
            this.onTimeClickedDate.getTime() + nuevoEvento.duracion * 60000,
          ),
          color: {
            primary: nuevoEvento.color,
            secondary: nuevoEvento.color,
          },
          meta: {
            tipo: 'personalizado',
            eventoPersonalizado: nuevoEvento,
          },
        };

        this.editEventoPersonalizadoData = nuevoEvento;
        this.isEventoPersonalizadoDialogVisible = true;
      },
    };

    const addNew = {
      label: 'Añadir nuevo',
      icon: 'pi pi-plus',
      command: () => {
        this.selectedEvent = null;
        const nuevoSubBloque: SubBloque = {
          id: undefined, // Se generará al guardar
          horaInicio: this.onTimeClickedDate, // Usa la fecha/hora seleccionada
          duracion: 60, // Valor predeterminado
          nombre: '',
          comentarios: '',
          color: '#ffffff', // Color predeterminado
        };
        this.selectedEvent = {
          title: nuevoSubBloque.nombre,
          start: this.onTimeClickedDate,
          draggable: true,
          end: new Date(
            this.onTimeClickedDate.getTime() + nuevoSubBloque.duracion * 60000,
          ),
          meta: {
            subBloque: {
              comentarios: nuevoSubBloque.comentarios,
              color: nuevoSubBloque.color,
              duracion: nuevoSubBloque.duracion,
            },
          },
        };
        this.editSubBloqueData = nuevoSubBloque;
        this.isDialogVisible = true;
      },
    };

    const addEntrenamientoFisico = {
      label: 'Añadir entrenamiento físico',
      icon: 'pi pi-bolt',
      command: () => {
        this.selectedEvent = null;
        const nuevoSubBloque: SubBloque = {
          id: undefined,
          horaInicio: this.onTimeClickedDate,
          duracion: 60,
          nombre: 'ENTRENAMIENTO FÍSICO',
          comentarios: '',
          color: COLORES_TIPO_SUBBLOQUE.entrenamiento,
          esEntrenamientoFisico: true,
        };
        this.selectedEvent = {
          title: nuevoSubBloque.nombre,
          start: this.onTimeClickedDate,
          draggable: true,
          end: new Date(
            this.onTimeClickedDate.getTime() + nuevoSubBloque.duracion * 60000,
          ),
          color: {
            primary:
              nuevoSubBloque.color || COLORES_TIPO_SUBBLOQUE.entrenamiento,
            secondary:
              nuevoSubBloque.color || COLORES_TIPO_SUBBLOQUE.entrenamiento,
          },
          meta: { subBloque: { ...nuevoSubBloque } },
        };
        this.editSubBloqueData = nuevoSubBloque;
        this.isDialogVisible = true;
      },
    };

    const aplicarBloqueAsignable = {
      label: 'Aplicar bloque asignable',
      icon: 'pi pi-book',
      command: () => (this.seleccionandoBloquesAsignables = true),
    };

    if (role == 'ADMIN') {
      return [addNew, addEntrenamientoFisico, aplicarBloqueAsignable];
    }

    // Para alumnos, mostrar opción de agregar evento personal
    return [addNewPersonalizado];
  }
  /** Filtra eventos por día. Implementado localmente (no delegado en el
   * servicio) para evitar problemas de `this` en tests con mocks y para que
   * el componente sea autónomo en esta operación pura.
   *
   * Para el array propio del componente la consulta es O(1) sobre el índice
   * por fecha; se conserva el filtrado para arrays externos (tests/otros
   * consumidores) sin cambiar el contrato público. */
  public getEventsForDay(events: CalendarEvent[], date: Date): CalendarEvent[] {
    const clave = this.claveFecha(date);
    if (!clave) return [];
    if (events === this._events) {
      return this.eventosPorDia.get(clave) ?? [];
    }
    return events.filter((event) => this.claveFecha(event.start) === clave);
  }

  /** Progreso de calendario independiente del progreso de las disciplinas físicas. */
  public getProgressBarColor = (
    events: CalendarEvent[],
    date: Date,
  ): string => {
    const clave = this.claveFecha(date);
    if (!clave) return '#dc3545';
    if (events === this._events) {
      return this.progresoPorDia.get(clave)?.color ?? '#dc3545';
    }
    const percentage = this.getProgressPercentageForDay(events, date);
    if (percentage === 100) return '#28a745';
    if (percentage >= 50) return '#ffc107';
    return '#dc3545';
  };

  /** Cuenta las marcas propias de cada evento del calendario. */
  public getCompletedSubBlocksForDay = (
    events: CalendarEvent[],
    date: Date,
  ): number => {
    const clave = this.claveFecha(date);
    if (!clave) return 0;
    if (events === this._events) {
      return this.progresoPorDia.get(clave)?.completados ?? 0;
    }
    return this.getEventsForDay(events, date).filter(
      (event) => event.meta?.subBloque?.realizado,
    ).length;
  };

  public getProgressPercentageForDay = (
    events: CalendarEvent[],
    date: Date,
  ): number => {
    const clave = this.claveFecha(date);
    if (!clave) return 0;
    if (events === this._events) {
      return this.progresoPorDia.get(clave)?.porcentaje ?? 0;
    }
    const eventsForDay = this.getEventsForDay(events, date);
    const completed = this.getCompletedSubBlocksForDay(events, date);
    return Number(
      (eventsForDay.length > 0
        ? (completed / eventsForDay.length) * 100
        : 0
      ).toFixed(2),
    );
  };

  /** Clave de día local reutilizada por todos los índices. */
  private claveFecha(value: Date | string | null | undefined): string | null {
    if (value === null || value === undefined) return null;
    const fecha = value instanceof Date ? value : new Date(value);
    if (isNaN(fecha.getTime())) return null;
    return formatFechaISO(fecha);
  }

  /** Reconstruye los índices de eventos y progreso tras un cambio de datos. */
  private rebuildEventIndexes(): void {
    this.eventosPorDia.clear();
    this.progresoPorDia.clear();
    for (const event of this._events ?? []) {
      const clave = this.claveFecha(event?.start);
      if (!clave) continue;
      const eventosDelDia = this.eventosPorDia.get(clave);
      if (eventosDelDia) {
        eventosDelDia.push(event);
      } else {
        this.eventosPorDia.set(clave, [event]);
      }
    }
    for (const [clave, eventosDelDia] of this.eventosPorDia) {
      this.progresoPorDia.set(clave, this.calcularProgresoDia(eventosDelDia));
    }
  }

  private calcularProgresoDia(
    eventosDelDia: CalendarEvent[],
  ): ProgresoDiaIndex {
    const completados = eventosDelDia.filter(
      (event) => event.meta?.subBloque?.realizado,
    ).length;
    const porcentaje = Number(
      (eventosDelDia.length > 0
        ? (completados / eventosDelDia.length) * 100
        : 0
      ).toFixed(2),
    );
    const color =
      porcentaje === 100 ? '#28a745' : porcentaje >= 50 ? '#ffc107' : '#dc3545';
    return { completados, porcentaje, color };
  }

  /** Invalida solo el día afectado por una marca/desmarca optimista. */
  private recalcularProgresoDia(fecha: Date | string): void {
    const clave = this.claveFecha(fecha);
    if (!clave) return;
    const eventosDelDia = this.eventosPorDia.get(clave) ?? [];
    if (eventosDelDia.length === 0) {
      this.progresoPorDia.delete(clave);
      return;
    }
    this.progresoPorDia.set(clave, this.calcularProgresoDia(eventosDelDia));
  }

  /** Reconstruye el índice de resúmenes físicos al cambiar el input. */
  private rebuildFisicaIndex(): void {
    this.fisicaPorDia.clear();
    for (const dia of this._resumenFisica ?? []) {
      if (!dia?.fecha) continue;
      const disciplinas = dia.disciplinas ?? [];
      const hechas = disciplinas.filter(
        (disciplina) => disciplina.realizado,
      ).length;
      const total = disciplinas.length;
      this.fisicaPorDia.set(dia.fecha, {
        resumen: dia,
        hechas,
        total,
        etiqueta: disciplinas.map((disciplina) => disciplina.nombre).join(', '),
        contexto:
          total > 0
            ? `Plan físico: ${hechas}/${total}. ${disciplinas
                .map(
                  (disciplina) =>
                    `${disciplina.nombre} (${
                      disciplina.realizado ? 'realizada' : 'pendiente'
                    })`,
                )
                .join(', ')}`
            : '',
      });
    }
  }
  isCloneDialogVisible: boolean = false;
  selectedDayForCloning: Date | null = null;
  targetDayForCloning: number | null = null;

  daysOfWeek = [
    { label: 'Lunes', value: 0 },
    { label: 'Martes', value: 1 },
    { label: 'Miércoles', value: 2 },
    { label: 'Jueves', value: 3 },
    { label: 'Viernes', value: 4 },
    { label: 'Sábado', value: 5 },
    { label: 'Domingo', value: 6 },
  ];

  openCloneDialog(day: Date): void {
    this.selectedDayForCloning = day;
    this.isCloneDialogVisible = true;
  }

  async cloneEventsToTargetDay(): Promise<void> {
    if (!this.selectedDayForCloning || this.targetDayForCloning == null) {
      console.error('Faltan el día seleccionado o el día objetivo.');
      return;
    }

    // Convertir el día objetivo en una fecha dentro de la semana actual
    const weekStart = getStartOfWeek(this.viewDate); // Inicio de la semana actual
    const targetDayDate = getDateForDayOfWeek(
      this.targetDayForCloning,
      weekStart,
    );

    // Obtener eventos del día seleccionado
    const eventsToClone = cloneDeep(
      this.getEventsForDay(this.events, this.selectedDayForCloning),
    );

    if (eventsToClone.length === 0) {
      console.warn(
        `No hay eventos para clonar desde ${this.selectedDayForCloning}.`,
      );
      this.isCloneDialogVisible = false;
      return;
    }

    // Crear clones de los eventos con la nueva fecha
    const clonedEvents = eventsToClone.map((event) => {
      event.meta.subBloque.id = undefined;
      const sourceEnd = event.end ?? event.start;
      return {
        ...event,
        start: new Date(
          targetDayDate.getFullYear(),
          targetDayDate.getMonth(),
          targetDayDate.getDate(),
          event.start.getHours(),
          event.start.getMinutes(),
        ),
        end: new Date(
          targetDayDate.getFullYear(),
          targetDayDate.getMonth(),
          targetDayDate.getDate(),
          sourceEnd.getHours(),
          sourceEnd.getMinutes(),
        ),
        id: undefined, // Eliminar el ID para que el backend cree uno nuevo
      };
    });

    // Agregar los eventos clonados a la lista de eventos actual
    this.events = cloneDeep([
      ...cloneDeep(this.events),
      ...cloneDeep(clonedEvents),
    ]);
    this.eventsChange.emit(this.events);

    // Cerrar el diálogo y reiniciar las variables
    this.isCloneDialogVisible = false;
    this.targetDayForCloning = null;

    // Aquí podrías hacer una llamada al backend si los datos se guardan en un servidor:
    // this.eventService.saveEvents(clonedEvents).subscribe(() => { ... });
  }
  public getAllBloques$ = computed(() => {
    return this.planificacionesService
      .getBloques$({
        skip: 0,
        take: 10,
        searchTerm: this.searchTerm(),
      })
      .pipe(
        map((e) => {
          e.data.forEach((e: any) => (e['tieneTemplate'] = true));
          return e;
        }),
      );
  });
  public valueChanged = (event: any) => {
    this.searchTerm.set(event.target.value);
  };
  public debouncedValueChanged = debounce(this.valueChanged, 300);
  public colors = colors;
  toast = inject(ToastrService);

  constructor() {
    this.triggerSaveUpdateProgress.subscribe(() => this.saveChanges.emit());
  }

  ngOnInit(): void {}

  /** Resumen de física del día, o `undefined` si no hay entrenamiento ese día. */
  private resumenFisicaDelDia(dia: Date): ResumenDiaFisica | undefined {
    return this.fisicaPorDia.get(formatFechaISO(dia))?.resumen;
  }

  tieneFisica(dia: Date): boolean {
    return (this.fisicaPorDia.get(formatFechaISO(dia))?.total ?? 0) > 0;
  }

  etiquetaFisica(dia: Date): string {
    return this.fisicaPorDia.get(formatFechaISO(dia))?.etiqueta ?? '';
  }

  /**
   * Contexto físico completo del día (resumen y estado de cada disciplina)
   * para conservarlo en el tooltip de las tarjetas que lo recortan. Índice
   * O(1): el texto se construye una vez al recibir `resumenFisica`.
   */
  contextoFisicaDia(dia: Date): string {
    return this.fisicaPorDia.get(formatFechaISO(dia))?.contexto ?? '';
  }

  /**
   * Disciplinas de física del día (nombre + color), para pintar el chip del
   * bridge con el punto de color de cada disciplina — el mismo color que ya
   * usa el calendario del módulo de física (el dato viene en la API).
   */
  disciplinasFisica(dia: Date): DisciplinaResumenDia[] {
    return this.resumenFisicaDelDia(dia)?.disciplinas ?? [];
  }

  /**
   * Click en la indicación de física: navega al detalle del día en el
   * módulo de física, en vez de caer en `onEventClicked` (que asume
   * `event.meta.subBloque` de un evento de temario). Por eso este badge
   * NUNCA es un `CalendarEvent` — es un elemento aparte en la cabecera del
   * día, así que no puede colarse en ese flujo por accidente.
   */
  abrirFisica(dia: Date, domEvent: Event): void {
    domEvent.stopPropagation();
    domEvent.preventDefault();
    const fecha = formatFechaISO(dia);
    const bloqueId = this.resumenFisicaDelDia(dia)?.bloqueId;
    if (!bloqueId) return;
    this.router.navigate(['/app/planificacion-fisica', 'dia', fecha], {
      queryParams: {
        bloqueId,
        originPlanificacionId: this.originPlanificacionId,
      },
    });
  }

  /* ── Sub-bloque vinculado a física (rediseño bridge 2026-07-22) ─────────
   * Un sub-bloque del temario marcado `esEntrenamientoFisico` deja de ser
   * texto muerto: el contenido (disciplinas, estado hecho) se lee en vivo
   * del módulo de física por fecha. El temario solo aporta hora/duración. */

  /** ¿Este evento del temario es un sub-bloque vinculado a física? */
  esEventoFisicaVinculado(event: CalendarEvent): boolean {
    return !!event?.meta?.subBloque?.esEntrenamientoFisico;
  }

  /**
   * ¿El día tiene YA un sub-bloque vinculado? Entonces el chip del header se
   * omite (el bloque en la agenda ES la indicación — pintar ambos sería el
   * duplicado que el rediseño elimina).
   */
  diaTieneBloqueFisicaVinculado(dia: Date): boolean {
    return this.getEventsForDay(this.events, dia).some((e) =>
      this.esEventoFisicaVinculado(e),
    );
  }

  /** Resumen informativo de las disciplinas físicas; no determina la marca del calendario. */
  progresoFisicaDia(dia: Date): { hechas: number; total: number } {
    const indice = this.fisicaPorDia.get(formatFechaISO(dia));
    return {
      hechas: indice?.hechas ?? 0,
      total: indice?.total ?? 0,
    };
  }

  /* ── Modo explícito «Marcar progreso» ──────────────────────────────────
   * El alumno entra y sale sin guardar: sólo los clics de marcado escriben.
   * Un único guard (`updateEventProgress`) bloquea cualquier escritura fuera
   * del modo, venga de tarjeta, casilla, teclado o una llamada tardía. */
  get guardadosProgresoPendientes(): boolean {
    return this.pendingProgressIds.size > 0;
  }

  puedeMarcarProgreso(): boolean {
    return this.role === 'ALUMNO';
  }

  puedeInteractuarTarjeta(): boolean {
    return this.puedeAbrirEventSheet() || this.modoMarcadoProgreso;
  }

  etiquetaTarjeta(event: CalendarEvent | null | undefined): string {
    const titulo = event?.title || 'actividad';
    if (this.modoMarcadoProgreso) {
      return event?.meta?.subBloque?.realizado
        ? `Marcar pendiente: ${titulo}`
        : `Marcar realizada: ${titulo}`;
    }
    return `Abrir detalles de ${titulo}`;
  }

  alternarModoProgreso(event?: Event): void {
    // El botón también puede recibir Enter/Espacio: nunca debe burbujear al
    // calendario ni provocar un segundo envío.
    event?.preventDefault();
    event?.stopPropagation();

    if (this.modoMarcadoProgreso) {
      if (this.guardadosProgresoPendientes) return;
      const claveEnfocada = this.claveEnfocadaEnTarjeta();
      this.modoMarcadoProgreso = false;
      this.actualizarProyeccionCalendario();
      this.refresh.next();
      this.restaurarFocoTrasSalir(claveEnfocada);
      return;
    }

    if (!this.puedeMarcarProgreso()) return;
    this.modoMarcadoProgreso = true;
    this.actualizarProyeccionCalendario();
    this.refresh.next();
  }

  /**
   * Clones superficiales sólo para la vista. Los eventos originales (y sus
   * flags) quedan intactos; al refrescar el padre, la proyección se recalcula
   * con los flags vigentes y nunca restaura valores antiguos por id.
   */
  private actualizarProyeccionCalendario(): void {
    this._eventosParaCalendario = this.modoMarcadoProgreso
      ? (this._events ?? []).map((evento) => ({
          ...evento,
          draggable: false,
          resizable: { beforeStart: false, afterEnd: false },
        }))
      : this._events;
  }

  private reaplicarProgresoPendiente(): void {
    for (const [clave, estado] of this.pendingProgressEstados) {
      const actual = this.eventoActualPorClave(clave);
      if (actual) actual.meta.subBloque.realizado = estado.nuevo;
    }
  }

  private eventoActualPorClave(clave: string): CalendarEvent | null {
    return (
      (this._events ?? []).find(
        (evento) => this.progressKey(evento) === clave,
      ) ?? null
    );
  }

  private claveEnfocadaEnTarjeta(): string | null {
    const activo = document.activeElement;
    if (!(activo instanceof HTMLElement)) return null;
    const tarjeta = activo.closest('[data-progress-key]');
    return tarjeta?.getAttribute('data-progress-key') || null;
  }

  /** Al desaparecer la casilla enfocada, el foco vuelve a la tarjeta. */
  private restaurarFocoTrasSalir(clave: string | null): void {
    if (!clave) return;
    setTimeout(() => {
      const selector = `[data-progress-key="${clave.replace(/"/g, '\\"')}"] .event-text`;
      const destino = this.elementRef.nativeElement.querySelector(
        selector,
      ) as HTMLElement | null;
      if (destino?.isConnected) destino.focus({ preventScroll: true });
    }, 0);
  }

  ngOnDestroy(): void {
    this.desactivarEscuchaScrollGesto();
  }

  onEventClicked(event: CalendarEvent): void {
    this.abrirEventSheet(event);
  }

  /** Modos en los que una tarjeta puede abrir el panel de detalle. */
  puedeAbrirEventSheet(): boolean {
    if (this.modoMarcadoProgreso) return false;
    return this.role === 'ALUMNO' || this.mode === 'edit';
  }

  /** Abre el bottomsheet sin entrar en edición ni navegar. */
  abrirEventSheet(event: CalendarEvent, sourceEvent?: Event): void {
    if (!event || !this.puedeAbrirEventSheet() || this.modoMarcadoProgreso) {
      return;
    }

    this.selectedEvent = event;
    this.eventoSheet = event;
    this.isConfirmandoBorrado = false;
    this.comentarioFeedbackId = null;

    const id = this.idSubBloque(event);
    this.comentarioBorrador =
      id !== null
        ? (this.borradoresComentario.get(id) ??
          event.meta?.subBloque?.comentariosAlumno ??
          '')
        : '';

    const trigger =
      sourceEvent?.currentTarget instanceof HTMLElement
        ? sourceEvent.currentTarget
        : null;
    this.sheetTriggerElement =
      (trigger?.querySelector?.('.event-text') as HTMLElement | null) ||
      trigger;
    this.isEventSheetVisible = true;
    this.bloquearScrollFondo();
  }

  cerrarEventSheet(): void {
    this.isEventSheetVisible = false;
  }

  /** Punto único de restauración al cerrar: foco, borradores y editor pendiente. */
  onEventSheetHide(): void {
    this.eventoSheet = null;
    this.isConfirmandoBorrado = false;
    this.liberarScrollFondo();

    const editorPendiente = this.pendingEditorEvent;
    this.pendingEditorEvent = null;
    if (editorPendiente) {
      this.abrirEditorEvento(editorPendiente);
      return;
    }

    const trigger = this.sheetTriggerElement;
    this.sheetTriggerElement = null;
    if (trigger?.isConnected) trigger.focus();
  }

  /* ── Guard de gesto de la tarjeta ──────────────────────────────────────
   * angular-calendar escucha el click y no distingue un drag. Guardamos el
   * pointerdown primario y sólo abrimos el panel cuando el gesto termina sin
   * superar el umbral ni cancelarse. El click sintético posterior a un drop
   * queda suprimido una vez; el siguiente pointerdown lo reactiva. */
  onCardPointerDown(event: PointerEvent): void {
    this.suppressNextClick = false;
    this.gestureMoved = false;
    this.gestureCancelled = false;
    if (event.button !== 0) {
      this.gesturePointerId = null;
      this.desactivarEscuchaScrollGesto();
      return;
    }
    this.gesturePointerId = event.pointerId;
    this.gestureStartX = event.clientX;
    this.gestureStartY = event.clientY;
    this.activarEscuchaScrollGesto();
  }

  onCardPointerMove(event: PointerEvent): void {
    if (
      this.gesturePointerId === null ||
      event.pointerId !== this.gesturePointerId
    ) {
      return;
    }
    const dx = event.clientX - this.gestureStartX;
    const dy = event.clientY - this.gestureStartY;
    if (dx * dx + dy * dy > this.umbralGestoPx * this.umbralGestoPx) {
      this.gestureMoved = true;
    }
  }

  onCardPointerUp(event: PointerEvent): void {
    if (event.pointerId === this.gesturePointerId) {
      this.gesturePointerId = null;
      this.desactivarEscuchaScrollGesto();
    }
  }

  onCardPointerCancel(event: PointerEvent): void {
    if (event.pointerId === this.gesturePointerId) {
      this.gestureCancelled = true;
      this.gesturePointerId = null;
      this.desactivarEscuchaScrollGesto();
    }
  }

  private activarEscuchaScrollGesto(): void {
    if (this.escuchaScrollGestoActiva) return;
    window.addEventListener('scroll', this.onScrollDuranteGesto, true);
    this.escuchaScrollGestoActiva = true;
  }

  private desactivarEscuchaScrollGesto(): void {
    if (!this.escuchaScrollGestoActiva) return;
    window.removeEventListener('scroll', this.onScrollDuranteGesto, true);
    this.escuchaScrollGestoActiva = false;
  }

  private gestoInvalidado(): boolean {
    return this.gestureMoved || this.gestureCancelled || this.suppressNextClick;
  }

  /**
   * Click directo sobre el texto de la tarjeta. Chrome puede ajustar el hit
   * táctil hacia el título si sólo escucha el contenedor exterior; este
   * listener mantiene una única activación y corta el burbujeo al outer.
   */
  onEventTextClick(event: MouseEvent, calendarEvent: CalendarEvent): void {
    event.stopPropagation();
    this.onCardClick(event, calendarEvent);
  }

  /** Fallback para zonas vacías de la tarjeta fuera de la columna de texto. */
  onCardSurfaceClick(event: MouseEvent, calendarEvent: CalendarEvent): void {
    if (
      event.target instanceof Element &&
      event.target.closest('.event-text')
    ) {
      return;
    }
    this.onCardClick(event, calendarEvent);
  }

  onCardClick(event: MouseEvent, calendarEvent: CalendarEvent): void {
    const gestoInvalidado = this.gestoInvalidado();
    this.resetGesto();

    if (gestoInvalidado) return;

    if (this.modoMarcadoProgreso) {
      event.preventDefault();
      event.stopPropagation();
      if (this.esObjetivoInteractivo(event.target)) return;
      this.updateEventProgress(calendarEvent);
      return;
    }

    if (
      !this.puedeAbrirEventSheet() ||
      this.esObjetivoInteractivo(event.target)
    ) {
      return;
    }

    this.abrirEventSheet(calendarEvent, event);
  }

  /** La casilla comparte el guard de gesto para no marcar tras un scroll. */
  onCompletionClick(event: MouseEvent, calendarEvent: CalendarEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const gestoInvalidado = this.gestoInvalidado();
    this.resetGesto();
    if (gestoInvalidado || !this.modoMarcadoProgreso) return;
    this.updateEventProgress(calendarEvent);
  }

  onCardKeydown(event: KeyboardEvent, calendarEvent: CalendarEvent): void {
    if (event.repeat || !this.puedeInteractuarTarjeta()) return;
    if (
      event.key !== 'Enter' &&
      event.key !== ' ' &&
      event.key !== 'Spacebar'
    ) {
      return;
    }
    if (
      event.target instanceof Element &&
      event.target !== event.currentTarget &&
      event.target.closest(
        'a, button, input, textarea, select, [contenteditable="true"]',
      )
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    this.suppressNextClick = false;
    if (this.modoMarcadoProgreso) {
      this.updateEventProgress(calendarEvent);
      return;
    }
    this.abrirEventSheet(calendarEvent, event);
  }

  private resetGesto(): void {
    this.gesturePointerId = null;
    this.gestureMoved = false;
    this.gestureCancelled = false;
    this.suppressNextClick = false;
    this.desactivarEscuchaScrollGesto();
  }

  private esObjetivoInteractivo(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    return !!target.closest(
      'a, button, input, textarea, select, label, [role="checkbox"], [contenteditable="true"]',
    );
  }

  /* ── Contenido y permisos del panel ──────────────────────────────────── */
  tipoEventoSheet(event: CalendarEvent | null): string {
    if (!event) return '';
    if (event.meta?.esPersonalizado) return 'Evento personal';
    if (event.meta?.subBloque?.esEntrenamientoFisico) {
      return 'Entrenamiento físico';
    }
    return 'Tarea del plan';
  }

  descripcionEventoSheet(event: CalendarEvent | null): string {
    return event?.meta?.subBloque?.comentarios ?? '';
  }

  finEventoSheet(event: CalendarEvent | null): Date | null {
    if (!event) return null;
    if (event.end) return event.end;
    const duracion = this.duracionEventoMinutos(event);
    return new Date(event.start.getTime() + duracion * 60000);
  }

  duracionEventoMinutos(event: CalendarEvent | null): number {
    const duracion = Number(event?.meta?.subBloque?.duracion);
    if (Number.isFinite(duracion) && duracion > 0) return duracion;
    if (event?.start && event?.end) {
      return Math.round((event.end.getTime() - event.start.getTime()) / 60000);
    }
    return 0;
  }

  puedeVerFisicaSheet(): boolean {
    return (
      this.role === 'ALUMNO' &&
      !!this.eventoSheet &&
      this.esEventoFisicaVinculado(this.eventoSheet) &&
      this.tieneFisica(this.eventoSheet.start)
    );
  }

  puedeComentarEventoSheet(): boolean {
    return (
      this.role === 'ALUMNO' &&
      !!this.eventoSheet &&
      !this.eventoSheet.meta?.esPersonalizado &&
      this.idSubBloque(this.eventoSheet) !== null
    );
  }

  puedeEditarEventoSheet(): boolean {
    return (
      !!this.eventoSheet &&
      (this.role === 'ADMIN' || !!this.eventoSheet.meta?.esPersonalizado)
    );
  }

  puedeEliminarEventoSheet(): boolean {
    return (
      !!this.eventoSheet &&
      (this.role === 'ADMIN' || !!this.eventoSheet.meta?.esPersonalizado)
    );
  }

  /* ── Comentario del alumno ───────────────────────────────────────────── */
  get comentarioGuardando(): boolean {
    const id = this.idSubBloque(this.eventoSheet);
    return id !== null && this.comentariosPendientes.has(id);
  }

  get comentarioCambiado(): boolean {
    const id = this.idSubBloque(this.eventoSheet);
    if (id === null || !this.eventoSheet) return false;
    return (
      this.comentarioBorrador !==
      (this.eventoSheet.meta?.subBloque?.comentariosAlumno ?? '')
    );
  }

  get comentarioError(): string {
    const id = this.idSubBloque(this.eventoSheet);
    return id !== null ? (this.erroresComentario.get(id) ?? '') : '';
  }

  get comentarioFeedback(): boolean {
    const id = this.idSubBloque(this.eventoSheet);
    return id !== null && this.comentarioFeedbackId === id;
  }

  onComentarioInput(): void {
    this.comentarioFeedbackId = null;
    const id = this.idSubBloque(this.eventoSheet);
    // Borrador local por evento: no toca el contenido persistido ni el backend.
    // Se conserva al cerrar para no perder lo escrito en A o en B.
    if (id !== null) {
      this.borradoresComentario.set(id, this.comentarioBorrador);
    }
  }

  /**
   * Guarda el borrador del evento abierto. La petición captura id, texto y
   * evento al arrancar: cerrar el panel o abrir otro mientras está pendiente
   * no redirige la respuesta al evento visible.
   */
  guardarComentarioSheet(): void {
    const evento = this.eventoSheet;
    const id = this.idSubBloque(evento);
    if (
      !evento ||
      id === null ||
      evento.meta?.esPersonalizado ||
      this.role !== 'ALUMNO' ||
      this.comentariosPendientes.has(id)
    ) {
      return;
    }

    const texto = this.comentarioBorrador;
    this.comentariosPendientes.add(id);
    this.borradoresComentario.set(id, texto);
    this.erroresComentario.delete(id);
    this.comentarioFeedbackId = null;

    this.planificacionesService
      .actualizarProgresoSubBloque$({
        subBloqueId: id,
        planificacionId: Number(this.activatedRoute.snapshot.params['id']),
        comentariosAlumno: texto,
      })
      .subscribe({
        next: () => {
          this.comentariosPendientes.delete(id);
          const capturado = this.events.find(
            (calendarEvent) =>
              !calendarEvent.meta?.esPersonalizado &&
              this.idSubBloque(calendarEvent) === id,
          );
          if (capturado) {
            capturado.meta.subBloque.comentariosAlumno = texto;
          }
          if (this.borradoresComentario.get(id) === texto) {
            this.borradoresComentario.delete(id);
          }
          // El ACK de un comentario de fondo no debe sustituir el feedback
          // del panel visible si ya se abrió otro evento.
          if (this.idSubBloque(this.eventoSheet) === id) {
            this.comentarioFeedbackId = id;
          }
          this.refresh.next();
        },
        error: () => {
          this.comentariosPendientes.delete(id);
          this.erroresComentario.set(
            id,
            'No se pudo guardar el comentario. Revisa tu conexión e inténtalo de nuevo.',
          );
          this.refresh.next();
        },
      });
  }

  /* ── Acciones del panel ──────────────────────────────────────────────── */
  editarEventoDesdeSheet(): void {
    const evento = this.eventoSheet;
    if (!evento || !this.puedeEditarEventoSheet()) return;
    this.pendingEditorEvent = evento;
    this.isEventSheetVisible = false;
  }

  verPlanFisicoDesdeSheet(event: Event): void {
    const evento = this.eventoSheet;
    if (!evento || !this.puedeVerFisicaSheet()) return;
    this.sheetTriggerElement = null;
    this.isEventSheetVisible = false;
    this.abrirFisica(evento.start, event);
  }

  solicitarBorradoEventoSheet(): void {
    if (!this.puedeEliminarEventoSheet() || this.eliminandoEvento) return;
    this.isConfirmandoBorrado = true;
  }

  /** Pending DELETE por identidad (tipo + id), no un bloqueo global. */
  get eliminandoEvento(): boolean {
    const clave = this.claveEvento(this.eventoSheet);
    return clave !== null && this.eliminacionesPendientes.has(clave);
  }

  cancelarBorradoEventoSheet(): void {
    this.isConfirmandoBorrado = false;
  }

  confirmarBorradoEventoSheet(): void {
    const evento = this.eventoSheet;
    if (!evento || !this.puedeEliminarEventoSheet() || this.eliminandoEvento) {
      return;
    }

    if (evento.meta?.esPersonalizado) {
      const clave = this.claveEvento(evento);
      if (clave === null || this.eliminacionesPendientes.has(clave)) return;
      this.eliminacionesPendientes.add(clave);
      this.deleteEventoPersonalizado(evento, undefined, {
        onSuccess: () => {
          this.eliminacionesPendientes.delete(clave);
          // Sólo cierra si el panel visible sigue siendo el evento confirmado.
          if (this.claveEvento(this.eventoSheet) === clave) {
            this.cerrarEventSheet();
          }
        },
        onError: () => {
          this.eliminacionesPendientes.delete(clave);
        },
      });
      return;
    }

    this.deleteEvent(evento);
    this.cerrarEventSheet();
  }

  private abrirEditorEvento(event: CalendarEvent): void {
    this.selectedEvent = event;

    if (event.meta?.esPersonalizado) {
      this.editEventoPersonalizadoData = {
        id: event.meta.subBloque.id,
        planificacionId: Number(this.activatedRoute.snapshot.params['id']),
        nombre: event.title,
        descripcion: event.meta.subBloque.comentarios,
        horaInicio: event.start,
        duracion: event.meta.subBloque.duracion,
        color: event.meta.subBloque.color,
        importante: event.meta.subBloque.importante,
        tiempoAviso: event.meta.subBloque.tiempoAviso,
        realizado: event.meta.subBloque.realizado,
      };
      this.isEventoPersonalizadoDialogVisible = true;
    } else {
      this.editSubBloqueData = {
        ...event.meta.subBloque,
        nombre: event.title,
      };
      this.isDialogVisible = true;
    }
  }

  private idSubBloque(event: CalendarEvent | null | undefined): number | null {
    const id = event?.meta?.subBloque?.id;
    if (id === null || id === undefined) return null;
    const numerico = Number(id);
    return Number.isFinite(numerico) ? numerico : null;
  }

  private claveEvento(event: CalendarEvent | null | undefined): string | null {
    const id = this.idSubBloque(event);
    if (id === null) return null;
    return `${event?.meta?.esPersonalizado ? 'personal' : 'subbloque'}:${id}`;
  }

  private sincronizarEventoSheet(): void {
    const id = this.idSubBloque(this.eventoSheet);
    if (id === null || !this.eventoSheet) return;
    const personal = !!this.eventoSheet.meta?.esPersonalizado;
    const actualizado = this._events.find(
      (event) =>
        this.idSubBloque(event) === id &&
        !!event.meta?.esPersonalizado === personal,
    );
    if (actualizado) this.eventoSheet = actualizado;
  }

  private bloquearScrollFondo(): void {
    if (this.scrollLockElement) return;
    const host = this.elementRef?.nativeElement;
    const contenedor = host?.closest?.(
      '.weekly-calendar',
    ) as HTMLElement | null;
    if (!contenedor) return;
    this.scrollLockElement = contenedor;
    this.scrollLockPreviousOverflow = contenedor.style.overflow;
    contenedor.style.overflow = 'hidden';
  }

  private liberarScrollFondo(): void {
    if (!this.scrollLockElement) return;
    this.scrollLockElement.style.overflow = this.scrollLockPreviousOverflow;
    this.scrollLockElement = null;
    this.scrollLockPreviousOverflow = '';
  }

  saveEvent(subbloque: SubBloque): void {
    if (this.selectedEvent && subbloque) {
      // El editor puede terminar después de un refresco de `events`: se
      // resuelve la instancia actual por identidad y se conserva su `realizado`.
      // Así un guardado de nombre/comentarios nunca resucita ni borra progreso.
      const claveSeleccionada = this.claveEvento(this.selectedEvent);
      let indice = claveSeleccionada
        ? this._events.findIndex(
            (evento) => this.claveEvento(evento) === claveSeleccionada,
          )
        : -1;
      // Los eventos nuevos de admin tienen id null: se resuelven por la
      // referencia del evento abierto para no duplicarlos al editar.
      if (indice < 0) {
        indice = this._events.indexOf(this.selectedEvent);
      }
      const eventoBase =
        indice >= 0 ? this._events[indice] : this.selectedEvent;
      const updatedEvent = {
        ...eventoBase,
        title: subbloque.nombre,
        color: {
          primary: subbloque.color,
          secondary: subbloque.color,
        },
        end: new Date(
          new Date(eventoBase.start).getTime() + subbloque.duracion * 60000,
        ),
        meta: {
          ...eventoBase.meta,
          subBloque: {
            ...eventoBase.meta?.subBloque,
            comentarios: subbloque.comentarios,
            color: subbloque.color,
            duracion: subbloque.duracion,
            importante: subbloque.importante,
            tiempoAviso: subbloque.tiempoAviso,
            esEntrenamientoFisico: subbloque.esEntrenamientoFisico ?? false,
            realizado: eventoBase.meta?.subBloque?.realizado,
          },
        },
      };
      const eventosActualizados = [...this._events];
      if (indice >= 0) {
        eventosActualizados[indice] = cloneDeep(updatedEvent) as CalendarEvent;
      } else {
        eventosActualizados.push(updatedEvent as CalendarEvent);
      }
      this.events = eventosActualizados;
      this.refresh.next();
      this.eventsChange.emit(this.events);
      //Como el alumno no tiene botón de guardar... se autoguarda al añadir
      if (this.role == 'ALUMNO') this.saveChanges.emit();
    }
  }

  public bloqueAsignableSeleccionado(planificacionBloque: PlanificacionBloque) {
    this.applyPlanificacionBloque(planificacionBloque, this.onTimeClickedDate);
    this.events = [...this.events];
    if (this.view === 'month') {
      this.viewDate = this.onTimeClickedDate;
      this.activeDayIsOpen = true;
    }
    this.eventsChange.emit(this.events);
    this.refresh.next();
    this.onTimeClickedDate = null as any;
    this.seleccionandoBloquesAsignables = false;
  }

  private applyPlanificacionBloque(
    planificacionBloque: PlanificacionBloque,
    newStart: Date,
  ) {
    // Supongamos que el `CalendarEvent` tiene una referencia al `PlanificacionBloque`

    if (planificacionBloque) {
      // Establecemos la hora de inicio base en newStart
      let currentStartDate = new Date(newStart);
      let clonedPlanificacion = cloneDeep(planificacionBloque);
      // Iteramos sobre los subBloques y creamos eventos basados en ellos
      clonedPlanificacion.subBloques.forEach((subBloque) => {
        subBloque.id = null;
        const subEvent: CalendarEvent = {
          title: subBloque.nombre,
          color: {
            primary: subBloque.color || this.colors.yellow.primary,
            secondary: subBloque.color || this.colors.yellow.secondary,
          },
          start: new Date(currentStartDate),
          end: new Date(
            currentStartDate.getTime() + subBloque.duracion * 60000,
          ),
          meta: { subBloque },
          draggable: true,
        };

        // Añadimos el sub-evento a los eventos
        this.events.push(subEvent);

        // Actualizamos currentStart para el próximo subBloque
        currentStartDate = new Date(subEvent.end as Date);
      });
    }
  }

  eventDropped(
    { event, newStart, newEnd, allDay }: CalendarEventTimesChangedEvent,
    autoSave = false,
  ): void {
    // En modo de marcado ningún drop/resize debe mover ni escribir posición,
    // aunque el calendario emita el evento pese a los flags suspendidos.
    if (this.modoMarcadoProgreso) {
      this.suppressNextClick = true;
      return;
    }
    // Un drag/resize real no es un click de apertura. El click sintético que
    // pueda llegar al soltar se consume una vez; el siguiente gesto lo limpia.
    this.suppressNextClick = true;
    if (event instanceof MouseEvent) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (typeof allDay !== 'undefined') {
      event.allDay = allDay;
    }

    // Actualizamos las fechas del evento original
    event.start = newStart;
    if (newEnd) {
      event.end = newEnd;
    }

    // Verificamos el tipo de evento usando la nueva estructura con esPersonalizado
    if (event.meta?.esPersonalizado) {
      // Es un evento personalizado, actualizar en la base de datos
      const subBloque = event.meta.subBloque;
      if (subBloque && subBloque.id) {
        this.planificacionesService
          .actualizarEventoPersonalizado$({
            id: subBloque.id,
            planificacionId: Number(this.activatedRoute.snapshot.params['id']),
            nombre: event.title,
            descripcion: subBloque.comentarios || '',
            horaInicio: newStart,
            duracion: subBloque.duracion,
            color: subBloque.color,
            importante: subBloque.importante || false,
            tiempoAviso: subBloque.tiempoAviso,
          })
          .subscribe({
            next: () => {
              // Actualizar localmente
              event.meta.subBloque.horaInicio = newStart;
              this.refresh.next();
            },
            error: (err) => {
              this.toast.error(
                'Error al guardar la posición del evento personal',
              );
              console.error('Error:', err);
            },
          });
      }
    } else if ((event as any)['tieneTemplate'] || event.meta?.template) {
      // Aplicar template (código existente)
      this.applyPlanificacionBloque(event as any, newStart);
    } else if (this.role === 'ALUMNO' && event?.meta?.subBloque?.id) {
      // Actualizar posición personalizada (código existente)
      this.planificacionesService
        .actualizarProgresoSubBloque$({
          subBloqueId: event.meta.subBloque.id,
          planificacionId: Number(this.activatedRoute.snapshot.params['id']),
          posicionPersonalizada: newStart,
        })
        .subscribe({
          next: () => {},
          error: (err) => {
            console.error('Error al guardar posición:', err);
          },
        });
    }

    this.events = [...this.events];
    if (this.view === 'month') {
      this.viewDate = newStart;
      this.activeDayIsOpen = true;
    }
    this.refresh.next();
    if (this.role === 'ADMIN' && !!autoSave) {
      this.saveChanges.emit();
    }
  }

  ngAfterViewInit(): void {
    // if (
    //   document.getElementsByClassName('cal-time') !== undefined &&
    //   document.getElementsByClassName('cal-time').length > 0
    // ) {
    //   let scrollbar = document.getElementsByClassName('cal-time')[16];
    //   scrollbar.scrollIntoView({ behavior: 'smooth' });
    //   scrollbar.scrollIntoView(true);
    // }
  }

  public deleteEvent(calendarEvent: CalendarEvent, event?: Event) {
    event?.stopPropagation();
    const id = this.idSubBloque(calendarEvent);
    if (id !== null) {
      this.borradoresComentario.delete(id);
      this.erroresComentario.delete(id);
    }
    this.events = this.events.filter((event) => event != calendarEvent);
    this.eventsChange.emit(this.events);
  }

  onTimeClicked({ date, sourceEvent }: any, cm: ContextMenu): void {
    sourceEvent.stopPropagation();
    this.onTimeClickedDate = date;
    cm.show(sourceEvent);
  }

  // Propiedades para manejar eventos personalizados
  public isEventoPersonalizadoDialogVisible: boolean = false;
  public editEventoPersonalizadoData: any = null;

  // Guardar evento personalizado
  async saveEventoPersonalizado(evento: any): Promise<void> {
    if (!evento) return;

    // Determinar si es nuevo o existente
    const isNew = !evento.id;
    // El editor no puede cambiar el progreso: se conserva el valor vivo del
    // calendario aunque el diálogo se abriera antes de un refresco de datos.
    const eventoActual = isNew
      ? null
      : this._events.find(
          (calendarEvent) =>
            calendarEvent.meta?.esPersonalizado &&
            this.idSubBloque(calendarEvent) === Number(evento.id),
        );
    // El editor nunca envía `realizado`: esa columna no forma parte del DTO
    // del alumno. Sólo se conserva para la representación local.
    const realizadoLocal = eventoActual
      ? !!eventoActual.meta?.subBloque?.realizado
      : false;

    // Preparar para guardar en base de datos
    const dto = {
      id: evento.id,
      planificacionId: Number(this.activatedRoute.snapshot.params['id']),
      nombre: evento.nombre,
      descripcion: evento.descripcion,
      horaInicio: evento.horaInicio,
      duracion: evento.duracion,
      color: evento.color,
      importante: evento.importante,
      tiempoAviso: evento.tiempoAviso,
    };

    // Llamada al servicio
    const observable = isNew
      ? this.planificacionesService.crearEventoPersonalizado$(dto)
      : this.planificacionesService.actualizarEventoPersonalizado$(dto);

    observable.subscribe({
      next: (response) => {
        // Crear objeto para el evento
        const eventoData = {
          ...dto,
          id: isNew ? response.id : dto.id,
        };
        const idFinal = Number(eventoData.id);
        const vigente = Number.isFinite(idFinal)
          ? this._events.find(
              (calendarEvent) =>
                calendarEvent.meta?.esPersonalizado &&
                this.idSubBloque(calendarEvent) === idFinal,
            )
          : null;
        const realizadoAck = vigente
          ? !!vigente.meta?.subBloque?.realizado
          : isNew
            ? false
            : realizadoLocal;

        // Crear el evento del calendario con estructura unificada
        const updatedEvent = {
          title: eventoData.nombre,
          start: new Date(eventoData.horaInicio),
          end: new Date(
            new Date(eventoData.horaInicio).getTime() +
              eventoData.duracion * 60000,
          ),
          color: {
            primary: eventoData.color || '#4caf50',
            secondary: eventoData.color || '#4caf50',
          },
          draggable: true,
          meta: {
            esPersonalizado: true,
            subBloque: {
              id: eventoData.id,
              nombre: eventoData.nombre,
              horaInicio: eventoData.horaInicio,
              duracion: eventoData.duracion,
              comentarios: eventoData.descripcion || '',
              color: eventoData.color || '#4caf50',
              importante: eventoData.importante || false,
              tiempoAviso: eventoData.tiempoAviso,
              realizado: realizadoAck,
              planificacionId: Number(
                this.activatedRoute.snapshot.params['id'],
              ),
              esPersonalizado: true,
            },
          },
        };

        const eventosActualizados = [...this._events];
        if (isNew) {
          eventosActualizados.push(updatedEvent as CalendarEvent);
        } else {
          const indice = eventosActualizados.findIndex(
            (calendarEvent) =>
              calendarEvent.meta?.esPersonalizado &&
              this.idSubBloque(calendarEvent) === idFinal,
          );
          if (indice >= 0) {
            eventosActualizados[indice] = updatedEvent as CalendarEvent;
          }
        }

        this.events = eventosActualizados;
        this.refresh.next();
        this.isEventoPersonalizadoDialogVisible = false;
        this.toast.success(
          `Evento personal ${isNew ? 'creado' : 'actualizado'} correctamente`,
        );
      },
      error: (err) => {
        this.toast.error(
          `Error al ${isNew ? 'crear' : 'actualizar'} el evento personal`,
        );
        console.error('Error:', err);
      },
    });
  }

  // Eliminar evento personalizado
  deleteEventoPersonalizado(
    event: CalendarEvent,
    domEvent?: Event,
    callbacks?: { onSuccess?: () => void; onError?: () => void },
  ): void {
    domEvent?.stopPropagation();

    if (!event.meta?.subBloque?.id || !event.meta?.esPersonalizado) {
      this.toast.error('No se puede eliminar este evento');
      callbacks?.onError?.();
      return;
    }

    const id = event.meta.subBloque.id;
    this.planificacionesService.eliminarEventoPersonalizado$(id).subscribe({
      next: () => {
        const idNumerico = Number(id);
        if (Number.isFinite(idNumerico)) {
          this.borradoresComentario.delete(idNumerico);
          this.erroresComentario.delete(idNumerico);
        }
        this.events = this.events.filter(
          (e) => !(e.meta?.esPersonalizado && e.meta?.subBloque?.id === id),
        );
        this.refresh.next();
        this.toast.success('Evento personal eliminado correctamente');
        callbacks?.onSuccess?.();
      },
      error: (err) => {
        console.error('Error:', err);
        this.toast.error('No se pudo eliminar el evento personal');
        callbacks?.onError?.();
      },
    });
  }

  /** Clave estable por identidad; vacía si el evento aún no tiene id. */
  progressKey(event: CalendarEvent): string {
    const id = this.idSubBloque(event);
    if (id === null) return '';
    return `${event?.meta?.esPersonalizado ? 'personal' : 'subbloque'}:${id}`;
  }

  isProgressSaving(event: CalendarEvent): boolean {
    const key = this.progressKey(event);
    return !!key && this.pendingProgressIds.has(key);
  }

  /**
   * Único mutador de progreso del calendario. Fuera del modo explícito no
   * escribe ni cambia la marca; en modo, resuelve siempre la instancia viva
   * del evento para que un refresco del padre no desvíe ACK/error.
   */
  // La marca del calendario es independiente del progreso del módulo físico.
  updateEventProgress(event: CalendarEvent, realizado?: boolean): void {
    if (
      !this.modoMarcadoProgreso ||
      this.role !== 'ALUMNO' ||
      !this.puedeMarcarProgreso()
    ) {
      return;
    }

    const key = this.progressKey(event);
    if (!key) {
      this.toast.error('No se puede marcar esta actividad.');
      return;
    }
    if (this.pendingProgressIds.has(key)) return;

    const actual = this.eventoActualPorClave(key) ?? event;
    const anterior = !!actual.meta.subBloque.realizado;
    const nuevoEstado = realizado ?? !anterior;
    if (nuevoEstado === anterior) return;

    actual.meta.subBloque.realizado = nuevoEstado;
    this.pendingProgressIds.add(key);
    this.pendingProgressEstados.set(key, {
      anterior,
      nuevo: nuevoEstado,
    });
    this.recalcularProgresoDia(actual.start);
    this.refresh.next();

    const planificacionId = Number(this.activatedRoute.snapshot.params['id']);
    const peticion = actual.meta.esPersonalizado
      ? this.planificacionesService.actualizarEventoPersonalizadoRealizado$(
          actual.meta.subBloque.id,
          planificacionId,
          nuevoEstado,
        )
      : this.planificacionesService.actualizarProgresoSubBloque$({
          subBloqueId: actual.meta.subBloque.id,
          planificacionId,
          realizado: nuevoEstado,
        });

    const resolverEstado = (estado: boolean) => {
      const vigente = this.eventoActualPorClave(key);
      if (vigente) {
        vigente.meta.subBloque.realizado = estado;
        this.recalcularProgresoDia(vigente.start);
      }
      this.pendingProgressIds.delete(key);
      this.pendingProgressEstados.delete(key);
      this.refresh.next();
    };

    peticion.subscribe({
      next: () => resolverEstado(nuevoEstado),
      error: () => {
        resolverEstado(anterior);
        this.toast.error('No se pudo guardar el marcaje. Inténtalo de nuevo.');
      },
    });
  }
}
