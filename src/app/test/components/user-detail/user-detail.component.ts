import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { firstValueFrom } from 'rxjs';
import { cloneDeep } from 'lodash';
import { AppConfigService } from '../../../services/app-config.service';
import { AuthService } from '../../../services/auth.service';
import { PlanificacionesService } from '../../../services/planificaciones.service';
import { UserService } from '../../../services/user.service';
import { ModuloApp } from '../../../shared/models/modulo-app.enum';
import {
  SuscripcionAdministrativa,
  UsuarioAdministrativo,
} from '../../../shared/models/user.model';
import { PrimengModule } from '../../../shared/primeng.module';
import {
  PlanificacionFisicaService,
  MarcaPersonal,
} from '../../../planificacion-fisica/services/planificacion-fisica.service';
import { LabelsService } from '../../../shared/services/labels.service';
import { labelDisplay, Label } from '../../../shared/models/label.model';
import {
  Oposicion,
  OPOSICION_LABELS,
  SuscripcionTipo,
} from '../../../shared/models/subscription.model';
import { ToastrService } from 'ngx-toastr';
import {
  getUserActivity,
  isSubscriptionCurrent,
} from '../../../shared/utils/user-activity.utils';
import { AsignacionAdministrativa } from '../../../shared/models/planificacion.model';

