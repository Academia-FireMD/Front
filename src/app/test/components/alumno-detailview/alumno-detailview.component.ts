import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  computed,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import {
  catchError,
  distinctUntilChanged,
  firstValueFrom,
  map,
  merge,
  of,
  Subject,
  switchMap,
} from 'rxjs';
import { AlumnoAdminService } from '../../../services/alumno-admin.service';
import { AuthService } from '../../../services/auth.service';
import { AppConfigService } from '../../../services/app-config.service';
import { UserService } from '../../../services/user.service';
import { PlanificacionesService } from '../../../services/planificaciones.service';
import { LabelsService } from '../../../shared/services/labels.service';
import {
  PlanificacionFisicaService,
  MarcaPersonal,
} from '../../../planificacion-fisica/services/planificacion-fisica.service';
import { AlumnoInformacionComponent } from '../../../shared/alumno-cards/alumno-informacion.component';
import { AlumnoSuscripcionesComponent } from '../../../shared/alumno-cards/alumno-suscripciones.component';
import { AlumnoAccesosComponent } from '../../../shared/alumno-cards/alumno-accesos.component';
import {
  FichaAlumno,
  WooAlumno,
  OperacionAlumno,
  SuscripcionWooAlumno,
  RenovacionAlumno,
  PaginaActividadAlumno,
} from '../../../shared/models/alumno-admin.model';
import { Label } from '../../../shared/models/label.model';
import { ModuloApp } from '../../../shared/models/modulo-app.enum';
import {
  Suscripcion,
  Oposicion,
  SuscripcionTipo,
  getPlanLabel,
  OPOSICION_LABELS,
} from '../../../shared/models/subscription.model';
import { Usuario } from '../../../shared/models/user.model';
import { esSuscripcionVigente } from '../../../shared/utils/membresia-externa.util';
import { PrimengModule } from '../../../shared/primeng.module';

