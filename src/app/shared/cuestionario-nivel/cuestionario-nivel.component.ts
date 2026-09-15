import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  inject,
  Input,
  OnInit,
  Output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { RadioButtonModule } from 'primeng/radiobutton';
import { firstValueFrom } from 'rxjs';
import type {
  EstadoTestNivel,
  RecomendacionNivel,
} from '../../planificacion/models/autoasignacion.model';
import { AutoasignacionService } from '../../planificacion/services/autoasignacion.service';
import { NivelOposicion } from '../models/pregunta.model';

/**
 * Launcher y cuestionario reutilizable. Calcular es reversible y no altera el
 * estado completado; solo `aceptarEvaluacionNivel` persiste y emite el nivel.
 */
@Component({
  selector: 'app-cuestionario-nivel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    MessageModule,
    RadioButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="flex flex-column gap-3" data-testid="cuestionario-nivel">
      @if (!abierto()) {
        @if (estadoTest) {
          <p-message
            severity="success"
            [text]="
              'Test completado. Elegiste el nivel ' +
              getNivelLabel(estadoTest.nivelElegido) +
              '.'
            "
            styleClass="w-full"
          />
        }
        <p-button
          [label]="estadoTest ? 'Repetir test de nivel' : 'Hacer test de nivel'"
          icon="pi pi-magic"
          styleClass="p-button-outlined"
          data-testid="abrir-test-nivel"
          (click)="abrir()"
        />
      } @else if (cargando()) {
        <p-message
          severity="info"
          text="Cargando cuestionario…"
          styleClass="w-full"
        />
      } @else {
        <p class="m-0">
          Responde {{ preguntas.length }} preguntas sobre tu experiencia con el
          temario. El resultado no cambiará tu planificación hasta que lo
          aceptes y confirmes el asistente.
        </p>

        @for (
          pregunta of preguntas;
          track pregunta.id;
          let preguntaIndex = $index
        ) {
          <div class="p-3 border-1 border-round surface-100">
            <div class="mb-2 font-medium">
              {{ preguntaIndex + 1 }}. {{ pregunta.texto }}
            </div>
            <div class="flex flex-column gap-2">
              @for (opcion of pregunta.opciones; track opcion.valor) {
                <div class="flex align-items-start gap-2">
                  <p-radioButton
                    [name]="'preguntaNivel' + preguntaIndex"
                    [inputId]="
                      'preguntaNivel' + preguntaIndex + 'opcion' + opcion.valor
                    "
                    [value]="opcion.valor"
                    [(ngModel)]="respuestas[preguntaIndex]"
                    (onClick)="onRespuestaChange(preguntaIndex, opcion.valor)"
                  />
                  <label
                    class="line-height-3 cursor-pointer"
                    [for]="
                      'preguntaNivel' + preguntaIndex + 'opcion' + opcion.valor
                    "
                  >
                    {{ opcion.etiqueta }}
                  </label>
                </div>
              }
            </div>
          </div>
        }

        @if (error) {
          <p-message severity="warn" [text]="error" styleClass="w-full" />
        }

        @if (recomendacion) {
          <p-message
            severity="success"
            [text]="
              'Te recomendamos el nivel ' +
              getNivelLabel(recomendacion.nivelRecomendado) +
              '.'
            "
            styleClass="w-full"
          />
          <div class="flex flex-wrap gap-2">
            <p-button
              label="Aceptar recomendación"
              icon="pi pi-check"
              [loading]="aceptando()"
              data-testid="aceptar-test-nivel"
              (click)="aceptarRecomendacion()"
            />
            @if (
              nivelActual && nivelActual !== recomendacion.nivelRecomendado
            ) {
              <p-button
                [label]="'Mantener nivel ' + getNivelLabel(nivelActual)"
                styleClass="p-button-secondary"
                [disabled]="aceptando()"
                data-testid="mantener-nivel-test"
                (click)="aceptarNivel(nivelActual)"
              />
            }
            <p-button
              label="Volver a responder"
              styleClass="p-button-text"
              [disabled]="aceptando()"
              (click)="reiniciar()"
            />
          </div>
        } @else {
          <div class="flex flex-wrap gap-2">
            <p-button
              label="Obtener recomendación"
              icon="pi pi-magic"
              [loading]="enviando()"
              [disabled]="preguntas.length === 0"
              (click)="obtenerRecomendacion()"
            />
            <p-button
              label="Cancelar"
              styleClass="p-button-text"
              data-testid="cancelar-test-nivel"
              (click)="cancelar()"
            />
          </div>
        }
      }
    </section>
  `,
})
export class CuestionarioNivelComponent implements OnInit {
  @Input() estadoTest: EstadoTestNivel | null = null;
  @Input() nivelActual: NivelOposicion | null = null;
  @Input() abiertoInicialmente = false;
  @Output() nivelAceptado = new EventEmitter<EstadoTestNivel>();
  @Output() cancelado = new EventEmitter<void>();

  private readonly autoasignacionService = inject(AutoasignacionService);
  private readonly toast = inject(ToastrService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly abierto = signal(false);
  readonly cargando = signal(false);
  readonly enviando = signal(false);
  readonly aceptando = signal(false);
  preguntas: Array<{
    id: string;
    texto: string;
    opciones: Array<{ valor: number; etiqueta: string }>;
  }> = [];
  respuestas: Array<number | null> = [];
  versionCuestionario: number | null = null;
  recomendacion: RecomendacionNivel | null = null;
  error: string | null = null;

  ngOnInit(): void {
    if (this.abiertoInicialmente) this.abrir();
  }

  abrir(): void {
    this.abierto.set(true);
    this.cargarCuestionario();
  }

  cancelar(): void {
    this.abierto.set(false);
    this.recomendacion = null;
    this.respuestas = [];
    this.error = null;
    this.cancelado.emit();
  }

  onRespuestaChange(indice: number, respuesta: number | string | null): void {
    const valor = respuesta === null ? null : Number(respuesta);
    this.respuestas = this.respuestas.map((actual, posicion) =>
      posicion === indice &&
      (valor === null || (Number.isInteger(valor) && valor >= 0 && valor <= 3))
        ? valor
        : actual,
    );
    this.error = null;
  }

  async obtenerRecomendacion(): Promise<void> {
    if (!this.cuestionarioCompleto || this.versionCuestionario === null) {
      this.error = `Responde las ${this.preguntas.length} preguntas antes de obtener una recomendación.`;
      this.toast.error(this.error);
      return;
    }

    this.error = null;
    this.enviando.set(true);
    try {
      this.recomendacion = await firstValueFrom(
        this.autoasignacionService.recomendarNivel$(
          this.respuestas as number[],
          this.versionCuestionario,
        ),
      );
    } catch (error) {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 409 &&
        error.error?.codigo === 'CUESTIONARIO_DESACTUALIZADO'
      ) {
        this.cargarCuestionario(
          'El cuestionario cambió mientras respondías. Se ha recargado.',
        );
      } else {
        this.error = 'No se pudo obtener la recomendación.';
        this.toast.error(this.error);
      }
    } finally {
      this.enviando.set(false);
      this.cdr.markForCheck();
    }
  }

  async aceptarRecomendacion(): Promise<void> {
    if (!this.recomendacion) return;
    await this.aceptarNivel(this.recomendacion.nivelRecomendado);
  }

  async aceptarNivel(nivelElegido: NivelOposicion): Promise<void> {
    if (!this.recomendacion) return;
    this.aceptando.set(true);
    try {
      const estado = await firstValueFrom(
        this.autoasignacionService.aceptarEvaluacionNivel$(
          this.recomendacion.evaluacionId,
          nivelElegido,
        ),
      );
      this.estadoTest = estado;
      this.abierto.set(false);
      this.recomendacion = null;
      this.nivelAceptado.emit(estado);
    } catch {
      this.error = 'No se pudo guardar tu elección. Inténtalo de nuevo.';
      this.toast.error(this.error);
    } finally {
      this.aceptando.set(false);
      this.cdr.markForCheck();
    }
  }

  reiniciar(): void {
    this.recomendacion = null;
    this.respuestas = this.respuestas.map(() => null);
    this.error = null;
  }

  get cuestionarioCompleto(): boolean {
    return (
      this.preguntas.length > 0 &&
      this.respuestas.length === this.preguntas.length &&
      this.respuestas.every(
        (respuesta): respuesta is number =>
          typeof respuesta === 'number' &&
          Number.isInteger(respuesta) &&
          respuesta >= 0 &&
          respuesta <= 3,
      )
    );
  }

  getNivelLabel(nivel: NivelOposicion): string {
    return nivel === NivelOposicion.AVANZADO ? 'Avanzado' : 'Iniciación';
  }

  private cargarCuestionario(mensaje?: string): void {
    this.cargando.set(true);
    this.error = null;
    this.autoasignacionService.getCuestionarioNivel$().subscribe({
      next: (cuestionario) => {
        this.versionCuestionario = cuestionario.version;
        this.preguntas = cuestionario.preguntas;
        this.respuestas = cuestionario.preguntas.map(() => null);
        this.recomendacion = null;
        this.cargando.set(false);
        if (mensaje) this.toast.warning(mensaje);
        this.cdr.markForCheck();
      },
      error: () => {
        this.versionCuestionario = null;
        this.preguntas = [];
        this.respuestas = [];
        this.cargando.set(false);
        this.error = 'No se pudo cargar el cuestionario.';
        this.cdr.markForCheck();
      },
    });
  }
}
