import { animate, style, transition, trigger } from '@angular/animations';
import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ConfirmationService } from 'primeng/api';
import { firstValueFrom, Subscription, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  ComprarSimulacroCofResponse,
  Examen,
} from '../../../examen/models/examen.model';
import { ExamenesService } from '../../../examen/servicios/examen.service';
import { AuthService } from '../../../services/auth.service';
import { Usuario } from '../../../shared/models/user.model';

@Component({
  selector: 'app-realizar-simulacro',
  templateUrl: './realizar-simulacro.component.html',
  styleUrl: './realizar-simulacro.component.scss',
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms', style({ opacity: 1 })),
      ]),
      transition(':leave', [animate('300ms', style({ opacity: 0 }))]),
    ]),
  ],
})
export class RealizarSimulacroComponent implements OnInit, OnDestroy {
  activedRoute = inject(ActivatedRoute);
  examenService = inject(ExamenesService);
  router = inject(Router);
  confirmationService = inject(ConfirmationService);
  toastr = inject(ToastrService);
  authService = inject(AuthService);
  fb = inject(FormBuilder);

  lastLoadedExamen = signal<Examen | null>(null);
  public statusLoad: 'non_loaded' | 'not_found' | 'loaded' = 'non_loaded';
  public iniciando: boolean = false;
  public countdown: number = 3;
  public registroDialogVisible: boolean = false;
  public loginDialogVisible: boolean = false;
  public mostrarRegistro: boolean = true; // Para alternar entre login y registro
  public codigoAccesoDialogVisible: boolean = false;
  public codigoAccesoForm: FormGroup;
  public codigoError: boolean = false;
  public simulacroUrl: string = '';

  // ── Compra in-app del simulacro (1-clic COF) ──────────────────────────────
  /** Diálogo "compra este simulacro" (se abre al iniciar sin acceso y comprable). */
  public compraDialogVisible: boolean = false;
  /** true mientras el backend cobra el COF (~2,5-5s). Botón spinner/disabled. */
  public comprandoSimulacro = signal(false);
  /** Diálogo de fallback "complétalo en la tienda" (sin COF usable o rechazo). */
  public checkoutDialogVisible: boolean = false;
  public checkoutMensaje: string = '';
  public checkoutEsRechazo: boolean = false;
  public checkoutWooProductId: string | null = null;
  /**
   * Clave de idempotencia del INTENTO de compra en curso. Se genera UNA vez al
   * abrir la oferta y se REUTILIZA en cada reintento del mismo intento, de modo
   * que un retry de un cobro ambiguo (ERROR_TEMPORAL) deduplique en el servidor
   * y NO doble-cobre. Se limpia en estados terminales (éxito/rechazo/checkout)
   * para que una compra NUEVA (un simulacro es comprable varias veces) use una
   * clave nueva.
   */
  private compraIdempotencyKey: string = '';

  // Usuario actual
  public currentUser = signal<Usuario | null>(null);
  private userSubscription: Subscription | null = null;

  constructor() {
    this.loadRouteData();
    this.codigoAccesoForm = this.fb.group({
      codigo: [
        '',
        [Validators.required, Validators.minLength(6), Validators.maxLength(6)],
      ],
    });
  }

  ngOnInit(): void {
    // Suscribirse a los cambios del usuario actual
    this.userSubscription = this.authService.currentUser$.subscribe((user) => {
      this.currentUser.set(user);
    });
  }

