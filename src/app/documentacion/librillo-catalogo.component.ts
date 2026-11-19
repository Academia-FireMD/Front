import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  afterNextRender,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  DocumentosService,
  EntradaLibrillo,
} from './services/documentacion.service';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="catalogo" aria-labelledby="librillos-titulo">
      <h1 id="librillos-titulo">Librillos</h1>
      @if (loading()) {
        <p role="status">Cargando librillos…</p>
      } @else if (error()) {
        <p role="alert">No se han podido cargar tus librillos.</p>
        <button
          type="button"
          class="p-button p-button-outlined"
          (click)="cargar()"
        >
          Reintentar
        </button>
      } @else {
        <ul>
          @for (item of entradas(); track item.documento.id) {
            <li>
              <div>
                <h2>{{ item.documento.librillo?.titulo }}</h2>
                <p>{{ item.contexto }}</p>
              </div>
              <a
                class="p-button p-button-outlined"
                [id]="'catalogo-doc-' + item.documento.id"
                [routerLink]="[
                  '/app/documentacion/alumno/librillo',
                  item.documento.id,
                ]"
                [queryParams]="{ tema: item.tema, desde: 'librillos' }"
                >Estudiar con librillo</a
              >
            </li>
          } @empty {
            <li>No tienes librillos disponibles.</li>
          }
        </ul>
      }
      <a class="temario" routerLink="/app/documentacion/alumno"
        >Ir al temario</a
      >
    </section>
  `,
  styles: `
    .catalogo {
      padding: clamp(0.75rem, 3vw, 2rem);
      max-width: 70rem;
      margin: auto;
    }
    ul {
      list-style: none;
      padding: 0;
    }
    li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 1rem;
      margin-bottom: 0.75rem;
      border: 1px solid var(--surface-border);
      border-radius: 8px;
      background: var(--surface-card);
    }
    h2 {
      font-size: 1.1rem;
      margin: 0 0 0.25rem;
    }
    p {
      margin: 0;
    }
    a,
    button {
      min-height: 44px;
    }
    .temario {
      display: inline-flex;
      align-items: center;
      text-decoration: underline;
    }
    :focus-visible {
      outline: 2px solid var(--primary-color, #bb292a);
      outline-offset: 2px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LibrilloCatalogoComponent {
  private readonly docs = inject(DocumentosService);
  private readonly route = inject(ActivatedRoute);
  private readonly injector = inject(Injector);
  readonly entradas = signal<EntradaLibrillo[]>([]);
  readonly loading = signal(false);
  readonly error = signal(false);

  constructor() {
    this.cargar();
  }

  cargar() {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set(false);
    this.docs
      .getLibrillos$()
      .pipe(takeUntilDestroyed(this.injector.get(DestroyRef)))
      .subscribe({
        next: (entradas) => {
          this.entradas.set(entradas);
          this.loading.set(false);
          const docId = Number(this.route.snapshot.queryParamMap.get('doc'));
          if (entradas.some(({ documento }) => documento.id === docId))
            afterNextRender(
              () => document.getElementById(`catalogo-doc-${docId}`)?.focus(),
              { injector: this.injector },
            );
        },
        error: () => {
          this.loading.set(false);
          this.error.set(true);
        },
      });
  }
}
