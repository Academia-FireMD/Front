import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { ButtonModule } from 'primeng/button';
import { Leccion, ProgresoLeccion, Seccion } from '../models/curso.model';
import { HidraulicaSyncEstado } from '../services/hidraulica-interactivo.service';
import { CurriculumSidebarComponent } from '../ui/curriculum-sidebar.component';

/**
 * Workspace nativo del aula APLICACION (2026-10-28). Ocupa el viewport completo
 * (100dvh, blanco) y sustituye temporalmente el chrome global + currículum
 * permanente. El contenido se proyecta una sola vez para conservar el iframe y
 * su contexto al abrir/cerrar el drawer o redimensionar.
 */
@Component({
  selector: 'app-aplicacion-workspace',
  standalone: true,
  imports: [A11yModule, ButtonModule, CurriculumSidebarComponent],
  templateUrl: './aplicacion-workspace.component.html',
  styleUrl: './aplicacion-workspace.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'onEscape()',
  },
})
export class AplicacionWorkspaceComponent {
  tituloCurso = input<string>('');
  tituloLeccion = input<string>('');
  secciones = input.required<Seccion[]>();
  progreso = input<ProgresoLeccion[]>([]);
  leccionActivaId = input<number | null>(null);
  marcando = input<boolean>(false);
  completada = input<boolean>(false);
  syncEstado = input<HidraulicaSyncEstado>('loading');
  syncTexto = input<string>('Cargando aplicación…');
  puedeReintentar = input<boolean>(false);

  volver = output<void>();
  seleccionar = output<Leccion>();
  marcarCompletada = output<void>();
  reintentar = output<void>();

  readonly drawerAbierto = signal(false);

  private readonly btnLecciones =
    viewChild<ElementRef<HTMLButtonElement>>('btnLecciones');
  private readonly btnCerrar =
    viewChild<ElementRef<HTMLButtonElement>>('btnCerrar');
  private readonly destroyRef = inject(DestroyRef);
  private focoPrevio: HTMLElement | null = null;
  private focoTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => this.limpiarTimer());
  }

  abrirDrawer(): void {
    if (this.drawerAbierto()) return;
    this.focoPrevio =
      typeof document !== 'undefined'
        ? (document.activeElement as HTMLElement | null)
        : null;
    this.drawerAbierto.set(true);
    this.limpiarTimer();
    this.focoTimer = setTimeout(() => {
      this.btnCerrar()?.nativeElement.focus();
    });
  }

  cerrarDrawer(devolverFoco = true): void {
    if (!this.drawerAbierto()) return;
    this.drawerAbierto.set(false);
    this.limpiarTimer();
    if (!devolverFoco) {
      this.focoPrevio = null;
      return;
    }
    this.focoTimer = setTimeout(() => {
      const destino = this.focoPrevio ?? this.btnLecciones()?.nativeElement;
      destino?.focus?.();
      this.focoPrevio = null;
    });
  }

  onEscape(): void {
    this.cerrarDrawer();
  }

  onSeleccionar(leccion: Leccion): void {
    this.seleccionar.emit(leccion);
    this.cerrarDrawer(false);
  }

  onMarcarCompletada(): void {
    if (this.marcando()) return;
    this.marcarCompletada.emit();
  }

  private limpiarTimer(): void {
    if (this.focoTimer) {
      clearTimeout(this.focoTimer);
      this.focoTimer = null;
    }
  }
}
