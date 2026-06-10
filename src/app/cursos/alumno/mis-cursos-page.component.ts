import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AccesoConCurso } from '../models/curso.model';
import { CursosAlumnoService } from '../services/cursos-alumno.service';
import { CursoCardComponent } from '../ui/curso-card.component';
import { ProgressRingComponent } from '../ui/progress-ring.component';
import { calcularPorcentajeCurso, leccionContinuar } from '../ui/progreso.util';

/** Acceso enriquecido con datos derivados para la UI (progreso + continuar). */
interface AccesoVista {
  acceso: AccesoConCurso;
  porcentaje: number;
  continuarLeccionId: number | null;
  ultimaActividad: number; // epoch ms, 0 si nunca
}

@Component({
  selector: 'app-mis-cursos-page',
  standalone: true,
  imports: [ButtonModule, CursoCardComponent, ProgressRingComponent],
  templateUrl: './mis-cursos-page.component.html',
  styleUrl: './mis-cursos-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MisCursosPageComponent implements OnInit {
  private readonly service = inject(CursosAlumnoService);
  private readonly router = inject(Router);

  accesos = signal<AccesoConCurso[]>([]);
  loading = signal(true);
  error = signal(false);

  /** Accesos con sus métricas derivadas, ordenados por actividad reciente. */
  readonly vistas = computed<AccesoVista[]>(() =>
    this.accesos()
      .map((acceso) => this.aVista(acceso))
      .sort((a, b) => b.ultimaActividad - a.ultimaActividad),
  );

  /** Curso para el hero "Continuar aprendiendo": el más reciente en progreso. */
  readonly hero = computed<AccesoVista | null>(() => {
    const enProgreso = this.vistas().filter(
      (v) => v.ultimaActividad > 0 && v.porcentaje < 100,
    );
    return enProgreso[0] ?? null;
  });

  ngOnInit(): void {
    this.service.listMisCursos().subscribe({
      next: (data) => {
        this.accesos.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  private aVista(acceso: AccesoConCurso): AccesoVista {
    const curso = acceso.curso;
    const prog = acceso.progreso ?? [];
    const continuar = leccionContinuar(curso, prog);
    const ultima = prog
      .map((p) => (p.updatedAt ? +new Date(p.updatedAt) : 0))
      .reduce((max, t) => Math.max(max, t), 0);
    return {
      acceso,
      porcentaje: calcularPorcentajeCurso(curso, prog),
      continuarLeccionId: continuar?.id ?? null,
      ultimaActividad: ultima,
    };
  }

  abrirCurso(slug: string): void {
    this.router.navigate(['/app/cursos', slug]);
  }

  continuar(v: AccesoVista): void {
    const slug = v.acceso.curso.slug;
    if (v.continuarLeccionId != null) {
      this.router.navigate([
        '/app/cursos',
        slug,
        'leccion',
        v.continuarLeccionId,
      ]);
    } else {
      this.abrirCurso(slug);
    }
  }

  irACatalogo(): void {
    this.router.navigate(['/app/cursos/catalogo']);
  }
}
