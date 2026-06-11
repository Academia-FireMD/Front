import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { Leccion, Seccion } from '../models/curso.model';
import { leccionesPlanas } from './progreso.util';

/**
 * Marco del aula: layout de 2 columnas (currículum + contenido) con header
 * (breadcrumb del curso + título de la lección) y footer de navegación
 * (Anterior / Marcar completada / Siguiente). El currículum se proyecta via
 * `[sidebar]`, el contenido de la lección via el slot por defecto.
 * En móvil el currículum es un drawer.
 */
@Component({
  selector: 'app-leccion-shell',
  standalone: true,
  imports: [ButtonModule],
  templateUrl: './leccion-shell.component.html',
  styleUrl: './leccion-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeccionShellComponent {
  secciones = input.required<Seccion[]>();
  leccionActivaId = input.required<number | null>();
  tituloCurso = input<string>('');
  tituloLeccion = input<string>('');
  /** true mientras se marca completada (spinner del botón). */
  marcando = input<boolean>(false);
  /** true si la lección activa ya está completada (cambia el botón). */
  completada = input<boolean>(false);

  navegar = output<Leccion>();
  marcarCompletada = output<void>();
  volver = output<void>();

  readonly drawerAbierto = signal(false);

  private readonly planas = computed(() =>
    leccionesPlanas({ secciones: this.secciones() }),
  );
  private readonly idx = computed(() =>
    this.planas().findIndex((l) => l.id === this.leccionActivaId()),
  );

  readonly anteriorL = computed(() => {
    const i = this.idx();
    return i > 0 ? this.planas()[i - 1] : null;
  });
  readonly siguienteL = computed(() => {
    const i = this.idx();
    const p = this.planas();
    return i >= 0 && i < p.length - 1 ? p[i + 1] : null;
  });

  anterior(): void {
    const l = this.anteriorL();
    if (l) this.navegar.emit(l);
  }
  siguiente(): void {
    const l = this.siguienteL();
    if (l) this.navegar.emit(l);
  }
  toggleDrawer(): void {
    this.drawerAbierto.update((v) => !v);
  }
  cerrarDrawer(): void {
    this.drawerAbierto.set(false);
  }
}