  ngOnDestroy(): void {
    // Limpiar suscripciones
    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
    }
  }

  private async loadRouteData() {
    try {
      const { idExamen } = await firstValueFrom(this.activedRoute.params);

      // Simular un tiempo de carga para mostrar la animación
      await new Promise((resolve) => setTimeout(resolve, 1500));

      await firstValueFrom(
        this.examenService.getSimulacroById$(idExamen).pipe(
          tap((examen) => {
            if (examen) {
              this.lastLoadedExamen.set(examen);
              this.statusLoad = 'loaded';

              // Generar URL para compartir
              const baseUrl = window.location.origin;
              this.simulacroUrl = `${baseUrl}/simulacros/realizar-simulacro/${idExamen}`;
            } else {
              this.statusLoad = 'not_found';
            }
          }),
        ),
      );
    } catch (error) {
      console.error('Error al cargar el simulacro:', error);
      this.statusLoad = 'not_found';
    }
  }

  public async iniciarSimulacro() {
    if (!this.lastLoadedExamen()) return;

    // Si el usuario ya está autenticado, verificar acceso
    if (this.currentUser()) {
      await this.verificarYProcederConSimulacro();
    } else {
      // Mostrar diálogo de registro/login
      this.mostrarRegistro = true; // Por defecto mostrar registro
      this.mostrarDialogoRegistro();
    }
  }

  /**
   * Verifica el acceso del usuario y procede según las condiciones del simulacro
   */
  private async verificarYProcederConSimulacro() {
    try {
      const examenId = this.lastLoadedExamen()?.id;
      if (!examenId) return;

      // Verificar acceso por consumible
      const accesoInfo = await firstValueFrom(
        this.examenService.verificarAccesoSimulacro$(examenId),
      );

      if (!accesoInfo.tieneAcceso) {
        // Sin acceso: si el simulacro está vinculado a un producto WC, ofrecer la
        // compra in-app (1-clic COF). Si no, no es comprable → mensaje informativo.
        if (this.lastLoadedExamen()?.woocommerceProductId) {
          // Nueva oferta = nuevo intento de compra → clave de idempotencia fresca.
          this.compraIdempotencyKey = this.generarIdempotencyKey();
          this.compraDialogVisible = true;
        } else {
          this.toastr.error(
            'No tienes acceso a este simulacro y no está disponible para compra.',
            'Sin acceso',
          );
        }
        return;
      }

      // Si tiene acceso y necesita código, mostrarlo
      if (accesoInfo.necesitaCodigo) {
        this.mostrarDialogoCodigoAcceso();
      } else {
        // Si no necesita código, iniciar directamente
        this.confirmarInicioSimulacro();
      }
    } catch (error) {
      console.error('Error al verificar acceso:', error);
      this.toastr.error('Error al verificar acceso al simulacro', 'Error');
    }
  }

  // ── Compra in-app del simulacro (1-clic COF) ──────────────────────────────

  /**
   * Compra el simulacro en 1 clic contra el COF del alumno (tarjeta guardada).
   * El `idempotencyKey` se genera POR CLICK: un retry de la MISMA compra (misma
   * key) deduplica en la ruta de cobro; un click nuevo = compra nueva (un
   * simulacro es comprable varias veces). Money-critical: el backend no concede
   * el consumible salvo cobro confirmado.
   */
  public comprarSimulacro(): void {
    if (this.comprandoSimulacro()) return;
    const examenId = this.lastLoadedExamen()?.id;
    if (!examenId) return;

    // Reutiliza la clave del intento en curso (la fija la oferta al abrirse). El
    // `||` es una red por si se llama sin pasar por la oferta: un retry del MISMO
    // intento debe llevar la MISMA clave para deduplicar y no doble-cobrar.
    if (!this.compraIdempotencyKey) {
      this.compraIdempotencyKey = this.generarIdempotencyKey();
    }
    const idempotencyKey = this.compraIdempotencyKey;

    this.comprandoSimulacro.set(true);
    this.examenService
      .comprarSimulacroCof$(examenId, idempotencyKey)
      .subscribe({
        next: (res) => {
          this.comprandoSimulacro.set(false);
          this.manejarRespuestaCompra(res);
        },
        error: () => {
          // Fallo HTTP no clasificado (red/500). Reintentable: re-habilita el botón.
          this.comprandoSimulacro.set(false);
          this.toastr.error(
            'No se pudo procesar la compra, inténtalo de nuevo.',
            'Error',
          );
        },
      });
  }

  private manejarRespuestaCompra(res: ComprarSimulacroCofResponse): void {
    if (res.success) {
      // Intento terminado con éxito → la próxima compra usará una clave nueva.
      this.compraIdempotencyKey = '';
      this.compraDialogVisible = false;
      this.toastr.success(
        res.mensaje || 'Compra realizada. Ya tienes acceso.',
        'Compra realizada',
      );
      // Re-verificar acceso: el consumible ya existe → continúa el flujo normal
      // (código de acceso si lo requiere, o confirmación de inicio).
      this.verificarYProcederConSimulacro();
      return;
    }
    if ('requiereCheckout' in res) {
      // Sin COF usable (o precio cambiado) → empujar a la tienda, sin cobro.
      // Sale del flujo COF → cierra el intento (clave nueva la próxima vez).
      this.compraIdempotencyKey = '';
      this.abrirCheckout(res.wooProductId, res.mensaje, false);
      return;
    }
    switch (res.error) {
      case 'PAGO_RECHAZADO':
        // Decline: NO re-ofrecer 1-clic; a la tienda con otra tarjeta. Intento
        // terminado (la tarjeta no sirve) → clave nueva la próxima vez.
        this.compraIdempotencyKey = '';
        this.abrirCheckout(
          res.wooProductId ??
            this.lastLoadedExamen()?.woocommerceProductId ??
            null,
          res.mensaje ||
            'Tu tarjeta fue rechazada. Cómpralo en la tienda con otra tarjeta.',
          true,
        );
        return;
      case 'ERROR_TEMPORAL':
        // Técnico/ambiguo: reintentable. NO se limpia la clave: un retry debe
        // llevar la MISMA clave para deduplicar el cobro ambiguo y no doblar.
        this.toastr.warning(
          res.mensaje ||
            'Estamos verificando tu pago. Si se completó, tendrás acceso en unos minutos.',
          'Pago en verificación',
        );
        return;
    }
  }

  /** Genera una clave de idempotencia única (UUID si está disponible). */
  private generarIdempotencyKey(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `sim_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  private abrirCheckout(
    wooProductId: string | null,
    mensaje: string,
    esRechazo: boolean,
  ): void {
    this.compraDialogVisible = false;
    this.checkoutWooProductId = wooProductId;
    this.checkoutMensaje = mensaje;
    this.checkoutEsRechazo = esRechazo;
    this.checkoutDialogVisible = true;
  }

  /** Abre el checkout de WC pre-cargado con el producto del simulacro. */
  public completarEnTienda(): void {
    if (!this.checkoutWooProductId) return;
    window.open(
      `${environment.wooCommerceUrl}?add-to-cart=${this.checkoutWooProductId}`,
      '_blank',
    );
    this.checkoutDialogVisible = false;
  }

  public mostrarDialogoRegistro(): void {
    this.registroDialogVisible = true;
  }

  public async onRegistroCompleto(userData: {
    email: string;
    password: string;
  }): Promise<void> {
    this.registroDialogVisible = false;

    try {
      // Realizar login automático con los datos del registro
      await firstValueFrom(
        this.authService.login$(userData.email, userData.password),
      );

      this.toastr.success('Has iniciado sesión correctamente', 'Bienvenido');

      // Continuar con la verificación de acceso
      setTimeout(() => {
        this.verificarYProcederConSimulacro();
      }, 500);
    } catch (error) {
      console.error('Error al iniciar sesión automáticamente:', error);
      this.toastr.error('No se pudo iniciar sesión automáticamente', 'Error');
    }
  }

  public onLoginCompleto(): void {
    this.registroDialogVisible = false;

    this.toastr.success('Has iniciado sesión correctamente', 'Bienvenido');

    // Continuar con la verificación de acceso
    setTimeout(() => {
      this.verificarYProcederConSimulacro();
    }, 500);
  }

  public toggleRegistroLogin(): void {
    this.mostrarRegistro = !this.mostrarRegistro;
  }

  public mostrarDialogoCodigoAcceso(): void {
    this.codigoAccesoForm.reset();
    this.codigoError = false;
    this.codigoAccesoDialogVisible = true;
  }

  public cerrarDialogoCodigoAcceso(): void {
    this.codigoAccesoDialogVisible = false;
  }

  public async verificarCodigoAcceso(): Promise<void> {
    if (this.codigoAccesoForm.invalid) {
      this.codigoAccesoForm.markAllAsTouched();
      return;
    }

    const codigo = this.codigoAccesoForm.get('codigo')?.value;

    try {
      // Verificar el código de acceso
      const examenId = this.lastLoadedExamen()?.id;
      const verificado = await firstValueFrom(
        this.examenService.verificarCodigoAcceso$(examenId as number, codigo),
      );

      if (verificado) {
        this.codigoAccesoDialogVisible = false;
        this.confirmarInicioSimulacro(codigo);
      } else {
        this.codigoError = true;
      }
    } catch (error) {
      console.error('Error al verificar el código de acceso:', error);
      this.codigoError = true;
    }
  }

  public cerrarSesion(): void {
    this.confirmationService.confirm({
      message: '¿Estás seguro de que deseas cerrar sesión?',
      header: 'Cerrar Sesión',
      icon: 'pi pi-sign-out',
      acceptLabel: 'Sí, cerrar sesión',
      rejectLabel: 'Cancelar',
      accept: async () => {
        try {
          await firstValueFrom(this.authService.logout$());
          this.toastr.info('Has cerrado sesión correctamente');
        } catch (error) {
          console.error('Error al cerrar sesión:', error);
          this.toastr.error('Error al cerrar sesión');
        }
      },
    });
  }

  private confirmarInicioSimulacro(codigo?: string): void {
    this.confirmationService.confirm({
      message:
        '¿Estás listo para comenzar el simulacro? Una vez iniciado, el tiempo comenzará a contar.',
      header: 'Comenzar Simulacro',
      icon: 'pi pi-play',
      rejectButtonStyleClass: 'p-button-outlined',
      acceptLabel: 'Comenzar',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.startCountdown(codigo);
      },
    });
  }

  private startCountdown(codigo?: string) {
    this.iniciando = true;
    this.countdown = 3;

    const interval = setInterval(() => {
      this.countdown--;

      if (this.countdown <= 0) {
        clearInterval(interval);
        this.comenzarExamen(codigo);
      }
    }, 1000);
  }

  private async comenzarExamen(codigo?: string) {
    try {
      if (!this.lastLoadedExamen() || !this.currentUser()) {
        throw new Error('No hay examen cargado o usuario autenticado');
      }

      const examenId = this.lastLoadedExamen()?.id;
      const response = await firstValueFrom(
        this.examenService.startSimulacro$(examenId as number, codigo),
      );

      if (response && response.id) {
        const url =
          '/simulacros/realizar-simulacro/' +
          examenId +
          '/completar/' +
          response.id;
        // Navegar al componente de completar test con el ID del test creado
        this.router.navigate([url]);
      } else {
        throw new Error('No se pudo iniciar el examen');
      }
    } catch (error) {
      console.error('Error al iniciar el examen:', error);
      this.toastr.error(
        'Ha ocurrido un error al iniciar el simulacro',
        'Error',
      );
      this.iniciando = false;
    }
  }

  public getNombreUsuario(): string {
    const user = this.currentUser();
    if (!user) return '';

    if (user.nombre && user.apellidos) {
      return `${user.nombre} ${user.apellidos}`;
    } else if (user.nombre) {
      return user.nombre;
    } else {
      return user.email;
    }
  }
}
