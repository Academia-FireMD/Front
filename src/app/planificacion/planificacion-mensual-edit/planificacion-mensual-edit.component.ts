import { Component, computed, inject, signal } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CalendarEvent, CalendarView } from 'angular-calendar';
import { ToastrService } from 'ngx-toastr';
import { ConfirmationService, PrimeNGConfig } from 'primeng/api';
import { cloneDeep } from 'lodash';
import {
  catchError,
  combineLatest,
  filter,
  firstValueFrom,
  of,
  tap,
} from 'rxjs';
import {
  PlanificacionFisicaService,
  ResumenDiaFisica,
} from '../../planificacion-fisica/services/planificacion-fisica.service';
import { AppConfigService } from '../../services/app-config.service';
import { PlanificacionesService } from '../../services/planificaciones.service';
import { UserService } from '../../services/user.service';
import { ViewportService } from '../../services/viewport.service';
import { ModuloApp } from '../../shared/models/modulo-app.enum';
import { EntidadTipo } from '../../shared/models/attachment.model';
import {
  PlanificacionMensual,
  PlantillaSemanal,
  SubBloque,
} from '../../shared/models/planificacion.model';
import {
  ResultadoAplicarPlantillaSemanal,
  PreviewBloque,
} from '../models/aplicar-plantillas-semanales.model';
import {
  VolcarPlantillasResponse,
  VolcarPlantillasResultado,
} from '../models/volcar-plantillas.model';
import { duracionesDisponibles } from '../../shared/models/pregunta.model';
import { Oposicion } from '../../shared/models/subscription.model';
import { TipoDePlanificacionDeseada } from '../../shared/models/user.model';
import {
  formatFechaISO,
  getNextWeekIfFriday,
  getStartOfWeek,
  getVentanaDosSemanasAtras,
} from '../../utils/utils';
import { EventsService } from '../services/events.service';

@Component({
  selector: 'app-planificacion-mensual-edit',
  templateUrl: './planificacion-mensual-edit.component.html',
  styleUrl: './planificacion-mensual-edit.component.scss',
})
export class PlanificacionMensualEditComponent {
  fb = inject(FormBuilder);
  formGroup = this.fb.group({
    identificador: ['', Validators.required],
    descripcion: ['', Validators.required],
    mes: [0, Validators.required],
    ano: [0, Validators.required],
    relevancia: this.fb.array([] as Array<Oposicion>),
    esPorDefecto: [false],
    tipoDePlanificacion: [
      TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
    ],
  });
  public get relevancia(): FormArray {
    return this.formGroup.get('relevancia') as FormArray;
  }
  public get esPorDefecto() {
    return this.formGroup.get('esPorDefecto') as FormControl;
  }

  public get tipoDePlanificacion() {
    return this.formGroup.get('tipoDePlanificacion') as FormControl;
  }
  public updateOposicionSelection(oposiciones: Oposicion[]) {
    this.relevancia.clear();
    oposiciones.forEach((code) => this.relevancia.push(new FormControl(code)));
  }
  lastLoadedPlanification = signal(null as PlanificacionMensual | null);
  viewportService = inject(ViewportService);
  activedRoute = inject(ActivatedRoute);
  planificacionesService = inject(PlanificacionesService);
  activatedRoute = inject(ActivatedRoute);
  userService = inject(UserService);
  toast = inject(ToastrService);
  confirmationService = inject(ConfirmationService);
  router = inject(Router);
  events: CalendarEvent[] = [];
  /** Indica si los eventos del calendario tienen cambios sin guardar. */
  eventosModificados = false;
  viewDate = new Date();
  view: CalendarView = CalendarView.Week;
  public calendarView = CalendarView;
  eventsService = inject(EventsService);
  planificacionFisicaService = inject(PlanificacionFisicaService);
  appConfigService = inject(AppConfigService);
  private cargaResumenFisicaActual = 0;

  /** Bridge temario↔física: fail-open para no romper a SUPERADMIN ni en
   * arranque pre-login. */
  planificacionFisicaHabilitada = computed(
    () =>
      this.appConfigService.estadoModulos()[ModuloApp.PLANIFICACION_FISICA] !==
      false,
  );