type SeccionAlumno = 'info' | 'access' | 'woo' | 'planning' | 'activity';
type DialogoAlumno = {
  tipo:
    | 'editar'
    | 'etiquetas'
    | 'baja'
    | 'plan'
    | 'eliminar'
    | 'desvincular'
    | 'alta'
    | 'cancelarWoo'
    | 'reintentarWoo';
  usuarioId: number;
  nombre: string;
  email: string;
  suscripcion?: Suscripcion;
  planificacionId?: number;
  wooSub?: SuscripcionWooAlumno;
  renovacion?: RenovacionAlumno;
  clave?: string;
};
type EtiquetaBorrador = {
  clientId: string;
  id?: string;
  key: string;
  value?: string;
};
@Component({
  selector: 'app-alumno-detailview',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PrimengModule,
    AlumnoInformacionComponent,
    AlumnoSuscripcionesComponent,
    AlumnoAccesosComponent,
  ],
  templateUrl: './alumno-detailview.component.html',
  styleUrls: [
    '../../../shared/alumno-cards/alumno-cards.scss',
    './alumno-detailview.component.scss',
  ],
})
export class AlumnoDetailviewComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  private readonly api = inject(AlumnoAdminService);
  private readonly users = inject(UserService);
  private readonly auth = inject(AuthService);
  private readonly labelsApi = inject(LabelsService);
  private readonly planesApi = inject(PlanificacionesService);
  private readonly fisica = inject(PlanificacionFisicaService);
  private readonly appConfig = inject(AppConfigService);
  private readonly toast = inject(ToastrService);
  private readonly recargar = new Subject<void>();
  private versionRuta = 0;
  resultadoOperacion = '';
  private finOperacion: Promise<boolean> | null = null;
  private resolverOperacion: ((ok: boolean) => void) | null = null;
  @ViewChild('tituloFicha') titulo?: ElementRef<HTMLElement>;
  readonly secciones: { id: SeccionAlumno; label: string; icon: string }[] = [
    { id: 'info', label: 'Información personal', icon: 'user' },
    { id: 'access', label: 'Acceso y suscripciones', icon: 'id-card' },
    { id: 'woo', label: 'WooCommerce', icon: 'credit-card' },
    { id: 'planning', label: 'Planificaciones y marcas', icon: 'calendar' },
    { id: 'activity', label: 'Actividad', icon: 'history' },
  ];
  readonly fisicaHabilitada = computed(
    () =>
      this.appConfig.estadoModulos()[ModuloApp.PLANIFICACION_FISICA] !== false,
  );
  ficha: FichaAlumno | null = null;
  id = 0;
  seccion: SeccionAlumno = 'access';
  cargando = true;
  error = '';
  errorDialogo = '';
  ocupado = false;
  dialogo: DialogoAlumno | null = null;
  motivo = '';
  emailConfirmacion = '';
  edicion = { nombre: '', apellidos: '', esTutor: false, fechaGrabadas: '' };
  private fechaGrabadasInicial = '';
  etiquetas: EtiquetaBorrador[] = [];
  etiquetasDisponibles: Label[] = [];
  etiquetaSeleccionada = '';
  nuevaClave = '';
  nuevoValor = '';
  planificaciones: {
    planificacion: {
      id: number;
      identificador: string;
      descripcion?: string;
      subBloques?: unknown[];
    };
  }[] = [];
  marcas: MarcaPersonal[] = [];
  cargandoPlanes = false;
  errorPlanes = '';
  errorMarcas = '';
  woo: WooAlumno | null = null;
  cargandoWoo = false;
  errorWoo = '';
  operaciones: OperacionAlumno[] = [];
  modoCancelacion: 'AHORA' | 'FIN_PERIODO' = 'FIN_PERIODO';
  confirmaCobro = false;
  nuevaOposicion = '';
  nuevoTipo = '';
  readonly oposiciones = Object.entries(OPOSICION_LABELS).filter(
    ([key]) => key !== 'GENERAL',
  );
  readonly tiposPlan = [
    SuscripcionTipo.BASIC,
    SuscripcionTipo.ADVANCED,
    SuscripcionTipo.PREMIUM,
  ];
  readonly planNombre = getPlanLabel;

  actividad: PaginaActividadAlumno | null = null;
  cargandoActividad = false;
  errorActividad = '';
  constructor() {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe((params) => {
        const tab = params.get('tab');
        this.seccion = this.secciones.some((s) => s.id === tab)
          ? (tab as SeccionAlumno)
          : 'access';
        if (this.ficha) this.cargarSeccion();
      });
    this.route.paramMap
      .pipe(
        map((params) => Number(params.get('id'))),
        distinctUntilChanged(),
        switchMap((id) => {
          this.versionRuta++;
          this.resultadoOperacion = '';
          this.cargandoPlanes = false;
          this.cargandoActividad = false;
          this.cargandoWoo = false;
          this.woo = null;
          this.operaciones = [];
          this.errorWoo = '';
          this.errorPlanes = '';
          this.errorMarcas = '';
          this.id = id;
          this.ficha = null;
          this.dialogo = null;
          this.cargando = true;
          this.error = '';
          this.actividad = null;
          this.planificaciones = [];
          this.marcas = [];
          if (!Number.isSafeInteger(id) || id <= 0) {
            this.cargando = false;
            this.error = 'El identificador del alumno no es válido.';
            return of(null);
          }
          return merge(of(undefined), this.recargar).pipe(
            switchMap(() => {
              this.cargando = true;
              return this.api.detalle(id).pipe(
                catchError((error) => {
                  this.cargando = false;
                  this.error =
                    error?.status === 404
                      ? 'Alumno no encontrado.'
                      : error?.message || 'No se ha podido cargar la ficha.';
                  return of(null);
                }),
              );
            }),
          );
        }),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((ficha) => {
        this.cargando = false;
        if (!ficha) return;
        this.error = '';
        this.ficha = ficha;
        this.cargarSeccion();
      });
  }
  get nombre() {
    return this.ficha
      ? [this.ficha.usuario.nombre, this.ficha.usuario.apellidos]
          .filter(Boolean)
          .join(' ') || this.ficha.usuario.email
      : '';
  }
  get iniciales() {
    return this.ficha
      ? `${this.ficha.usuario.nombre?.[0] || ''}${this.ficha.usuario.apellidos?.[0] || ''}` ||
          'AL'
      : '';
  }
  get gestionLabel() {
    return (
      (
        {
          EXTERNA: 'Gestión externa',
          WOOCOMMERCE: 'WooCommerce',
          MIXTA: 'Cuenta mixta',
          POR_VERIFICAR: 'Gestión por comprobar',
        } as Record<string, string>
      )[this.ficha?.gestion.tipo || ''] || ''
    );
  }
  get planesVigentes() {
    return (
      this.ficha?.usuario.suscripciones?.filter((s) =>
        esSuscripcionVigente(s),
      ) || []
    );
  }
  get dialogoTitulo() {
    return (
      (
        {
          editar: 'Editar alumno',
          etiquetas: 'Etiquetas del alumno',
          baja: 'Dar de baja la membresía externa',
          plan: 'Cancelar solo este plan',
          eliminar: 'Eliminar definitivamente al alumno',
          desvincular: 'Desvincular planificación',
          alta: 'Añadir plan externo',
          cancelarWoo: 'Cancelar suscripción WooCommerce',
          reintentarWoo: 'Reintentar esta renovación',
        } as Record<string, string>
      )[this.dialogo?.tipo || ''] || ''
    );
  }
  get puedeConfirmar() {
    return (
      !this.ocupado &&
      !!this.dialogo &&
      (this.dialogo.tipo !== 'reintentarWoo' || this.confirmaCobro) &&
      (this.dialogo.tipo !== 'alta' ||
        (!!this.nuevaOposicion && !!this.nuevoTipo)) &&
      (this.dialogo.tipo !== 'eliminar' ||
        this.emailConfirmacion.trim() === this.dialogo.email)
    );
  }
  cambiarSeccion(seccion: SeccionAlumno) {
    if (this.ocupado) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: seccion },
      queryParamsHandling: 'merge',
    });
  }
  tecladoPestanas(event: KeyboardEvent, index: number) {
    let next: number | undefined;
    if (event.key === 'ArrowRight') next = (index + 1) % this.secciones.length;
    if (event.key === 'ArrowLeft')
      next = (index + this.secciones.length - 1) % this.secciones.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = this.secciones.length - 1;
    if (next !== undefined) {
      event.preventDefault();
      const section = this.secciones[next];
      this.cambiarSeccion(section.id);
      requestAnimationFrame(() =>
        document.getElementById('ficha-tab-' + section.id)?.focus(),
      );
    }
  }
  volver() {
    const params = { ...this.route.snapshot.queryParams };
    delete params['tab'];
    void this.router.navigate(['/app/test/user'], { queryParams: params });
  }
  actualizar() {
    if (this.ocupado) return;
    this.error = '';
    this.actividad = null;
    this.recargar.next();
  }
  prepararSalida(): boolean | Promise<boolean> {
    if (this.ocupado) return this.finOperacion || true;
    this.cerrarDialogo();
    return true;
  }
  cerrarDialogo() {
    if (this.ocupado) return;
    this.dialogo = null;
    this.errorDialogo = '';
  }
  private abrir(
    tipo: DialogoAlumno['tipo'],
    extra: Partial<DialogoAlumno> = {},
  ) {
    if (!this.ficha || this.ocupado) return;
    this.dialogo = {
      tipo,
      usuarioId: this.id,
      nombre: this.nombre,
      email: this.ficha.usuario.email,
      ...extra,
    };
    this.errorDialogo = '';
    this.motivo = '';
    this.emailConfirmacion = '';
    this.confirmaCobro = false;
  }
  abrirEditar() {
    if (!this.ficha) return;
    this.abrir('editar');
    const u = this.ficha.usuario;
    this.fechaGrabadasInicial = this.fechaInput(u.fechaAccesoClasesGrabadas);
    this.edicion = {
      nombre: u.nombre,
      apellidos: u.apellidos,
      esTutor: u.esTutor,
      fechaGrabadas: this.fechaGrabadasInicial,
    };
  }
  private fechaInput(value: string | null | undefined) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  abrirBaja() {
    if (this.ficha?.gestion.capacidades.puedeDarBajaExterna) this.abrir('baja');
  }
  abrirEliminar() {
    if (this.ficha?.gestion.capacidades.puedeEliminar) this.abrir('eliminar');
  }
  abrirCancelarPlan(suscripcion: Suscripcion) {
    if (
      this.ficha?.gestion.capacidades.suscripcionesExternas.includes(
        suscripcion.id,
      )
    )
      this.abrir('plan', { suscripcion });
  }
  planLabel(s: Suscripcion) {
    return `${getPlanLabel(s.tipo)} · ${(OPOSICION_LABELS as Record<string, string>)[s.oposicion] || s.oposicion}`;
  }
  verWoo() {
    this.cambiarSeccion('woo');
  }
  abrirEditarPlan(s: Suscripcion) {
    if (this.ficha?.gestion.tipo !== 'EXTERNA') return;
    this.abrir('alta', { suscripcion: s });
    this.nuevaOposicion = s.oposicion;
    this.nuevoTipo = s.tipo;
  }
  abrirAlta() {
    if (this.ficha?.gestion.tipo !== 'EXTERNA') return;
    this.abrir('alta');
    this.nuevaOposicion = '';
    this.nuevoTipo = '';
  }
  oposicionYaActiva(op: string) {
    return this.planesVigentes.some((s) => s.oposicion === op);
  }
  async abrirEtiquetas() {
    if (!this.ficha) return;
    this.abrir('etiquetas');
    this.etiquetas = (this.ficha.usuario.labels || []).map((l) => ({
      clientId: l.labelId,
      id: l.labelId,
      key: l.label.key,
      value: l.label.value,
    }));
    this.nuevaClave = '';
    this.nuevoValor = '';
    this.etiquetaSeleccionada = '';
    const id = this.id,
      version = this.versionRuta,
      dialogo = this.dialogo;
    this.etiquetasDisponibles = [];
    try {
      const labels = await firstValueFrom(this.labelsApi.getLabels());
      if (
        id === this.id &&
        version === this.versionRuta &&
        dialogo === this.dialogo
      )
        this.etiquetasDisponibles = labels;
    } catch {
      if (
        id === this.id &&
        version === this.versionRuta &&
        dialogo === this.dialogo
      )
        this.errorDialogo =
          'No se ha podido cargar el catálogo. Puedes conservar las etiquetas actuales y volver a intentarlo.';
    }
  }
  agregarEtiqueta() {
    const label = this.etiquetasDisponibles.find(
      (l) => l.id === this.etiquetaSeleccionada,
    );
    if (label && !this.etiquetas.some((l) => l.id === label.id))
      this.etiquetas.push({
        clientId: label.id,
        id: label.id,
        key: label.key,
        value: label.value,
      });
    this.etiquetaSeleccionada = '';
  }
  crearEtiqueta() {
    const key = this.nuevaClave.trim(),
      value = this.nuevoValor.trim();
    if (!key) return;
    if (!this.etiquetas.some((l) => l.key === key && (l.value || '') === value))
      this.etiquetas.push({
        clientId: crypto.randomUUID(),
        key,
        value: value || undefined,
      });
    this.nuevaClave = '';
    this.nuevoValor = '';
  }
  quitarEtiqueta(clientId: string) {
    this.etiquetas = this.etiquetas.filter((l) => l.clientId !== clientId);
  }
  private async ejecutar(fn: () => Promise<unknown>, mensaje: string) {
    if (this.ocupado) return;
    this.ocupado = true;
    this.errorDialogo = '';
    this.finOperacion = new Promise(
      (resolve) => (this.resolverOperacion = resolve),
    );
    try {
      await fn();
      this.resultadoOperacion = mensaje;
      this.dialogo = null;
      this.toast.success(mensaje);
      this.actividad = null;
      this.recargar.next();
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>('[data-testid="admin-operation-result"]')
          ?.focus(),
      );
    } catch (error: any) {
      this.errorDialogo =
        error?.message || 'No se ha podido completar la operación.';
    } finally {
      this.ocupado = false;
      this.resolverOperacion?.(true);
      this.resolverOperacion = null;
      this.finOperacion = null;
    }
  }
  async confirmar() {
    const d = this.dialogo;
    if (!d || !this.puedeConfirmar) return;
    if (d.tipo === 'cancelarWoo' || d.tipo === 'reintentarWoo') {
      await this.confirmarWoo(d);
      return;
    }
    if (d.tipo === 'alta') {
      await this.ejecutar(
        () =>
          firstValueFrom(
            this.users.createUserSubscription(
              d.usuarioId,
              this.nuevoTipo,
              this.nuevaOposicion,
            ),
          ),
        'Plan externo añadido.',
      );
      return;
    }
    if (d.tipo === 'editar') {
      if (!this.edicion.nombre.trim() || !this.edicion.apellidos.trim()) {
        this.errorDialogo = 'Introduce nombre y apellidos.';
        return;
      }
      const cambios: Partial<Usuario> = {
        nombre: this.edicion.nombre.trim(),
        apellidos: this.edicion.apellidos.trim(),
        esTutor: this.edicion.esTutor,
      };
      if (this.edicion.fechaGrabadas !== this.fechaGrabadasInicial)
        cambios.fechaAccesoClasesGrabadas = this.edicion.fechaGrabadas
          ? new Date(`${this.edicion.fechaGrabadas}T00:00:00`).toISOString()
          : null;
      await this.ejecutar(
        () => firstValueFrom(this.users.updateUser(d.usuarioId, cambios)),
        'Datos del alumno actualizados.',
      );
    } else if (d.tipo === 'etiquetas') {
      const antes = (this.ficha?.usuario.labels || []).map((l) => l.labelId),
        despues = this.etiquetas.flatMap((l) => (l.id ? [l.id] : []));
      const cambios = {
        asignarIds: despues.filter((id) => !antes.includes(id)),
        retirarIds: antes.filter((id) => !despues.includes(id)),
        crear: this.etiquetas
          .filter((l) => !l.id)
          .map((l) => ({ key: l.key, value: l.value })),
      };
      await this.ejecutar(
        () =>
          firstValueFrom(
            this.labelsApi.aplicarCambiosUsuario(d.usuarioId, cambios),
          ),
        'Etiquetas guardadas.',
      );
    } else if (d.tipo === 'baja')
      await this.ejecutar(
        () =>
          firstValueFrom(
            this.users.cancelExternalMembership$(d.usuarioId, this.motivo),
          ),
        'Membresía externa dada de baja.',
      );
    else if (d.tipo === 'plan' && d.suscripcion)
      await this.ejecutar(
        () =>
          firstValueFrom(this.users.cancelUserSubscription(d.suscripcion!.id)),
        'Plan externo cancelado.',
      );
    else if (d.tipo === 'desvincular' && d.planificacionId)
      await this.ejecutar(
        () =>
          firstValueFrom(
            this.planesApi.desvincularPlanificacionMensualAdmin$(
              d.planificacionId!,
              d.usuarioId,
            ),
          ),
        'Planificación desvinculada.',
      );
    else if (d.tipo === 'eliminar') {
      if (this.emailConfirmacion.trim() !== d.email) return;
      this.ocupado = true;
      this.finOperacion = new Promise(
        (resolve) => (this.resolverOperacion = resolve),
      );
      try {
        await firstValueFrom(
          this.api.eliminar(d.usuarioId, this.emailConfirmacion.trim()),
        );
        this.dialogo = null;
        this.toast.success('Alumno y datos propios eliminados.');
        this.ocupado = false;
        this.resolverOperacion?.(true);
        this.volver();
      } catch (error: any) {
        this.errorDialogo =
          error?.message || 'No se ha podido eliminar el alumno.';
      } finally {
        this.ocupado = false;
        this.resolverOperacion?.(true);
        this.finOperacion = null;
        this.resolverOperacion = null;
      }
    }
  }
  private cargarSeccion() {
    if (this.seccion === 'woo' && !this.woo) void this.cargarWoo();
    if (this.seccion === 'planning') void this.cargarPlanes();
    if (this.seccion === 'activity' && !this.actividad)
      void this.cargarActividad();
  }
  async cargarPlanes() {
    if (this.cargandoPlanes) return;
    const id = this.id;
    const version = this.versionRuta;
    this.cargandoPlanes = true;
    this.errorPlanes = '';
    const results = await Promise.allSettled([
      firstValueFrom(this.users.getUserPlanifications$(id)),
      this.fisicaHabilitada()
        ? firstValueFrom(this.fisica.marcasDeAlumno(id))
        : Promise.resolve([]),
    ]);
    if (id !== this.id || version !== this.versionRuta) return;
    this.cargandoPlanes = false;
    if (results[0].status === 'fulfilled')
      this.planificaciones = results[0].value;
    else this.errorPlanes = 'No se ha podido cargar la planificación.';
    if (results[1].status === 'fulfilled') this.marcas = results[1].value;
    else this.errorMarcas = 'No se han podido cargar las marcas físicas.';
  }

  verPlanificacion(id: number) {
    void this.router.navigate(['/app/planificacion/planificacion-mensual', id]);
  }
  desvincular(id: number) {
    this.abrir('desvincular', { planificacionId: id });
  }
  async cargarActividad(page = 1) {
    const id = this.id;
    const version = this.versionRuta;
    this.cargandoActividad = true;
    this.errorActividad = '';
    try {
      const data = await firstValueFrom(this.api.actividad(id, page));
      if (id === this.id && version === this.versionRuta) {
        this.actividad = data;
        requestAnimationFrame(() =>
          document.getElementById('actividad-paginacion')?.focus(),
        );
      }
    } catch (error: any) {
      if (id === this.id && version === this.versionRuta)
        this.errorActividad =
          error?.message || 'No se ha podido cargar la actividad.';
    } finally {
      if (id === this.id && version === this.versionRuta)
        this.cargandoActividad = false;
    }
  }
  async cargarWoo() {
    if (this.cargandoWoo) return;
    const id = this.id,
      version = this.versionRuta;
    this.cargandoWoo = true;
    this.errorWoo = '';
    try {
      const data = await firstValueFrom(this.api.woocommerce(id));
      if (id === this.id && version === this.versionRuta) {
        this.woo = data;
        const ids = new Set(data.operaciones.map((o) => o.id));
        this.operaciones = [
          ...data.operaciones,
          ...this.operaciones.filter((o) => !ids.has(o.id)),
        ];
      }
    } catch (e: any) {
      if (id === this.id && version === this.versionRuta)
        this.errorWoo = e?.message || 'No se ha podido consultar WooCommerce.';
    } finally {
      if (id === this.id && version === this.versionRuta)
        this.cargandoWoo = false;
    }
  }
  operacionPendiente(subId: number) {
    return this.operaciones.some(
      (o) =>
        o.suscripcionId === String(subId) &&
        ['EN_CURSO', 'INCIERTA'].includes(o.estado),
    );
  }
  cancelarWoo(sub: SuscripcionWooAlumno) {
    this.modoCancelacion = sub.puedeCancelarFinPeriodo
      ? 'FIN_PERIODO'
      : 'AHORA';
    this.abrir('cancelarWoo', { wooSub: sub, clave: crypto.randomUUID() });
  }
  reintentarWoo(sub: SuscripcionWooAlumno, renovacion: RenovacionAlumno) {
    if (!renovacion.puedeReintentar) return;
    this.abrir('reintentarWoo', {
      wooSub: sub,
      renovacion: { ...renovacion },
      clave: crypto.randomUUID(),
    });
  }
  importeWoo(renovacion: RenovacionAlumno) {
    if (!Number.isSafeInteger(renovacion.importeCentimos) || !renovacion.moneda)
      return 'Importe sin verificar';
    try {
      return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: renovacion.moneda,
      }).format(renovacion.importeCentimos! / 100);
    } catch {
      return 'Importe sin verificar';
    }
  }
  estadoWoo(estado: string) {
    return (
      (
        {
          active: 'Activa',
          'pending-cancel': 'Baja programada',
          cancelled: 'Cancelada',
          'on-hold': 'En espera',
          expired: 'Caducada',
          pending: 'Pendiente de pago',
          failed: 'Pago fallido',
          processing: 'Pagado',
          completed: 'Completado',
          EN_CURSO: 'En curso',
          INCIERTA: 'Pendiente de verificar',
          RECHAZADA: 'Rechazada',
          COMPLETADA: 'Completada',
        } as Record<string, string>
      )[estado] || estado
    );
  }
  private guardarOperacion(op: OperacionAlumno) {
    this.operaciones = [op, ...this.operaciones.filter((o) => o.id !== op.id)];
    this.resultadoOperacion = op.mensaje || this.estadoWoo(op.estado);
  }
  private async confirmarWoo(d: DialogoAlumno) {
    if (!d.clave || !d.wooSub) return;
    this.ocupado = true;
    this.errorDialogo = '';
    this.finOperacion = new Promise(
      (resolve) => (this.resolverOperacion = resolve),
    );
    const provisional: OperacionAlumno = {
      id: d.clave,
      tipo: d.tipo === 'cancelarWoo' ? 'CANCELAR_WOO' : 'REINTENTAR_RENOVACION',
      estado: 'INCIERTA',
      usuarioId: d.usuarioId,
      suscripcionId: String(d.wooSub.id),
      pedidoId: d.renovacion ? String(d.renovacion.id) : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      mensaje:
        'No se ha confirmado el resultado. Consulta esta operación antes de repetir la acción.',
    };
    try {
      const target =
        d.tipo === 'cancelarWoo'
          ? `suscripciones/${d.wooSub.id}/cancelar`
          : `renovaciones/${d.renovacion!.id}/reintentar`;
      const body =
        d.tipo === 'cancelarWoo'
          ? { modo: this.modoCancelacion, motivo: this.motivo }
          : {
              importeConfirmadoCentimos: d.renovacion!.importeCentimos,
              moneda: d.renovacion!.moneda,
            };
      const op = await firstValueFrom(
        this.api.accionWoo(d.usuarioId, target, d.clave, body),
      );
      this.guardarOperacion(op);
      this.dialogo = null;
      this.woo = null;
      void this.cargarWoo();
      this.recargar.next();
    } catch (e: any) {
      if (e?.status && e.status < 500) {
        this.errorDialogo =
          e.message || 'La acción no se ha aceptado. Actualiza la ficha.';
      } else {
        this.guardarOperacion(provisional);
        this.dialogo = null;
      }
    } finally {
      this.ocupado = false;
      this.resolverOperacion?.(true);
      this.resolverOperacion = null;
      this.finOperacion = null;
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>('[data-testid="admin-operation-result"]')
          ?.focus(),
      );
    }
  }
  async consultarOperacion(op: OperacionAlumno) {
    if (this.ocupado) return;
    const id = this.id,
      version = this.versionRuta;
    try {
      const data = await firstValueFrom(this.api.operacion(id, op.id));
      if (id === this.id && version === this.versionRuta) {
        this.guardarOperacion(data);
        this.woo = null;
        void this.cargarWoo();
        this.recargar.next();
      }
    } catch (e: any) {
      if (id === this.id && version === this.versionRuta)
        this.errorWoo =
          e?.status === 404
            ? 'La operación aún no consta en el servidor. Conserva su referencia y vuelve a consultar.'
            : e?.message || 'No se pudo verificar el resultado.';
    }
  }
  tituloActividad(tipo: string) {
    return (
      (
        {
          BAJA: 'Plan externo cancelado',
          BAJA_TOTAL: 'Membresía externa dada de baja',
          ACTUALIZAR_ETIQUETAS: 'Etiquetas actualizadas',
          ACTUALIZAR_DATOS: 'Datos del alumno actualizados',
          ELIMINAR_PLAN_EXTERNO: 'Plan externo eliminado',
        } as Record<string, string>
      )[tipo] || tipo.replace(/_/g, ' ').toLowerCase()
    );
  }
  async entrarComoAlumno() {
    if (!this.ficha || this.ocupado) return;
    const id = this.id,
      nombre = this.nombre;
    this.ocupado = true;
    this.finOperacion = new Promise(
      (resolve) => (this.resolverOperacion = resolve),
    );
    try {
      await firstValueFrom(this.auth.impersonateUser$(id));
      this.ocupado = false;
      this.resolverOperacion?.(true);
      this.toast.success(`Ahora estás accediendo como ${nombre}`);
      void this.router.navigate(['/app/profile']);
    } catch (error: any) {
      this.toast.error(
        error?.message || 'No se ha podido abrir la vista del alumno.',
      );
    } finally {
      this.ocupado = false;
      this.resolverOperacion?.(true);
      this.resolverOperacion = null;
      this.finOperacion = null;
    }
  }
}
