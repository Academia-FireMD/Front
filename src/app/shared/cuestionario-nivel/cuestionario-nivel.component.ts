import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  inject,
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
import type { RecomendacionNivel } from '../../planificacion/models/autoasignacion.model';
import { AutoasignacionService } from '../../planificacion/services/autoasignacion.service';
import { NivelOposicion } from '../models/pregunta.model';

/**
 * Cuestionario reutilizable de recomendación de nivel.
 * Calcula una recomendación y solo emite el nivel cuando el alumno la acepta;
 * no persiste preferencias ni conoce el formulario que lo aloja.
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
  styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .cuestionario-opcion {
      min-height: 44px;
      padding-block: 0.25rem;
    }

    .cuestionario-opcion label {
      align-self: stretch;
      display: flex;
      flex: 1;
      min-width: 0;
    }

    .cuestionario-acciones {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    @media (max-width: 480px) {
      .cuestionario-acciones {
        align-items: stretch;
        flex-direction: column;
      }

      :host ::ng-deep .cuestionario-acciones .p-button {
        justify-content: center;
        min-height: 44px;
        width: 100%;
      }
    }
  `,
  template: `
    <div class="flex flex-column gap-3" data-testid="cuestionario-nivel">
      @if (cargando()) {
        <div role="status" aria-live="polite">
          <p-message
            severity="info"
            text="Cargando cuestionario…"
            styleClass="w-full"
          />
        </div>
      } @else {
        <p>
          Responde {{ preguntas.length }} preguntas sobre tu experiencia con el
          temario:
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
                <div class="cuestionario-opcion flex align-items-start gap-2">
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
      }

      <div aria-live="polite">
        @if (error) {
          <p-message severity="warn" [text]="error" styleClass="w-full" />
        }
      </div>

      @if (recomendacion) {
        <div aria-live="polite">
          <p-message
            severity="success"
            [text]="
              'Te recomendamos el nivel ' +
              getNivelLabel(recomendacion.nivelRecomendado) +
              '.'
            "
            styleClass="w-full"
          />
        </div>
        <div class="cuestionario-acciones">
          <p-button
            label="Aceptar recomendación"
            icon="pi pi-check"
            (click)="aceptarRecomendacion()"
          />
          <p-button
            label="Volver a elegir nivel"
            styleClass="p-button-text"
            (click)="reiniciar()"
          />
        </div>
      } @else {
        <div class="cuestionario-acciones">
          <p-button
            label="Obtener recomendación"
            icon="pi pi-magic"
            [loading]="enviando()"
            [disabled]="cargando() || preguntas.length === 0"
            (click)="obtenerRecomendacion()"
          />
          <p-button
            label="Cancelar"
            styleClass="p-button-text"
            (click)="cancelado.emit()"
          />
        </div>
      }
    </div>
  `,
})
export class CuestionarioNivelComponent implements OnInit {
  @Output() nivelAceptado = new EventEmitter<NivelOposicion>();
  @Output() cancelado = new EventEmitter<void>();

  private readonly autoasignacionService = inject(AutoasignacionService);
  private readonly toast = inject(ToastrService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly cargando = signal(true);
  readonly enviando = signal(false);
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
    this.cargarCuestionario();
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

  aceptarRecomendacion(): void {
    if (this.recomendacion) {
      this.nivelAceptado.emit(this.recomendacion.nivelRecomendado);
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
