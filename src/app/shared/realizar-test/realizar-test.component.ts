import { Component, inject, Input } from '@angular/core';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ConfirmationService } from 'primeng/api';
import { firstValueFrom } from 'rxjs';
import { CrearDueloDto, DueloService } from '../../services/duelo.service';
import { PreguntasService } from '../../services/preguntas.service';
import { TemaService } from '../../services/tema.service';
import { GenerarTestDto, TestService } from '../../services/test.service';
import { getAllDifficultades, getNumeroDePreguntas } from '../../utils/utils';
import { Dificultad } from '../models/pregunta.model';

@Component({
  selector: 'app-realizar-test',
  templateUrl: './realizar-test.component.html',
  styleUrl: './realizar-test.component.scss',
})
export class RealizarTestComponent {
  fb = inject(FormBuilder);
  toast = inject(ToastrService);
  preguntaService = inject(PreguntasService);
  temaService = inject(TemaService);
  confirmationService = inject(ConfirmationService);
  testService = inject(TestService);
  dueloService = inject(DueloService);
  router = inject(Router);
  activatedRoute = inject(ActivatedRoute);
  @Input() mode: 'injected' | 'default' = 'default';

  formGroup = this.fb.group({
    numPreguntas: [60, Validators.required],
    dificultad: [[Dificultad.INTERMEDIO]],
    temas: [[], Validators.required],
    generarTestDeRepaso: [false],
    generarTestDeExamen: [false],
    generarTestDesafio: [false],
    tiempoLimiteEnMinutos: [null as number | null],
    // Cuánto tiempo la sala del desafío acepta que se unan/compitan (deadline
    // que cierra el ranking). En horas para casar con el nombre del campo.
    duracionSalaHoras: [168 as number | null],
  });

  public preguntas = getNumeroDePreguntas();
  public getAllDifficultades = getAllDifficultades(false, true);
  public getAllTestsComenzados$ = this.testService.getAllTest();
  public getFallosCount$ = this.testService.obtenerFallosCount();
  public displayPopupFallosTest = false;
  public generandoTest = false;

  // Control suelto (fuera del formGroup): código para unirse a un desafío.
  public codigoDesafioControl = new FormControl<string>('');
  public mensajeUnirse: {
    severity: 'success' | 'error';
    texto: string;
  } | null = null;
  public uniendose = false;

  // Popup explicativo + configuración al activar el modo desafío.
  public displayPopupDesafio = false;
  // Distingue cierre por "Entendido" (confirma) de cierre por X/Cancelar.
  private desafioConfirmadoEnPopup = false;
  // Popup para unirse a un desafío con un código de compañero.
  public displayPopupUnirse = false;

  ngOnInit(): void {
    const generarTestDeRepasoControl = this.formGroup.get(
      'generarTestDeRepaso',
    ) as FormControl;
    const generarExamenControl = this.formGroup.get(
      'generarTestDeExamen',
    ) as FormControl;
    const desafioControl = this.formGroup.get(
      'generarTestDesafio',
    ) as FormControl;

    // El tiempo límite es obligatorio tanto en examen como en desafío.
    const sincronizarValidadoresTiempo = () => {
      const requiereTiempo =
        !!this.formGroup.value.generarTestDeExamen ||
        !!this.formGroup.value.generarTestDesafio;
      const control = this.formGroup.get('tiempoLimiteEnMinutos');
      if (requiereTiempo) {
        control?.setValidators(Validators.required);
      } else {
        control?.clearValidators();
      }
      control?.updateValueAndValidity({ emitEvent: false });
    };

    // Al activar DESAFÍO: apaga examen/repaso (que además se OCULTAN via *ngIf
    // en el template) y abre el popup explicativo. Exclusivo.
    desafioControl.valueChanges.subscribe((activo) => {
      if (activo) {
        generarExamenControl.setValue(false, { emitEvent: false });
        generarTestDeRepasoControl.setValue(false, { emitEvent: false });
        generarTestDeRepasoControl.clearValidators();
        generarTestDeRepasoControl.updateValueAndValidity({
          onlySelf: true,
          emitEvent: false,
        });
        this.abrirPopupDesafio();
      }
      sincronizarValidadoresTiempo();
    });

    generarExamenControl.valueChanges.subscribe((data) => {
      if (data) {
        // Examen y desafío son mutuamente exclusivos.
        desafioControl.setValue(false, { emitEvent: false });
      }
      sincronizarValidadoresTiempo();
    });

    generarTestDeRepasoControl.valueChanges.subscribe((data) => {
      if (data) {
        // Repaso apaga desafío (mismo efecto exclusivo).
        desafioControl.setValue(false, { emitEvent: false });
        generarTestDeRepasoControl.addValidators(Validators.required);
      } else {
        generarTestDeRepasoControl.clearValidators();
      }
      generarTestDeRepasoControl.updateValueAndValidity({
        onlySelf: true,
        emitEvent: false,
      });
    });

    // Deep-link: /app/test/alumno/realizar-test?codigo=XXXX abre el popup de
    // unirse con el código autorrellenado.
    if (this.mode === 'default') {
      const codigo = this.activatedRoute.snapshot.queryParamMap?.get('codigo');
      if (codigo) {
        this.codigoDesafioControl.setValue(codigo);
        this.abrirPopupUnirse();
      }
    }
  }

