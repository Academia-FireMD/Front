import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom } from 'rxjs';
import { AsyncButtonComponent } from '../../shared/components/async-button/async-button.component';
import { MarkdownEditorComponent } from '../../shared/markdown-editor/markdown-editor.component';
import {
  DetalleDisciplina,
  GRUPO_DISCIPLINA_COLORES,
  GrupoDisciplina,
  PlanificacionFisicaService,
  SemanaConDetalles,
} from '../services/planificacion-fisica.service';

/**
 * Vista de edición del texto de los ejercicios de un bloque ("ventana por
 * disciplina" pedida por el cliente). La parrilla (qué disciplina toca cada
 * día) la sube el entrenador por Excel; aquí SOLO se escribe el `contenido`
 * (el texto de los ejercicios) de cada hueco de la parrilla, disciplina a
 * disciplina, semana a semana.
 */
@Component({
  selector: 'app-planificacion-fisica-detalles',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    ButtonModule,
    CardModule,
    TagModule,
    MarkdownEditorComponent,
    AsyncButtonComponent,
  ],
  templateUrl: './planificacion-fisica-detalles.component.html',
  styleUrl: './planificacion-fisica-detalles.component.scss',
})
export class PlanificacionFisicaDetallesComponent implements OnInit {
  private svc = inject(PlanificacionFisicaService);
  private toast = inject(ToastrService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected readonly grupoColores = GRUPO_DISCIPLINA_COLORES;

  protected semanas = signal<SemanaConDetalles[]>([]);
  protected loading = signal(false);

  private bloqueId!: number;
  /** Un `FormControl` por detalle (creado bajo demanda, indexado por su id). */
  private controls = new Map<number, FormControl<string>>();

  async ngOnInit(): Promise<void> {
    const idParam = this.route.snapshot.paramMap.get('bloqueId');
    const id = idParam ? Number(idParam) : NaN;
    if (!idParam || Number.isNaN(id)) {
      this.toast.error('Bloque inválido.');
      this.volver();
      return;
    }
    this.bloqueId = id;
    await this.cargar();
  }

  private async cargar(): Promise<void> {
    this.loading.set(true);
    try {
      const semanas = await firstValueFrom(
        this.svc.detallesDeBloque(this.bloqueId),
      );
      this.semanas.set(semanas);
    } catch {
      this.toast.error('No se han podido cargar los detalles del bloque.');
    } finally {
      this.loading.set(false);
    }
  }

  volver(): void {
    this.router.navigate(['/app/planificacion-fisica/admin']);
  }

  protected colorGrupo(grupo: GrupoDisciplina): string {
    return this.grupoColores[grupo];
  }

  /** Devuelve (creando si hace falta) el control reactivo del `contenido` de un detalle. */
  protected controlFor(detalle: DetalleDisciplina): FormControl<string> {
    let control = this.controls.get(detalle.id);
    if (!control) {
      control = new FormControl<string>(detalle.contenido ?? '', {
        nonNullable: true,
      });
      this.controls.set(detalle.id, control);
    }
    return control;
  }

  /**
   * `<app-async-button>` recibe una función SIN argumentos (`() =>
   * Promise<any>`); esta fábrica cierra sobre el `detalle` concreto de cada
   * tarjeta del `@for`, igual que el patrón `.bind(this)` que ya usa el
   * resto del repo para acciones parametrizadas.
   */
  protected guardarAccion(detalle: DetalleDisciplina): () => Promise<void> {
    return () => this.guardarDetalle(detalle);
  }

  protected async guardarDetalle(detalle: DetalleDisciplina): Promise<void> {
    const contenido = this.controlFor(detalle).value ?? '';
    try {
      await firstValueFrom(
        this.svc.actualizarDetalle(detalle.id, { contenido }),
      );
      this.actualizarDetalleLocal(detalle.id, contenido);
      this.toast.success(`Guardado: ${detalle.disciplinaNombre}.`);
    } catch {
      this.toast.error(
        `No se ha podido guardar "${detalle.disciplinaNombre}". Inténtalo de nuevo.`,
      );
    }
  }

  /** Actualiza `vacio`/`contenido` en el signal tras un guardado con éxito. */
  private actualizarDetalleLocal(id: number, contenido: string): void {
    this.semanas.update((semanas) =>
      semanas.map((semana) => ({
        ...semana,
        detalles: semana.detalles.map((d) =>
          d.id === id
            ? { ...d, contenido, vacio: contenido.trim().length === 0 }
            : d,
        ),
      })),
    );
  }
}
