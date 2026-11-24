import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import {
  Subject,
  catchError,
  distinctUntilChanged,
  forkJoin,
  map,
  of,
  startWith,
  switchMap,
  timeout,
} from 'rxjs';
import { DocumentosService } from '../../documentacion/services/documentacion.service';
import { AppConfigService } from '../../services/app-config.service';
import { AuthService } from '../../services/auth.service';
import { TemaService } from '../../services/tema.service';
import { ModuloApp } from '../../shared/models/modulo-app.enum';
import { EstudioWorkspaceComponent } from '../estudio-workspace.component';
import { PreviaLibrillosPdfComponent } from './previa-librillos-pdf.component';
import { parametrosPracticaLibrillo } from './previa-librillos';
import {
  TemaLibrillo,
  crearTemarioLibrillo,
  esPdfDeLibrillo,
  seleccionLibrillo,
} from './temario-librillo';

type EstadoTemario =
  | { tipo: 'cargando' | 'error' | 'sesion' }
  | { tipo: 'disponible'; temas: TemaLibrillo[] };

@Component({
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    ButtonModule,
    DropdownModule,
    EstudioWorkspaceComponent,
    PreviaLibrillosPdfComponent,
  ],
  templateUrl: './previa-librillos.component.html',
  styleUrl: './previa-librillos.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PreviaLibrillosComponent {
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);
  private readonly documentos = inject(DocumentosService);
  private readonly banco = inject(TemaService);
  private readonly config = inject(AppConfigService);
  private readonly sesion = this.auth.sessionSnapshot();
  private readonly actualizar = new Subject<void>();
  private readonly visorInteractivo = viewChild(EstudioWorkspaceComponent);
  private readonly params = toSignal(this.ruta.queryParamMap, {
    initialValue: this.ruta.snapshot.queryParamMap,
  });

  readonly estado = toSignal(
    this.auth.currentIdentity$.pipe(
      startWith(null),
      map(() => this.auth.isSessionCurrent(this.sesion)),
      distinctUntilChanged(),
      switchMap((vigente) =>
        vigente
          ? this.actualizar.pipe(
              startWith(undefined),
              switchMap(() => this.cargarTemario()),
            )
          : of({ tipo: 'sesion' } as const),
      ),
    ),
    { initialValue: { tipo: 'cargando' } as const },
  );

  readonly temas = computed(() => {
    const estado = this.estado();
    return estado.tipo === 'disponible' ? estado.temas : [];
  });
  readonly seleccion = computed(() =>
    seleccionLibrillo(this.temas(), this.params()),
  );
  readonly parametrosPractica = computed(() => {
    const { tema, documento } = this.seleccion();
    return tema
      ? parametrosPracticaLibrillo({ id: tema.id, documentoId: documento?.id })
      : undefined;
  });
  readonly testActivo = computed(() =>
    this.config.isModuloHabilitado(ModuloApp.TEST),
  );
  readonly flashcardsActivas = computed(() =>
    this.config.isModuloHabilitado(ModuloApp.FLASHCARDS),
  );
  readonly esPdf = esPdfDeLibrillo;

  private cargarTemario() {
    return forkJoin({
      temas: this.banco.getAllTemas$(),
      arbol: this.documentos.getDocumentTree$(),
    }).pipe(
      timeout(15000),
      map(
        ({ temas, arbol }): EstadoTemario => ({
          tipo: 'disponible',
          temas: crearTemarioLibrillo(temas, arbol),
        }),
      ),
      catchError(() => of({ tipo: 'error' } as const)),
      startWith({ tipo: 'cargando' } as const),
    );
  }

  seleccionarTema(id: number) {
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { tema: id },
    });
  }

  seleccionarDocumento(id: number) {
    const tema = this.seleccion().tema;
    if (!tema) return;
    void this.router.navigate([], {
      relativeTo: this.ruta,
      queryParams: { tema: tema.id, doc: id },
    });
  }

  recargar() {
    this.actualizar.next();
  }

  async guardarAntesDeSalir() {
    await this.visorInteractivo()?.guardarAntesDeSalir();
    return true;
  }
}