  // --- Modo desafío: popup explicativo -------------------------------------

  private abrirPopupDesafio(): void {
    this.desafioConfirmadoEnPopup = false;
    this.displayPopupDesafio = true;
  }

  public confirmarDesafio(): void {
    this.desafioConfirmadoEnPopup = true;
    this.displayPopupDesafio = false;
  }

  public cancelarDesafio(): void {
    this.displayPopupDesafio = false;
  }

  // Se dispara al ocultar el popup (botón, Cancelar o la X). Si no se confirmó
  // con "Entendido", trata el cierre como cancelación y apaga el modo desafío.
  public onHidePopupDesafio(): void {
    if (!this.desafioConfirmadoEnPopup) {
      // emitEvent por defecto: el handler de desafío re-habilita examen/repaso.
      this.formGroup.get('generarTestDesafio')?.setValue(false);
    }
    this.desafioConfirmadoEnPopup = false;
  }

  // --- Modo desafío: unirse ------------------------------------------------

  public abrirPopupUnirse(): void {
    this.mensajeUnirse = null;
    this.displayPopupUnirse = true;
  }

  public async unirmeAlDesafio() {
    const codigo = (this.codigoDesafioControl.value ?? '').trim();
    if (!codigo) {
      this.mensajeUnirse = {
        severity: 'error',
        texto: 'Introduce un código de desafío para poder unirte.',
      };
      return;
    }
    this.mensajeUnirse = null;
    this.uniendose = true;
    try {
      const res = await firstValueFrom(this.dueloService.unirse$(codigo));
      this.displayPopupUnirse = false;
      this.router.navigate(['/app/test/alumno/realizar-test/' + res.testId]);
    } catch (error: any) {
      // Mostramos el mensaje del backend inline (404 código inválido, 400
      // cerrado/lleno, 403 oposición), NO un toast genérico.
      this.mensajeUnirse = {
        severity: 'error',
        texto:
          error?.error?.message ||
          error?.message ||
          'No se pudo unir al desafío. Revisa el código e inténtalo de nuevo.',
      };
    } finally {
      this.uniendose = false;
    }
  }

  public copiarCodigo(codigo: string) {
    navigator.clipboard?.writeText(codigo);
    this.toast.info('Código copiado al portapapeles');
  }

  // --- Generación de test / desafío ----------------------------------------