  /**
   * Bridge temario↔física: resumen de entrenamiento físico por día del
   * rango actualmente visible, pasado a `<app-vista-semanal>` como input
   * aparte (NUNCA mezclado en `events`, ver comentario en
   * `VistaSemanalComponent.resumenFisica`). Si la carga falla, se queda en
   * `[]` — el temario sigue funcionando exactamente igual, solo no aparece
   * la indicación de física.
   */
  resumenFisica = signal<ResumenDiaFisica[]>([]);
  public isDialogVisible = false;
  public pickedEvents: CalendarEvent[] = [];
  public pickedEventsViewDate: Date = new Date();
  public pickedPlantillaId = signal<number | null>(null);
  public activeStepSeleccionPlantilla = 0;
  public previewResult = signal<ResultadoAplicarPlantillaSemanal | null>(null);
  public previewLoading = signal(false);
  public aplicando = signal(false);

  // Volcado completo de una variante importada
  public isDialogVolcarVisible = false;
  public prefijoPlantillas = '';
  public volcadoPreview: VolcarPlantillasResponse | null = null;
  public volcadoPreviewLoading = false;
  public volcando = false;
  public get totalCreadosVolcado(): number {
    return (
      this.volcadoPreview?.resultados.reduce(
        (acc, r) => acc + (r.creados ?? 0),
        0,
      ) ?? 0
    );
  }
  public get totalOmitidosVolcado(): number {
    return (
      this.volcadoPreview?.resultados.reduce(
        (acc, r) => acc + (r.omitidos ?? 0),
        0,
      ) ?? 0
    );
  }
  public get totalActualizadosVolcado(): number {
    return (
      this.volcadoPreview?.resultados.reduce(
        (acc, r) => acc + (r.actualizados ?? 0),
        0,
      ) ?? 0
    );
  }
  public expectedRole: 'ADMIN' | 'ALUMNO' = 'ALUMNO';
  public getEventsForDay = this.eventsService.getEventsForDay;
  public getProgressBarColor = this.eventsService.getProgressBarColor;
  public getCompletedSubBlocksForDay =
    this.eventsService.getCompletedSubBlocksForDay;
  public getProgressPercentageForDay =
    this.eventsService.getProgressPercentageForDay;
  duracionesDisponibles = duracionesDisponibles;

  // Add properties for date range
  public startDate: Date | null = null;
  public endDate: Date | null = null;

  // Para el componente de adjuntos
  public entidadTipoPlanificacion = EntidadTipo.PLANIFICACION_MENSUAL;
  public Number = Number;

  public uniqueEventsForDay = (events: CalendarEvent[], date: Date) => {
    const res = this.getEventsForDay(events, date);
    const uniqueEvents = new Map();
    res.forEach((event) => {
      if (!uniqueEvents.has(event.title)) {
        uniqueEvents.set(event.title, event);
      }
    });

    return Array.from(uniqueEvents.values());
  };

  public alternarVista = () => {
    this.view =
      this.view == CalendarView.Week ? CalendarView.Month : CalendarView.Week;
  };

  exportToGoogleCalendar(): void {
    const icsContent = this.generateICalendar();
    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'calendar-export.ics';
    link.click();

    window.URL.revokeObjectURL(url);
  }