@Component({
  selector: 'app-user-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, PrimengModule],
  templateUrl: './user-detail.component.html',
  styleUrl: './user-detail.component.scss',
})
export class UserDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly users = inject(UserService);
  private readonly planificaciones = inject(PlanificacionesService);
  private readonly fisica = inject(PlanificacionFisicaService);
  private readonly auth = inject(AuthService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly config = inject(AppConfigService);
  private readonly labels = inject(LabelsService);
  private readonly toast = inject(ToastrService);

  readonly planificacionFisicaHabilitada = computed(
    () => this.config.estadoModulos()[ModuloApp.PLANIFICACION_FISICA] !== false,
  );
  user?: UsuarioAdministrativo;
  editableUser?: UsuarioAdministrativo;
  editFechaClasesGrabadas: Date | null = null;
  asignaciones: AsignacionAdministrativa[] = [];
  marcas: MarcaPersonal[] = [];
  loading = true;
  error = false;
  notFound = false;
  unlinkingPlanificacionId?: number;
  deleting = false;
  savingEdit = false;
  impersonating = false;
  editVisible = false;
  subscriptionVisible = false;
  labelsVisible = false;
  mutatingSubscription = false;
  mutatingLabels = false;
  loadingAsignaciones = false;
  loadingMarcas = false;
  asignacionesError = false;
  marcasError = false;
  availableLabels: Array<Label & { display: string }> = [];
  selectedLabelId = '';
  creatingNewLabel = false;
  newLabelKey = '';
  newLabelValue = '';
  selectedSubscriptionType = SuscripcionTipo.BASIC;
  selectedOposicion = Oposicion.VALENCIA_AYUNTAMIENTO;
  readonly subscriptionTypes = [
    SuscripcionTipo.BASIC,
    SuscripcionTipo.ADVANCED,
    SuscripcionTipo.PREMIUM,
  ];
  readonly oposiciones = Object.values(Oposicion)
    .filter((value) => value !== Oposicion.GENERAL)
    .map((value) => ({ value, label: OPOSICION_LABELS[value] || value }));
  readonly onboardingGroups = [
    ['Oposición', 'tipoOposicion'],
    ['Nivel', 'nivelOposicion'],
    ['Planificación deseada', 'tipoDePlanificacionDuracionDeseada'],
    ['DNI', 'dni'],
    ['Fecha de nacimiento', 'fechaNacimiento'],
    ['Empresa', 'nombreEmpresa'],
    ['País / región', 'paisRegion'],
    ['Dirección', 'direccionCalle'],
    ['Código postal', 'codigoPostal'],
    ['Población', 'poblacion'],
    ['Provincia', 'provincia'],
    ['Teléfono', 'telefono'],
    ['Municipio', 'municipioResidencia'],
    ['Estudios previos', 'estudiosPrevaios'],
    ['Trabajo u ocupación', 'actualTrabajoOcupacion'],
    ['Hobbies', 'hobbies'],
    ['Descripción semanal', 'descripcionSemana'],
    ['Horas estudio/día', 'horasEstudioDiaSemana'],
    ['Horas entreno/día', 'horasEntrenoDiaSemana'],
    ['Organización estudio-entreno', 'organizacionEstudioEntreno'],
    ['Experiencia en temario', 'temaPersonal'],
    ['Oposiciones y resultados', 'oposicionesHechasResultados'],
    ['Pruebas físicas', 'pruebasFisicas'],
    ['Técnicas de estudio', 'tecnicasEstudioUtilizadas'],
    ['Objetivos a 6 meses', 'objetivosSeisMeses'],
    ['Objetivos a 1 año', 'objetivosUnAno'],
    ['Experiencia en academias', 'experienciaAcademias'],
    ['Qué valora', 'queValorasAcademia'],
    ['Qué menos gusta', 'queMenosGustaAcademias'],
    ['Qué espera', 'queEsperasAcademia'],
    ['Trabaja actualmente', 'trabajasActualmente'],
    ['Agotamiento físico / mental', 'agotamientoFisicoMental'],
    ['Tiempo dedicable', 'tiempoDedicableEstudio'],
    ['Días disponibles', 'diasSemanaDisponibles'],
    ['Otra información laboral', 'otraInformacionLaboral'],
    ['Comentarios', 'comentariosAdicionales'],
  ] as const;
  readonly labelDisplay = labelDisplay;
  readonly destructiveActions: MenuItem[] = [
    {
      label: 'Eliminar usuario',
      icon: 'pi pi-trash',
      command: () => this.confirmarEliminar(),
    },
  ];
  private requestVersion = 0;
  private detailRefreshVersion = 0;

  constructor() {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.resetRouteScopedUi();
        this.load();
      });
  }

  get id(): number {
    return Number(this.route.snapshot.paramMap.get('id'));
  }

  async load(): Promise<void> {
    const requestedId = this.id;
    const requestVersion = ++this.requestVersion;
    this.loading = true;
    this.error = false;
    this.notFound = false;
    this.user = undefined;
    this.editableUser = undefined;
    this.editFechaClasesGrabadas = null;
    this.asignaciones = [];
    this.marcas = [];
    try {
      const user = await firstValueFrom(
        this.users.getAdminUserDetail$(requestedId),
      );
      if (!this.isCurrent(requestVersion, requestedId)) return;
      this.user = user;
      await this.loadSections(requestedId, requestVersion);
    } catch (error: any) {
      if (this.isCurrent(requestVersion, requestedId)) {
        this.notFound = error?.status === 404;
        this.error = !this.notFound;
      }
    } finally {
      if (this.isCurrent(requestVersion, requestedId)) this.loading = false;
    }
  }

  private isCurrent(version: number, id: number): boolean {
    return version === this.requestVersion && id === this.id;
  }

  private resetRouteScopedUi(): void {
    this.detailRefreshVersion++;
    this.confirmation.close();
    this.editVisible = false;
    this.editableUser = undefined;
    this.editFechaClasesGrabadas = null;
    this.subscriptionVisible = false;
    this.labelsVisible = false;
    this.selectedSubscriptionType = SuscripcionTipo.BASIC;
    this.selectedOposicion = Oposicion.VALENCIA_AYUNTAMIENTO;
    this.selectedLabelId = '';
    this.availableLabels = [];
    this.creatingNewLabel = false;
    this.newLabelKey = '';
    this.newLabelValue = '';
    this.unlinkingPlanificacionId = undefined;
    this.deleting = false;
    this.savingEdit = false;
    this.impersonating = false;
    this.mutatingSubscription = false;
    this.mutatingLabels = false;
  }

  private isDisplayedUser(userId: number): boolean {
    return this.user?.id === userId && this.id === userId;
  }

  private async refreshIfVisible(
    userId: number,
    includeSections = false,
  ): Promise<void> {
    if (!this.isDisplayedUser(userId)) return;
    try {
      if (includeSections) {
        await Promise.all([
          this.loadSections(userId, this.requestVersion),
          this.loadDetailOnly(userId),
        ]);
      } else {
        await this.loadDetailOnly(userId);
      }
    } catch {
      if (this.isDisplayedUser(userId)) {
        this.toast.warning(
          'Los cambios se guardaron, pero no se pudo actualizar la ficha.',
        );
      }
    }
  }

  userActivity() {
    return this.user ? getUserActivity(this.user) : undefined;
  }

  async loadSections(
    id = this.id,
    version = this.requestVersion,
  ): Promise<void> {
    const assignments = this.loadAsignaciones(id, version);
    if (!this.planificacionFisicaHabilitada()) {
      if (this.isCurrent(version, id)) {
        this.marcas = [];
        this.loadingMarcas = false;
        this.marcasError = false;
      }
      await assignments;
      return;
    }
    await Promise.all([assignments, this.loadMarcas(id, version)]);
  }

  private async loadAsignaciones(id: number, version: number): Promise<void> {
    this.loadingAsignaciones = true;
    this.asignacionesError = false;
    try {
      const value = await firstValueFrom(this.users.getUserPlanifications$(id));
      if (this.isCurrent(version, id)) this.asignaciones = value;
    } catch {
      if (this.isCurrent(version, id)) this.asignacionesError = true;
    } finally {
      if (this.isCurrent(version, id)) this.loadingAsignaciones = false;
    }
  }

  private async loadMarcas(id: number, version: number): Promise<void> {
    this.loadingMarcas = true;
    this.marcasError = false;
    try {
      const value = await firstValueFrom(this.fisica.marcasDeAlumno(id));
      if (this.isCurrent(version, id)) this.marcas = value;
    } catch {
      if (this.isCurrent(version, id)) this.marcasError = true;
    } finally {
      if (this.isCurrent(version, id)) this.loadingMarcas = false;
    }
  }

  reintentarPlanificaciones(): void {
    void this.loadAsignaciones(this.id, this.requestVersion);
  }

  reintentarMarcas(): void {
    void this.loadMarcas(this.id, this.requestVersion);
  }

  volver(): void {
    this.router.navigate(['/app/test/user'], {
      queryParams: this.route.snapshot.queryParams,
    });
  }

  confirmarDesvincular(planificacionId: number): void {
    const userId = this.user?.id;
    if (!userId) return;
    this.confirmation.confirm({
      header: 'Desvincular planificación',
      message:
        'Se eliminarán también el progreso y los eventos personalizados asociados. ¿Quieres continuar?',
      acceptLabel: 'Desvincular',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.desvincular(planificacionId, userId),
    });
  }

  async desvincular(
    planificacionId: number,
    userId = this.user?.id,
  ): Promise<void> {
    if (!userId) return;
    if (this.unlinkingPlanificacionId) return;
    this.unlinkingPlanificacionId = planificacionId;
    try {
      await firstValueFrom(
        this.planificaciones.desvincularPlanificacionMensualAdmin$(
          planificacionId,
          userId,
        ),
      );
      if (this.isDisplayedUser(userId)) {
        this.toast.success('Planificación desvinculada correctamente');
      }
      await this.refreshIfVisible(userId, true);
    } catch {
      if (this.isDisplayedUser(userId)) {
        this.toast.error('No se pudo desvincular la planificación');
      }
    } finally {
      if (this.isDisplayedUser(userId)) {
        this.unlinkingPlanificacionId = undefined;
      }
    }
  }

  private async loadDetailOnly(id = this.user?.id): Promise<void> {
    if (!id) return;
    const version = this.requestVersion;
    const refreshVersion = ++this.detailRefreshVersion;
    const user = await firstValueFrom(this.users.getAdminUserDetail$(id));
    if (
      this.isCurrent(version, id) &&
      refreshVersion === this.detailRefreshVersion
    ) {
      this.user = user;
    }
  }

  editar(): void {
    this.editableUser = this.user ? cloneDeep(this.user) : undefined;
    this.editFechaClasesGrabadas = this.user?.fechaAccesoClasesGrabadas
      ? new Date(this.user.fechaAccesoClasesGrabadas)
      : null;
    this.editVisible = true;
  }
  cancelarEdicion(): void {
    this.editableUser = undefined;
    this.editFechaClasesGrabadas = null;
    this.editVisible = false;
  }
  guardarEdicion(): void {
    if (!this.editableUser || this.savingEdit) return;
    const userId = this.editableUser.id;
    this.savingEdit = true;
    this.users
      .updateUser(userId, {
        nombre: this.editableUser.nombre,
        apellidos: this.editableUser.apellidos,
        esTutor: this.editableUser.esTutor,
        fechaAccesoClasesGrabadas: this.editFechaClasesGrabadas
          ? this.editFechaClasesGrabadas.toISOString()
          : null,
      })
      .subscribe({
        next: async () => {
          if (this.isDisplayedUser(userId)) {
            this.toast.success('Usuario actualizado correctamente');
            this.cancelarEdicion();
          }
          if (this.isDisplayedUser(userId)) this.savingEdit = false;
          await this.refreshIfVisible(userId);
        },
        error: () => {
          if (this.isDisplayedUser(userId)) {
            this.toast.error('No se pudo actualizar el usuario');
            this.savingEdit = false;
          }
        },
      });
  }

  abrirSuscripciones(): void {
    this.selectedSubscriptionType = SuscripcionTipo.BASIC;
    this.selectedOposicion = this.firstAvailableOposicion();
    this.subscriptionVisible = true;
  }
  private firstAvailableOposicion(): Oposicion {
    return (
      this.oposiciones.find(
        (option) =>
          !this.user?.suscripciones?.some(
            (sub) =>
              sub.oposicion === option.value && isSubscriptionCurrent(sub),
          ),
      )?.value || this.oposiciones[0].value
    );
  }
  get subscriptionLabel(): string {
    return this.selectedSubscriptionType;
  }
  anadirSuscripcion(): void {
    if (this.mutatingSubscription) return;
    if (
      this.user?.suscripciones?.some(
        (sub) =>
          sub.oposicion === this.selectedOposicion &&
          isSubscriptionCurrent(sub),
      )
    ) {
      this.toast.warning(
        'Ya existe una suscripción activa para esta oposición',
      );
      return;
    }
    const userId = this.user?.id;
    if (!userId) return;
    this.mutatingSubscription = true;
    this.users
      .createUserSubscription(
        userId,
        this.selectedSubscriptionType,
        this.selectedOposicion,
      )
      .subscribe({
        next: async () => {
          if (this.isDisplayedUser(userId)) {
            this.toast.success('Suscripción añadida correctamente');
            this.mutatingSubscription = false;
          }
          await this.refreshIfVisible(userId);
        },
        error: (err) => {
          if (this.isDisplayedUser(userId)) {
            this.toast.error(
              err?.error?.message || 'No se pudo añadir la suscripción',
            );
            this.mutatingSubscription = false;
          }
        },
      });
  }
  cancelarSuscripcion(subscription: SuscripcionAdministrativa): void {
    if (this.mutatingSubscription) return;
    const userId = this.user?.id;
    if (!userId) return;
    this.confirmation.confirm({
      header: 'Cancelar suscripción',
      message: `¿Cancelar la suscripción "${subscription.tipo}"? El usuario perderá el acceso pero el histórico se conserva.`,
      accept: () => {
        this.mutatingSubscription = true;
        this.users.cancelUserSubscription(subscription.id).subscribe({
          next: async () => {
            if (this.isDisplayedUser(userId)) {
              this.toast.success('Suscripción cancelada');
              this.mutatingSubscription = false;
            }
            await this.refreshIfVisible(userId);
          },
          error: (err) => {
            if (this.isDisplayedUser(userId)) {
              this.toast.error(
                err?.error?.message || 'No se pudo cancelar la suscripción',
              );
              this.mutatingSubscription = false;
            }
          },
        });
      },
    });
  }

  puedeCancelarSuscripcion(subscription: SuscripcionAdministrativa): boolean {
    return !this.mutatingSubscription && isSubscriptionCurrent(subscription);
  }
  eliminarSuscripcion(subscription: SuscripcionAdministrativa): void {
    if (this.mutatingSubscription) return;
    if (subscription.woocommerceSubscriptionId) {
      this.toast.info(
        'Las suscripciones de WordPress se gestionan desde la tienda.',
      );
      return;
    }
    const userId = this.user?.id;
    if (!userId) return;
    this.confirmation.confirm({
      header: 'Confirmar eliminación',
      message: `¿Estás seguro de que deseas eliminar la suscripción "${subscription.tipo}"?`,
      accept: () => {
        this.mutatingSubscription = true;
        this.users.deleteUserSubscription(userId, subscription.id).subscribe({
          next: async () => {
            if (this.isDisplayedUser(userId)) {
              this.toast.success('Suscripción eliminada');
              this.mutatingSubscription = false;
            }
            await this.refreshIfVisible(userId);
          },
          error: (err) => {
            if (this.isDisplayedUser(userId)) {
              this.toast.error(
                err?.error?.message || 'No se pudo eliminar la suscripción',
              );
              this.mutatingSubscription = false;
            }
          },
        });
      },
    });
  }
  async abrirEtiquetas(): Promise<void> {
    const userId = this.user?.id;
    if (!userId) return;
    this.selectedLabelId = '';
    this.availableLabels = [];
    this.creatingNewLabel = false;
    this.newLabelKey = '';
    this.newLabelValue = '';
    try {
      const labels = await firstValueFrom(this.labels.getLabels());
      if (!this.isDisplayedUser(userId)) return;
      this.availableLabels = labels.map((label) => ({
        ...label,
        display: labelDisplay(label),
      }));
      this.labelsVisible = true;
    } catch {
      if (this.isDisplayedUser(userId)) {
        this.toast.error('No se pudieron cargar las etiquetas');
      }
    }
  }
  asignarEtiqueta(): void {
    if (!this.selectedLabelId || this.mutatingLabels) return;
    const userId = this.user?.id;
    if (!userId) return;
    this.mutatingLabels = true;
    this.labels.assignLabelToUser(userId, this.selectedLabelId).subscribe({
      next: async () => {
        if (this.isDisplayedUser(userId)) {
          this.toast.success('Etiqueta asignada correctamente');
          this.selectedLabelId = '';
          this.mutatingLabels = false;
        }
        await this.refreshIfVisible(userId);
      },
      error: () => {
        if (this.isDisplayedUser(userId)) {
          this.toast.error('No se pudo asignar la etiqueta');
          this.mutatingLabels = false;
        }
      },
    });
  }
  quitarEtiqueta(labelId: string): void {
    if (this.mutatingLabels) return;
    const userId = this.user?.id;
    if (!userId) return;
    this.mutatingLabels = true;
    this.labels.removeLabelFromUser(userId, labelId).subscribe({
      next: async () => {
        if (this.isDisplayedUser(userId)) {
          this.toast.success('Etiqueta eliminada correctamente');
          this.mutatingLabels = false;
        }
        await this.refreshIfVisible(userId);
      },
      error: () => {
        if (this.isDisplayedUser(userId)) {
          this.toast.error('No se pudo eliminar la etiqueta');
          this.mutatingLabels = false;
        }
      },
    });
  }
  crearYAsignarEtiqueta(): void {
    if (!this.newLabelKey.trim() || this.mutatingLabels) {
      if (!this.newLabelKey.trim())
        this.toast.warning('La clave de la etiqueta es obligatoria');
      return;
    }
    const userId = this.user?.id;
    if (!userId) return;
    this.mutatingLabels = true;
    this.labels
      .assignLabelByKeyValue(
        userId,
        this.newLabelKey.trim(),
        this.newLabelValue.trim() || undefined,
      )
      .subscribe({
        next: async () => {
          if (this.isDisplayedUser(userId)) {
            this.toast.success('Etiqueta creada y asignada correctamente');
            this.newLabelKey = '';
            this.newLabelValue = '';
            this.creatingNewLabel = false;
            this.mutatingLabels = false;
          }
          await this.refreshIfVisible(userId);
        },
        error: () => {
          if (this.isDisplayedUser(userId)) {
            this.toast.error('No se pudo crear y asignar la etiqueta');
            this.mutatingLabels = false;
          }
        },
      });
  }

  impersonar(): void {
    if (this.impersonating) return;
    const userId = this.user?.id;
    if (!userId) return;
    this.impersonating = true;
    this.auth.impersonateUser$(userId).subscribe({
      next: () => {
        if (this.isDisplayedUser(userId)) {
          this.impersonating = false;
          this.router.navigate(['/app/profile']);
        }
      },
      error: () => {
        if (this.isDisplayedUser(userId)) {
          this.toast.error('No se pudo acceder como el usuario');
          this.impersonating = false;
        }
      },
    });
  }

  confirmarEliminar(): void {
    const userId = this.user?.id;
    if (!userId) return;
    this.confirmation.confirm({
      header: 'Eliminar usuario',
      message: 'Vas a eliminar el usuario de la plataforma, ¿estás seguro?',
      acceptLabel: 'Sí, eliminar',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => this.eliminar(userId),
    });
  }

  eliminar(userId = this.user?.id): void {
    if (!userId) return;
    if (this.deleting) return;
    this.deleting = true;
    this.users.eliminarUsuario(userId).subscribe({
      next: () => {
        if (this.isDisplayedUser(userId)) {
          this.toast.success('Usuario eliminado exitosamente');
          this.deleting = false;
          this.volver();
        }
      },
      error: () => {
        if (this.isDisplayedUser(userId)) {
          this.toast.error('No se pudo eliminar el usuario');
          this.deleting = false;
        }
      },
    });
  }

  onboardingCompletion(): number {
    if (!this.user) return 0;
    const filled = this.onboardingGroups.filter(([, key]) => {
      const value = (this.user as any)[key];
      return (
        value !== null &&
        value !== undefined &&
        value !== '' &&
        !(Array.isArray(value) && value.length === 0)
      );
    }).length;
    return Math.round((filled / this.onboardingGroups.length) * 100);
  }
  valueFor(key: string): string {
    const value = (this.user as any)?.[key];
    if (Array.isArray(value))
      return (
        value
          .map((item) => OPOSICION_LABELS[item as Oposicion] || item)
          .join(', ') || 'No proporcionado'
      );
    if (key === 'fechaNacimiento' && value)
      return new Date(value).toLocaleDateString('es-ES');
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    return value === null || value === undefined || value === ''
      ? 'No proporcionado'
      : String(value);
  }
  verPlanificacion(planificacionId: number): void {
    this.router.navigate([
      '/app/planificacion/planificacion-mensual',
      planificacionId,
    ]);
  }
}