  public confirmGenerarTest(event: Event, esTipoExamen = false) {
    const esDesafio = !!this.formGroup.value.generarTestDesafio;
    const mensaje = esDesafio
      ? `Estás a punto de crear un test desafío. Se generará un código que podrás compartir con tus compañeros. ¿Deseas continuar?`
      : esTipoExamen
        ? `Estás a punto de comenzar un examen. El tiempo empezará a descontarse automáticamente y serás dirigido a él. ¿Deseas continuar?`
        : `Estás a punto de comenzar un test. Serás redirigido a él. ¿Deseas continuar?`;

    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: mensaje,
      header: 'Confirmación',
      icon: 'pi pi-exclamation-triangle',
      acceptIcon: 'none',
      acceptLabel: 'Sí',
      rejectLabel: 'No',
      rejectIcon: 'none',
      rejectButtonStyleClass: 'p-button-text',
      accept: async () => {
        this.generarTest(true);
      },
      reject: () => {},
    });
  }

  public generateDto(sobreescribir = false) {
    const numPreguntas = this.formGroup.value.numPreguntas ?? 60;
    const payload = {
      numPreguntas,
      dificultades: this.formGroup.value.dificultad ?? [Dificultad.INTERMEDIO],
      temas: this.formGroup.value.temas ?? [],
      generarTestDeRepaso: this.formGroup.value.generarTestDeRepaso,
      duracion: this.formGroup.value.generarTestDeExamen
        ? (this.formGroup.value.tiempoLimiteEnMinutos ?? numPreguntas)
        : undefined,
      sobreescribir,
    } as GenerarTestDto;
    return payload;
  }

  public async generarTest(autoRedirect = false, sobreescribir = false) {
    // En modo desafío se crea una sala (no un test normal); no se auto-redirige
    // para que el alumno pueda copiar y compartir el código de invitación.
    if (this.formGroup.value.generarTestDesafio) {
      await this.crearDuelo();
      return;
    }
    try {
      this.generandoTest = true;
      const payload = this.generateDto(sobreescribir);
      const res = await firstValueFrom(this.testService.generarTest(payload));
      this.toast.success('Test generado exitosamente!', 'Generación exitosa');
      this.getAllTestsComenzados$ = this.testService.getAllTest();
      this.generandoTest = false;
      if (!!autoRedirect)
        this.router.navigate(['/app/test/alumno/realizar-test/' + res.id]);
    } catch (error: any) {
      this.generandoTest = false;
      const mensaje = error?.error?.message || '';
      if (mensaje.includes('test ya empezado o creado')) {
        this.confirmarSobreescribirTest(autoRedirect);
      } else {
        this.toast.error(mensaje || 'Error al generar el test.', 'Error');
      }
    }
  }

  private async crearDuelo() {
    try {
      this.generandoTest = true;
      const numeroPreguntas = this.formGroup.value.numPreguntas ?? 60;
      const dto: CrearDueloDto = {
        temas: (this.formGroup.value.temas ?? []) as number[],
        numeroPreguntas,
        tiempoPorTestMin:
          this.formGroup.value.tiempoLimiteEnMinutos ?? undefined,
        duracionSalaHoras: this.formGroup.value.duracionSalaHoras ?? undefined,
      };
      const res = await firstValueFrom(this.dueloService.crearDuelo$(dto));
      this.toast.success(
        `Desafío creado. Comparte el código ${res.codigo} con tus compañeros.`,
        'Desafío creado',
      );
      // Refresca la lista: el test del creador (con su código) aparece como
      // pendiente, con botón "Continuar" para empezar a jugar.
      this.getAllTestsComenzados$ = this.testService.getAllTest();
      this.generandoTest = false;
    } catch (error: any) {
      this.generandoTest = false;
      this.toast.error(
        error?.error?.message || error?.message || 'Error al crear el desafío.',
        'Error',
      );
    }
  }

  private confirmarSobreescribirTest(autoRedirect: boolean) {
    this.confirmationService.confirm({
      message:
        'Ya tienes un test en curso. ¿Quieres descartarlo y generar uno nuevo?',
      header: 'Test existente',
      icon: 'pi pi-exclamation-triangle',
      acceptIcon: 'none',
      acceptLabel: 'Sí, generar nuevo',
      rejectLabel: 'No',
      rejectIcon: 'none',
      rejectButtonStyleClass: 'p-button-text',
      accept: () => {
        this.generarTest(autoRedirect, true);
      },
    });
  }

  public eliminarTest(idTest: number, event: Event) {
    this.confirmationService.confirm({
      target: event.target as EventTarget,
      message: `Vas a eliminar el test con id ${idTest}, ¿estás seguro?`,
      header: 'Confirmación',
      icon: 'pi pi-exclamation-triangle',
      acceptIcon: 'none',
      acceptLabel: 'Sí',
      rejectLabel: 'No',
      rejectIcon: 'none',
      rejectButtonStyleClass: 'p-button-text',
      accept: async () => {
        await firstValueFrom(this.testService.eliminarTest(idTest));
        this.toast.info('Test eliminado exitosamente');
        this.getAllTestsComenzados$ = this.testService.getAllTest();
      },
      reject: () => {},
    });
  }
}