  public generateICalendar = () => {
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Tecnika Fire//Calendar Export//EN',
    ];
    this.events.forEach((event, index) => {
      const start = new Date(event.start)
        .toISOString()
        .replace(/[-:]/g, '')
        .split('.')[0];
      const end = event.end
        ? new Date(event.end).toISOString().replace(/[-:]/g, '').split('.')[0]
        : start;

      lines.push(
        'BEGIN:VEVENT',
        `UID:${
          event.id ||
          `${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`
        }`,
        `DTSTAMP:${
          new Date().toISOString().replace(/[-:]/g, '').split('.')[0]
        }`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:${event.title}`,
        `DESCRIPTION:${
          event.meta?.subBloque?.comentarios ||
          'Evento exportado desde Tecnika Fire'
        }`,
        `LOCATION:${event.meta?.location || ''}`,
        'END:VEVENT',
      );
    });

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  };
  items = computed(() => [
    {
      disabled: this.view != CalendarView.Week,
      icon: 'fa-regular fa-hand-pointer',
      tooltipOptions: {
        position: 'right',
        tooltipLabel: 'Seleccionar una plantilla semanal',
      },
      command: () => {
        this.activeStepSeleccionPlantilla = 0;
        this.pickedEvents = [];
        this.isDialogVisible = true;
      },
    },
    {
      disabled: this.view != CalendarView.Week,
      icon: 'fa-solid fa-download',
      tooltipOptions: {
        position: 'right',
        tooltipLabel: 'Volcar variante completa',
      },
      command: () => {
        this.abrirDialogoVolcar();
      },
    },
    {
      visible: this.planificacionFisicaHabilitada(),
      icon: 'pi pi-bolt',
      tooltipOptions: {
        position: 'right',
        tooltipLabel: 'Convertir bloques ENTRENAMIENTO en física vinculada',
      },
      command: () => this.confirmarConversionBloquesFisica(),
    },
  ]);

  /**
   * Fase 2 bridge temario↔física: convierte los sub-bloques "ENTRENAMIENTO%"
   * de esta planificación en bloques vinculados a física. La acción es
   * irreversible, por eso pide confirmación explícita.
   *
   * Defensa en profundidad: aunque el botón del menú ya está gateado por
   * `planificacionFisicaHabilitada`, re-comprobamos el flag antes de abrir
   * el diálogo para evitar carreras o llamadas programáticas con el módulo OFF.
   */
  public onEventsChange(events: CalendarEvent[]): void {
    this.events = events;
    this.eventosModificados = true;
  }

  public confirmarConversionBloquesFisica(): void {
    if (!this.planificacionFisicaHabilitada()) {
      return;
    }

    if (this.eventosModificados) {
      this.toast.warning(
        'Hay cambios sin guardar en el calendario. Guarda los cambios antes de convertir bloques a física.',
      );
      return;
    }

    this.confirmationService.confirm({
      message:
        'Se enlazará un bloque ENTRENAMIENTO como entrenamiento físico por día. Si un día ya tiene varios bloques físicos, se conservará uno y los demás se desvincularán. ¿Continuar?',
      header: 'Convertir bloques a física',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Convertir',
      rejectLabel: 'Cancelar',
      accept: () => {
        const id = Number(this.activedRoute.snapshot.paramMap.get('id'));
        this.planificacionesService.convertirBloquesFisica$(id).subscribe({
          next: (res) => {
            const desmarcados = res.desmarcados ?? 0;
            if (
              res.actualizados === 0 &&
              desmarcados === 0 &&
              res.sinCoincidencia === 0 &&
              res.ignorados > 0
            ) {
              this.toast.info(
                `La planificación ya tenía un entrenamiento físico enlazado en ${res.ignorados} días.`,
              );
            } else {
              let mensaje = `Convertidos ${res.actualizados} bloques a física.`;
              if (res.ignorados > 0) {
                mensaje += ` ${res.ignorados} ya estaban vinculados.`;
              }
              if (res.sinCoincidencia > 0) {
                mensaje += ` ${res.sinCoincidencia} bloques no empiezan por ENTRENAMIENTO y no se tocaron.`;
              }
              if (desmarcados > 0) {
                mensaje += ` Se normalizaron ${desmarcados} duplicados.`;
              }
              this.toast.success(mensaje);
            }
            this.load();
          },
          error: () => {
            this.toast.error('Error al convertir los bloques a física.');
          },
        });
      },
    });
  }

  private getPlanificacion() {
    return combineLatest([
      this.activatedRoute.data,
      this.activatedRoute.queryParams,
    ]).pipe(
      filter((e) => !!e),
      tap((e) => {
        const [data, queryParams] = e;
        const { expectedRole, type } = data;
        this.expectedRole = expectedRole;
      }),
    );
  }

  public async pickedPlantilla(plantillaOverview: Partial<PlantillaSemanal>) {
    try {
      // Limpiar datos anteriores
      this.pickedEvents = [];
      this.pickedEventsViewDate = new Date();
      this.pickedPlantillaId.set(plantillaOverview.id ?? null);
      this.previewResult.set(null);

      const fullPlantilla = await firstValueFrom(
        this.planificacionesService.getPlantillaSemanalById(
          plantillaOverview.id ?? 0,
        ),
      );

      if (fullPlantilla && fullPlantilla.subBloques) {
        this.pickedEvents = this.eventsService
          .fromSubbloquesToEvents(fullPlantilla.subBloques)
          .map((e) => {
            e.draggable = false;
            e.resizable = {
              beforeStart: false,
              afterEnd: false,
            };
            return e;
          });

        // Solo calcular la fecha mínima si hay eventos
        if (this.pickedEvents.length > 0) {
          this.pickedEventsViewDate = this.eventsService.calculateMinDate(
            this.pickedEvents,
          );
        }
      }
    } catch (error) {
      console.error('Error al cargar la plantilla:', error);
      this.pickedEvents = [];
      this.pickedEventsViewDate = new Date();
      this.pickedPlantillaId.set(null);
    }
  }

  public get lunesDestino(): Date {
    return getStartOfWeek(this.viewDate);
  }

  public confirmarSemanaDestino(nextCallback: any): void {
    this.previewResult.set(null);
    nextCallback.emit();
    this.cargarPreview();
  }

  public async cargarPreview(): Promise<void> {
    const plantillaId = this.pickedPlantillaId();
    const planificacionId = this.lastLoadedPlanification()?.id;
    if (!plantillaId || !planificacionId) {
      return;
    }

    this.previewLoading.set(true);
    try {
      const res = await firstValueFrom(
        this.planificacionesService.aplicarPlantillasSemanales$({
          lunes: formatFechaISO(this.lunesDestino),
          items: [{ planificacionId, plantillaSemanalId: plantillaId }],
          preview: true,
        }),
      );
      this.previewResult.set(res?.resultados?.[0] ?? null);
    } catch (error: any) {
      const message =
        error?.error?.message || error?.message || 'Error al cargar el preview';
      this.toast.error(message);
      this.previewResult.set(null);
    } finally {
      this.previewLoading.set(false);
    }
  }

  public async aplicarPlantillaConfirmada(): Promise<void> {
    const plantillaId = this.pickedPlantillaId();
    const planificacionId = this.lastLoadedPlanification()?.id;
    if (!plantillaId || !planificacionId) {
      return;
    }

    this.aplicando.set(true);
    try {
      const res = await firstValueFrom(
        this.planificacionesService.aplicarPlantillasSemanales$({
          lunes: formatFechaISO(this.lunesDestino),
          items: [{ planificacionId, plantillaSemanalId: plantillaId }],
          preview: false,
        }),
      );
      const resultado = res?.resultados?.[0];
      if (resultado?.error) {
        this.toast.error(resultado.error);
        return;
      }
      this.toast.success(
        `Plantilla aplicada: ${resultado?.creados ?? 0} creados, ${resultado?.actualizados ?? 0} actualizados, ${resultado?.omitidos ?? 0} omitidos.`,
      );
      this.isDialogVisible = false;
      this.pickedEvents = [];
      this.pickedPlantillaId.set(null);
      this.previewResult.set(null);
      this.activeStepSeleccionPlantilla = 0;
      this.load();
    } catch (error: any) {
      const message =
        error?.error?.message ||
        error?.message ||
        'Error al aplicar la plantilla semanal';
      this.toast.error(message);
    } finally {
      this.aplicando.set(false);
    }
  }

  public abrirDialogoVolcar(): void {
    this.prefijoPlantillas = '';
    this.volcadoPreview = null;
    this.isDialogVolcarVisible = true;
  }

  public async cargarPreviewVolcado(): Promise<void> {
    const planificacionId = this.lastLoadedPlanification()?.id;
    const prefijo = this.prefijoPlantillas.trim();
    if (!planificacionId || !prefijo) {
      return;
    }

    this.volcadoPreviewLoading = true;
    try {
      const res = await firstValueFrom(
        this.planificacionesService.volcarPlantillas$(planificacionId, {
          prefijoPlantillas: prefijo,
          dryRun: true,
        }),
      );
      this.volcadoPreview = res;
    } catch (error: any) {
      const message =
        error?.error?.message || error?.message || 'Error al cargar el preview';
      this.toast.error(message);
      this.volcadoPreview = null;
    } finally {
      this.volcadoPreviewLoading = false;
    }
  }

  public async aplicarVolcadoConfirmado(): Promise<void> {
    const planificacionId = this.lastLoadedPlanification()?.id;
    const prefijo = this.prefijoPlantillas.trim();
    if (!planificacionId || !prefijo) {
      return;
    }

    this.volcando = true;
    try {
      const res = await firstValueFrom(
        this.planificacionesService.volcarPlantillas$(planificacionId, {
          prefijoPlantillas: prefijo,
          dryRun: false,
        }),
      );
      const resultadoConError = res.resultados.find(
        (resultado) => resultado.error,
      );
      if (resultadoConError?.error) {
        this.toast.error(
          `No se completó el volcado de ${resultadoConError.identificador}: ${resultadoConError.error}`,
        );
        return;
      }
      const totalCreados = res.resultados.reduce(
        (acc, r) => acc + (r.creados ?? 0),
        0,
      );
      const totalOmitidos = res.resultados.reduce(
        (acc, r) => acc + (r.omitidos ?? 0),
        0,
      );
      const totalActualizados = res.resultados.reduce(
        (acc, r) => acc + (r.actualizados ?? 0),
        0,
      );
      this.toast.success(
        `Variante volcada: ${totalCreados} creados, ${totalActualizados} actualizados, ${totalOmitidos} omitidos en ${res.totalPlantillas} plantillas.`,
      );
      this.cerrarDialogoVolcar();
      this.load();
    } catch (error: any) {
      const status = error?.status;
      const backendMessage = error?.error?.message;
      const message =
        status === 422
          ? backendMessage || 'No se han encontrado plantillas con ese prefijo'
          : backendMessage || error?.message || 'Error al volcar la variante';
      this.toast.error(message);
    } finally {
      this.volcando = false;
    }
  }

  public cerrarDialogoVolcar(): void {
    this.isDialogVolcarVisible = false;
    this.prefijoPlantillas = '';
    this.volcadoPreview = null;
  }

  public trackByResultado(
    index: number,
    resultado: VolcarPlantillasResultado,
  ): string {
    return resultado.identificador;
  }

  public diaDeBloque(bloque: PreviewBloque): string {
    return new Date(bloque.horaInicio).toLocaleDateString('es-ES', {
      weekday: 'long',
    });
  }

  public horaDeBloque(bloque: PreviewBloque): string {
    return new Date(bloque.horaInicio).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  onDayClicked(data: any): void {
    const startOfWeek = getStartOfWeek(data.day.date);
    this.viewDate = startOfWeek;

    this.view = CalendarView.Week;
  }

  constructor(private primengConfig: PrimeNGConfig) {
    this.primengConfig.setTranslation({
      firstDayOfWeek: 1,
      dayNames: [
        'domingo',
        'lunes',
        'martes',
        'miércoles',
        'jueves',
        'viernes',
        'sábado',
      ],
      dayNamesShort: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
      dayNamesMin: ['D', 'L', 'M', 'X', 'J', 'V', 'S'],
      monthNames: [
        'enero',
        'febrero',
        'marzo',
        'abril',
        'mayo',
        'junio',
        'julio',
        'agosto',
        'septiembre',
        'octubre',
        'noviembre',
        'diciembre',
      ],
      monthNamesShort: [
        'ene',
        'feb',
        'mar',
        'abr',
        'may',
        'jun',
        'jul',
        'ago',
        'sep',
        'oct',
        'nov',
        'dic',
      ],
      today: 'Hoy',
      clear: 'Borrar',
    });
    firstValueFrom(this.getPlanificacion());
  }

  public goBack() {
    return this.activedRoute.snapshot.queryParamMap.get('goBack') === 'true';
  }

  public getId() {
    return this.activedRoute.snapshot.paramMap.get('id') as number | 'new';
  }

  public gestionarPreferencias(): void {
    void this.router.navigate(['/app/planificacion/configuracion-alumno'], {
      queryParams: { gestionar: 'preferencias' },
    });
  }

  ngOnInit(): void {
    this.load();
  }

  private load() {
    this.eventosModificados = false;
    const itemId = this.getId();
    if (itemId === 'new') {
      this.formGroup.reset();
      this.formGroup.patchValue({
        ano: new Date().getFullYear(),
        mes: new Date().getMonth() + 1,
      });
    } else {
      firstValueFrom(
        this.planificacionesService.getPlanificacionMensualById$(itemId).pipe(
          tap((entry) => {
            this.lastLoadedPlanification.set(entry);
            const subBloques = entry.subBloques;

            // Convertir los subbloques a eventos
            this.events = this.eventsService.fromSubbloquesToEvents(subBloques);

            // Para alumnos, cargar también los eventos personalizados
            if (this.expectedRole === 'ALUMNO') {
              this.loadEventosPersonalizados(Number(itemId));
              this.cargarResumenFisica(this.viewDate);
            }

            // Configurar eventos para alumnos
            if (this.expectedRole === 'ALUMNO') {
              this.events.forEach((event) => {
                // Permitir arrastre para alumnos
                event.draggable = true;
                // Pero no permitir redimensionar
                event.resizable = {
                  beforeStart: false,
                  afterEnd: false,
                };

                // Aplicar posiciones personalizadas si existen
                if (event.meta?.subBloque?.posicionPersonalizada) {
                  const posicion = new Date(
                    event.meta.subBloque.posicionPersonalizada,
                  );
                  // Mantener la duración original
                  const duracion = event.end
                    ? event.end.getTime() - event.start.getTime()
                    : 0;
                  // Establecer la nueva posición
                  event.start = posicion;
                  event.end = new Date(posicion.getTime() + duracion);
                }
              });

              this.userService.getCurrentUser$().subscribe((user: any) => {
                // Fase 1 autoasignación: el alumno solo ve la ventana de
                // 2 semanas atrás + el futuro (el historial se conserva en
                // backend, la UI no lo muestra). Antes se anclaba a la fecha
                // de alta (validatedAt/createdAt), lo que podía mostrar todo
                // el histórico.
                this.startDate = getVentanaDosSemanasAtras();
                this.endDate = getNextWeekIfFriday(new Date());
              });
            }

            this.relevancia.clear();
            entry.relevancia.forEach((e) =>
              this.relevancia.push(new FormControl(e)),
            );

            this.formGroup.patchValue(entry);
            this.formGroup.markAsPristine();
          }),
        ),
      );
    }
  }

  private loadEventosPersonalizados(planificacionId: number) {
    this.planificacionesService
      .getEventosPersonalizados$(planificacionId)
      .subscribe({
        next: (eventosPersonalizados) => {
          // Agregar los eventos personalizados a la lista de eventos utilizando el servicio
          const nuevosEventos = this.eventsService.fromSubbloquesToEvents(
            [],
            eventosPersonalizados,
          );
          this.events = [...this.events, ...nuevosEventos];
        },
        error: (err) => {
          console.error('Error al cargar eventos personalizados:', err);
        },
      });
  }

  public async guardarCambios() {
    const res = await firstValueFrom(
      this.planificacionesService.createPlanificacionMensual$({
        identificador: this.formGroup.value.identificador ?? '',
        descripcion: this.formGroup.value.descripcion ?? '',
        ano: this.formGroup.value.ano ?? new Date().getFullYear(),
        mes: this.formGroup.value.mes ?? new Date().getMonth() + 1,
        id: this.getId() == 'new' ? undefined : Number(this.getId()),
        relevancia:
          (this.formGroup?.value?.relevancia as Array<Oposicion>) ?? [],
        esPorDefecto: this.formGroup.value.esPorDefecto ?? false,
        tipoDePlanificacion:
          this.formGroup.value.tipoDePlanificacion ??
          TipoDePlanificacionDeseada.FRANJA_CUATRO_A_SEIS_HORAS,
        subBloques: this.eventsService.fromEventsToSubbloques(
          this.events,
        ) as SubBloque[],
      }),
    );
    this.eventosModificados = false;
    if (this.expectedRole == 'ADMIN') {
      this.toast.success('Planificacion mensual actualizada con exito');

      await this.router.navigate([
        '/app/planificacion/planificacion-mensual/' + res.id,
      ]);
    }
  }

  /**
   * Sustituye el binding `[(viewDate)]` de `<app-calendar-header>` (equivale
   * exactamente a la sintaxis banana-in-a-box que había antes) para poder
   * enganchar el refetch del bridge física cada vez que el alumno navega de
   * semana/mes en el calendario del temario.
   */
  public onViewDateChange(date: Date): void {
    this.viewDate = date;
    if (this.expectedRole === 'ALUMNO') {
      this.cargarResumenFisica(date);
    }
  }

  /**
   * Rango razonable alrededor de `fecha` para pedir el bridge física: el
   * mes visible + una semana de margen a cada lado (cubre la semana visible
   * cuando cae a caballo entre meses). Muy por debajo del cap de 92 días
   * del backend.
   */
  private rangoResumenFisica(fecha: Date): { desde: string; hasta: string } {
    const inicioMes = new Date(fecha.getFullYear(), fecha.getMonth(), 1);
    inicioMes.setDate(inicioMes.getDate() - 7);
    const finMes = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0);
    finMes.setDate(finMes.getDate() + 7);
    return { desde: formatFechaISO(inicioMes), hasta: formatFechaISO(finMes) };
  }

  /**
   * Carga el bridge temario↔física. ADITIVO y DEFENSIVO por diseño: nunca
   * debe poder tumbar el calendario del temario. Cualquier fallo (red, 5xx,
   * cálculo de rango) se traga aquí y deja `resumenFisica` en `[]` — el
   * resto del componente ni se entera.
   *
   * Si el módulo PLANIFICACION_FISICA está OFF, no llamamos al endpoint
   * (evita el 403 visible en prod para alumnos sin el módulo activo).
   */
  private cargarResumenFisica(fecha: Date = this.viewDate): void {
    const carga = ++this.cargaResumenFisicaActual;
    if (!this.planificacionFisicaHabilitada()) {
      this.resumenFisica.set([]);
      return;
    }

    const planificacionId = this.lastLoadedPlanification()?.id;
    if (!planificacionId) {
      this.resumenFisica.set([]);
      return;
    }

    try {
      const { desde, hasta } = this.rangoResumenFisica(fecha);
      this.planificacionFisicaService
        .resumenDias(planificacionId, desde, hasta)
        .pipe(
          catchError((err) => {
            console.error(
              'Bridge física: no se pudo cargar el resumen (el temario sigue intacto):',
              err,
            );
            return of([] as ResumenDiaFisica[]);
          }),
        )
        .subscribe((dias) => {
          if (carga === this.cargaResumenFisicaActual) {
            this.resumenFisica.set(dias ?? []);
          }
        });
    } catch (err) {
      console.error(
        'Bridge física: error inesperado calculando el rango:',
        err,
      );
      this.resumenFisica.set([]);
    }
  }

  /**
   * Bridge temario↔física en vista MENSUAL: mismo patrón que
   * `VistaSemanalComponent.resumenFisicaDelDia`/`tieneFisica`/`etiquetaFisica`/
   * `abrirFisica` (ver comentarios ahí), replicado aquí porque la celda del
   * mes (`customCellTemplate`) vive en este componente y no en
   * `vista-semanal`. Aditivo y defensivo: si `resumenFisica()` está vacío
   * (bloque BASIC, sin plan, o fallo de `cargarResumenFisica`) estos métodos
   * simplemente no pintan nada — la celda del mes sigue funcionando igual.
   */
  private resumenFisicaDelDia(dia: Date): ResumenDiaFisica | undefined {
    const fecha = formatFechaISO(dia);
    return this.resumenFisica().find((d) => d.fecha === fecha);
  }

  tieneFisica(dia: Date): boolean {
    const resumen = this.resumenFisicaDelDia(dia);
    return !!resumen && resumen.disciplinas.length > 0;
  }

  etiquetaFisica(dia: Date): string {
    const resumen = this.resumenFisicaDelDia(dia);
    if (!resumen) return '';
    return resumen.disciplinas.map((d) => d.nombre).join(', ');
  }

  /**
   * Click en la insignia de física de la celda del mes: navega al detalle
   * del día en el módulo de física. `stopPropagation`+`preventDefault` para
   * que NO dispare `(dayClicked)` de `mwl-calendar-month-view` (que abre la
   * semana de ese día en `onDayClicked`) — el temario mensual sigue
   * intacto, esto es puramente un atajo aparte.
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
        originPlanificacionId: this.lastLoadedPlanification()?.id,
      },
    });
  }

  onDateSelect(event: Date): void {
    const selectedDate = new Date(event);
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth() + 1; // Mes empieza desde 0

    this.formGroup.patchValue({
      mes: month,
      ano: year,
    });

    this.viewDate = new Date(year, month - 1, 1);
  }
}
