import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { PlanificacionesService } from '../../services/planificaciones.service';
import { SubBloque } from '../../shared/models/planificacion.model';
import {
  CatalogoContenidoCompleto,
  CatalogoTrabajo,
  TipoTrabajoCatalogo,
} from '../models/catalogo-contenido.model';
import { CatalogoSubbloquesListComponent } from './catalogo-subbloques-list.component';

@Component({
  selector: 'app-seleccionar-subbloques-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DialogModule,
    DropdownModule,
    InputNumberModule,
    CatalogoSubbloquesListComponent,
  ],
  template: `
    <p-dialog
      header="Seleccionar subbloques"
      [visible]="visible"
      (visibleChange)="cambiarVisibilidad($event)"
      [modal]="true"
      [draggable]="false"
      [resizable]="false"
      [style]="{ width: 'min(96vw, 68rem)', maxHeight: '95vh' }"
      [contentStyle]="{ maxHeight: 'calc(95vh - 9rem)', overflow: 'auto' }"
    >
      @if (paso === 1) {
        <p class="mt-0">
          Busca y selecciona uno o varios subbloques existentes.
        </p>
        @if (cargando) {
          <p aria-live="polite">Cargando subbloques…</p>
        } @else {
          <app-catalogo-subbloques-list
            mode="selection"
            [items]="filas"
            [selectedIds]="seleccion"
            [routeSyncEnabled]="false"
            (selectedIdsChange)="seleccion = $event"
          ></app-catalogo-subbloques-list>
        }
      } @else {
        <p class="mt-0">
          Ajusta la duración de cada copia. Podrás editarla después sin cambiar
          el subbloque original.
        </p>
        <div class="duracion-comun">
          <label for="duracion-todos">Duración para todos (minutos)</label>
          <p-inputNumber
            inputId="duracion-todos"
            [(ngModel)]="duracionTodos"
            [min]="1"
            [maxFractionDigits]="0"
          />
          <p-button
            label="Aplicar a todos"
            [outlined]="true"
            [disabled]="!duracionValida(duracionTodos)"
            (click)="aplicarDuracionTodos()"
          />
        </div>
        <div class="copias">
          @for (fila of filasSeleccionadas; track fila.id) {
            <div class="copia">
              <div class="copia-titulo">
                <strong>{{ fila.codigo }} · {{ fila.nombreCorto }}</strong>
              </div>
              <label [for]="'duracion-' + fila.id">Duración (minutos)</label>
              <p-inputNumber
                [inputId]="'duracion-' + fila.id"
                [(ngModel)]="duraciones[fila.id]"
                [min]="1"
                [maxFractionDigits]="0"
              />
              <details>
                <summary>Indicaciones de estudio (opcional)</summary>
                <label [for]="'trabajo-' + fila.id"
                  >Cómo trabajar este contenido</label
                >
                <p-dropdown
                  [inputId]="'trabajo-' + fila.id"
                  [(ngModel)]="tipos[fila.id]"
                  [options]="opcionesTrabajo"
                  optionLabel="label"
                  optionValue="value"
                  appendTo="body"
                  styleClass="w-full"
                ></p-dropdown>
              </details>
            </div>
          }
        </div>
        <p *ngIf="!duracionesValidas" class="p-error" aria-live="polite">
          Introduce un número entero de minutos mayor que cero para cada
          actividad.
        </p>
      }
      <ng-template pTemplate="footer">
        <div class="acciones">
          <span aria-live="polite"
            >{{ seleccion.length }}
            {{
              seleccion.length === 1 ? 'seleccionado' : 'seleccionados'
            }}</span
          >
          <p-button label="Cancelar" [text]="true" (click)="cerrar()" />
          @if (paso === 1) {
            <p-button
              label="Continuar"
              [disabled]="!seleccion.length || cargando"
              (click)="continuar()"
            />
          } @else {
            <p-button label="Volver" [outlined]="true" (click)="paso = 1" />
            <p-button
              label="Añadir copias"
              [loading]="agregando"
              [disabled]="!duracionesValidas"
              (click)="anadir()"
            />
          }
        </div>
      </ng-template>
    </p-dialog>
  `,
  styles: [
    `
      .duracion-comun,
      .acciones {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
      }
      .duracion-comun {
        margin-bottom: 1rem;
      }
      .duracion-comun label {
        font-weight: 600;
      }
      .copias {
        display: grid;
        gap: 0.75rem;
      }
      .copia {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto 10rem;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem;
        border: 1px solid var(--surface-border);
        border-radius: 0.5rem;
      }
      .copia-titulo {
        min-width: 0;
        overflow-wrap: anywhere;
      }
      .copia details {
        grid-column: 1 / -1;
      }
      .copia summary {
        cursor: pointer;
        min-height: 44px;
        padding: 0.5rem 0;
      }
      .copia details label {
        display: block;
        margin-bottom: 0.5rem;
      }
      .acciones {
        justify-content: flex-end;
      }
      @media (max-width: 640px) {
        .copia {
          grid-template-columns: 1fr;
        }
        .copia details {
          grid-column: 1;
        }
        .acciones {
          flex-direction: column;
          align-items: stretch;
        }
        .acciones span {
          text-align: center;
        }
        .duracion-comun {
          align-items: stretch;
          flex-direction: column;
        }
      }
    `,
  ],
})
export class SeleccionarSubbloquesDialogComponent {
  private readonly planificaciones = inject(PlanificacionesService);
  private readonly toast = inject(ToastrService);

