import { animate, style, transition, trigger } from '@angular/animations';
import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ConfirmationService } from 'primeng/api';
import { firstValueFrom, Subscription, tap } from 'rxjs';
import { Examen } from '../../../examen/models/examen.model';
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
        animate('300ms', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('300ms', style({ opacity: 0 }))
      ])
    ])
  ]
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
  public codigoAccesoDialogVisible: boolean = false;
  public codigoAccesoForm: FormGroup;
  public codigoError: boolean = false;
  public simulacroUrl: string = '';

  // Usuario actual
  public currentUser = signal<Usuario | null>(null);
  private userSubscription: Subscription | null = null;

  constructor() {
    this.loadRouteData();
    this.codigoAccesoForm = this.fb.group({
      codigo: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]]
    });
  }

  ngOnInit(): void {
    // Suscribirse a los cambios del usuario actual
    this.userSubscription = this.authService.currentUser$.subscribe(user => {
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
      await new Promise(resolve => setTimeout(resolve, 1500));

      await firstValueFrom(this.examenService.getSimulacroById$(idExamen).pipe(tap((examen) => {
        if (examen) {
          this.lastLoadedExamen.set(examen);
          this.statusLoad = 'loaded';

          // Generar URL para compartir
          const baseUrl = window.location.origin;
          this.simulacroUrl = `${baseUrl}/simulacros/realizar-simulacro/${idExamen}`;
        } else {
          this.statusLoad = 'not_found';
        }
      })));
    } catch (error) {
      console.error('Error al cargar el simulacro:', error);
      this.statusLoad = 'not_found';
    }
  }

  public iniciarSimulacro() {
    if (!this.lastLoadedExamen()) return;

    // Si el usuario ya está autenticado, solicitar código de acceso
    if (this.currentUser()) {
      this.mostrarDialogoCodigoAcceso();
    } else {
      // Mostrar diálogo de registro
      this.mostrarDialogoRegistro();
    }
  }

  public mostrarDialogoRegistro(): void {
    this.registroDialogVisible = true;
  }

  public async onRegistroCompleto(userData: { email: string, password: string }): Promise<void> {
    this.registroDialogVisible = false;

    try {
      // Realizar login automático con los datos del registro
      await firstValueFrom(this.authService.login$(userData.email, userData.password));

      this.toastr.success('Has iniciado sesión correctamente', 'Bienvenido');

      // Continuar solicitando el código de acceso
      setTimeout(() => {
        this.mostrarDialogoCodigoAcceso();
      }, 500);
    } catch (error) {
      console.error('Error al iniciar sesión automáticamente:', error);
      this.toastr.error('No se pudo iniciar sesión automáticamente', 'Error');
    }
  }

  public cerrarDialogoRegistro(): void {
    this.registroDialogVisible = false;
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
        this.examenService.verificarCodigoAcceso$(examenId as number, codigo)
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
      }
    });
  }

  private confirmarInicioSimulacro(codigo: string): void {
    this.confirmationService.confirm({
      message: '¿Estás listo para comenzar el simulacro? Una vez iniciado, el tiempo comenzará a contar.',
      header: 'Comenzar Simulacro',
      icon: 'pi pi-play',
      rejectButtonStyleClass: 'p-button-outlined',
      acceptLabel: 'Comenzar',
      rejectLabel: 'Cancelar',
      accept: () => {
        this.startCountdown(codigo);
      }
    });
  }

  private startCountdown(codigo: string) {
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

  private async comenzarExamen(codigo: string) {
    try {
      if (!this.lastLoadedExamen() || !this.currentUser()) {
        throw new Error('No hay examen cargado o usuario autenticado');
      }

      const examenId = this.lastLoadedExamen()?.id;
      const response = await firstValueFrom(
        this.examenService.startSimulacro$(examenId as number, codigo)
      );

      if (response && response.id) {
        const url = '/simulacros/realizar-simulacro/' + examenId + '/completar/' + response.id
        // Navegar al componente de completar test con el ID del test creado
        this.router.navigate([url]);
      } else {
        throw new Error('No se pudo iniciar el examen');
      }
    } catch (error) {
      console.error('Error al iniciar el examen:', error);
      this.toastr.error('Ha ocurrido un error al iniciar el simulacro', 'Error');
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
