import { ButtonModule } from 'primeng/button';
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AccesoConCurso } from '../../cursos/models/curso.model';
import { Consumible } from '../models/user.model';
@Component({
  selector: 'app-alumno-accesos',
  standalone: true,
  imports: [ButtonModule, CommonModule],
  styleUrls: ['./alumno-cards.scss'],
  template: ` <article class="alumno-card" data-testid="alumno-accesos">
    <div class="alumno-card-head">
      <div>
        <h2>{{ perfil ? 'Mis accesos' : 'Productos independientes' }}</h2>
      </div>
    </div>
    <p class="alumno-card-intro">Cursos y simulacros con su propio acceso.</p>
    <div class="alumno-card-body">
      <div *ngIf="cargando" class="alumno-empty" role="status">
        Cargando accesos…
      </div>
      <div *ngIf="error" class="alumno-empty" role="alert">
        <h3>No se han podido cargar los cursos</h3>
        <button
          pButton
          type="button"
          class="alumno-btn p-button-outlined"
          (click)="reintentar.emit()"
        >
          Volver a cargar
        </button>
      </div>
      <div class="alumno-products" *ngIf="!cargando">
        <div *ngFor="let acceso of cursos" class="alumno-product">
          <div class="alumno-product-title">
            <span class="alumno-product-icon"
              ><i class="pi pi-book" aria-hidden="true"></i
            ></span>
            <div>
              <h3>{{ acceso.curso.titulo }}</h3>
              <p>
                Curso ·
                {{
                  acceso.expiraEn
                    ? 'Hasta ' + (acceso.expiraEn | date: 'd MMM yyyy')
                    : 'Acceso permanente'
                }}
              </p>
            </div>
          </div>
          <div class="alumno-progress-label">
            <span>Progreso</span><strong>{{ progreso(acceso) }} %</strong>
          </div>
          <div
            class="alumno-progress"
            role="progressbar"
            [attr.aria-label]="'Progreso de ' + acceso.curso.titulo"
            [attr.aria-valuenow]="progreso(acceso)"
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <span [style.width.%]="progreso(acceso)"></span>
          </div>
          <button
            pButton
            *ngIf="perfil"
            type="button"
            class="alumno-btn full p-button-outlined"
            (click)="abrirCurso.emit(acceso)"
          >
            Continuar curso<i class="pi pi-arrow-right" aria-hidden="true"></i>
          </button>
        </div>
        <div *ngFor="let c of consumibles" class="alumno-product">
          <div class="alumno-product-title">
            <span class="alumno-product-icon"
              ><i class="pi pi-ticket" aria-hidden="true"></i
            ></span>
            <div>
              <h3>{{ c.examen?.titulo || 'Simulacro' }}</h3>
              <p>
                {{
                  c.estado === 'ACTIVADO'
                    ? 'Disponible'
                    : c.estado === 'USADO'
                      ? 'Usado'
                      : 'Caducado'
                }}
              </p>
            </div>
          </div>
          <p *ngIf="c.expiraEn">
            Caduca el {{ c.expiraEn | date: 'dd/MM/yyyy' }}
          </p>
          <button
            pButton
            *ngIf="perfil && c.estado === 'ACTIVADO' && c.examen"
            type="button"
            class="alumno-btn full p-button-outlined"
            (click)="usar.emit(c)"
          >
            Realizar simulacro</button
          ><button
            pButton
            *ngIf="perfil && c.estado === 'USADO'"
            type="button"
            class="alumno-btn full p-button-outlined"
            [disabled]="!puedeVerResultados(c)"
            (click)="resultados.emit(c)"
          >
            Ver resultados
          </button>
          <p *ngIf="c.estado === 'ACTIVADO' && !c.examen">
            Pendiente de vinculación al examen.
          </p>
        </div>
      </div>
      <div
        *ngIf="!cargando && !error && !cursos.length && !consumibles.length"
        class="alumno-empty"
      >
        <i class="pi pi-ticket" aria-hidden="true"></i>
        <h3>Sin productos independientes</h3>
        <p>Los cursos y simulacros disponibles aparecerán aquí.</p>
        <button
          pButton
          *ngIf="perfil"
          type="button"
          class="alumno-btn full p-button-outlined"
          (click)="tienda.emit()"
        >
          Explorar la tienda
        </button>
      </div>
    </div>
  </article>`,
})
export class AlumnoAccesosComponent {
  @Input() cursos: AccesoConCurso[] = [];
  @Input() consumibles: Consumible[] = [];
  @Input() perfil = false;
  @Input() cargando = false;
  @Input() error = false;
  @Input() puedeVerResultados: (c: Consumible) => boolean = () => false;
  @Output() tienda = new EventEmitter<void>();
  @Output() abrirCurso = new EventEmitter<AccesoConCurso>();
  @Output() usar = new EventEmitter<Consumible>();
  @Output() resultados = new EventEmitter<Consumible>();
  @Output() reintentar = new EventEmitter<void>();
  progreso(acceso: AccesoConCurso) {
    const lecciones = new Set(
      acceso.curso.secciones?.flatMap(
        (s) => s.lecciones?.map((l) => l.id) || [],
      ) || [],
    );
    if (!lecciones.size) return 0;
    const vistos = new Map<number, number>();
    for (const p of acceso.progreso || []) {
      if (lecciones.has(p.leccionId))
        vistos.set(
          p.leccionId,
          p.completada
            ? 100
            : Math.max(0, Math.min(100, Number(p.porcentajeVisto) || 0)),
        );
    }
    return Math.round(
      [...vistos.values()].reduce((n, p) => n + p, 0) / lecciones.size,
    );
  }
}