  @Input() set visible(value: boolean) {
    if (value && !this._visible) void this.abrir();
    this._visible = value;
  }
  get visible(): boolean {
    return this._visible;
  }
  private _visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() selected = new EventEmitter<SubBloque[]>();

  paso: 1 | 2 = 1;
  cargando = false;
  agregando = false;
  filas: CatalogoContenidoCompleto[] = [];
  trabajos: CatalogoTrabajo[] = [];
  seleccion: (string | number)[] = [];
  duraciones: Record<number, number> = {};
  tipos: Record<number, TipoTrabajoCatalogo | null> = {};
  duracionTodos = 60;

  get filasSeleccionadas(): CatalogoContenidoCompleto[] {
    return this.seleccion
      .map((id) => this.filas.find((fila) => fila.id === Number(id)))
      .filter((fila): fila is CatalogoContenidoCompleto => !!fila);
  }

  get opcionesTrabajo() {
    return [
      { label: 'Sin indicaciones adicionales', value: null },
      ...this.trabajos.map((item) => ({
        label: `${item.trabajo} · ${item.descripcion}`,
        value: item.trabajo,
      })),
    ];
  }

  duracionValida(value: number): boolean {
    return Number.isInteger(value) && value > 0;
  }

  get duracionesValidas(): boolean {
    return (
      this.filasSeleccionadas.length === this.seleccion.length &&
      this.filasSeleccionadas.length > 0 &&
      this.filasSeleccionadas.every((fila) =>
        this.duracionValida(this.duraciones[fila.id]),
      )
    );
  }

  private async abrir(): Promise<void> {
    this.paso = 1;
    this.seleccion = [];
    this.duraciones = {};
    this.tipos = {};
    this.duracionTodos = 60;
    this.cargando = true;
    try {
      const catalogo = await firstValueFrom(
        this.planificaciones.listarCatalogoContenido(),
      );
      this.filas = catalogo.filas.filter((fila) => fila.activa);
      this.trabajos = catalogo.trabajos;
    } catch {
      this.toast.error('No se pudieron cargar los subbloques.');
      this.cerrar();
    } finally {
      this.cargando = false;
    }
  }

  cambiarVisibilidad(visible: boolean): void {
    if (!visible) this.cerrar();
  }

  cerrar(): void {
    this._visible = false;
    this.visibleChange.emit(false);
  }

  continuar(): void {
    if (!this.seleccion.length) return;
    for (const fila of this.filasSeleccionadas) {
      this.duraciones[fila.id] ??= 60;
      this.tipos[fila.id] ??= null;
    }
    this.paso = 2;
  }

  aplicarDuracionTodos(): void {
    if (!this.duracionValida(this.duracionTodos)) return;
    for (const fila of this.filasSeleccionadas)
      this.duraciones[fila.id] = this.duracionTodos;
  }

  async anadir(): Promise<void> {
    if (!this.duracionesValidas) return;
    this.agregando = true;
    try {
      const copias = await Promise.all(
        this.filasSeleccionadas.map(async (fila) => {
          const tipo = this.tipos[fila.id] ?? null;
          const contenido = await firstValueFrom(
            this.planificaciones.componerContenidoCatalogo(
              fila.codigo,
              tipo ?? undefined,
            ),
          );
          return {
            catalogoContenidoId: fila.id,
            tipoTrabajoPlanificacion: tipo,
            duracion: this.duraciones[fila.id],
            nombre: contenido.nombre,
            comentarios: contenido.comentarios,
            color: contenido.color,
            esEntrenamientoFisico: false,
          } as SubBloque;
        }),
      );
      this.selected.emit(copias);
      this.cerrar();
    } catch {
      this.toast.error(
        'Algún subbloque cambió o ya no está disponible. Revisa la selección.',
      );
    } finally {
      this.agregando = false;
    }
  }
}
