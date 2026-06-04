import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';
import { CursosAlumnoService } from '../services/cursos-alumno.service';
import { AccesoConCurso } from '../models/curso.model';

@Component({
  selector: 'app-mis-cursos-page',
  standalone: true,
  imports: [ButtonModule, CardModule, ProgressBarModule, TagModule, RouterLink],
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

  openCurso(slug: string): void {
    this.router.navigate(['/app/cursos', slug]);
  }

  calcularProgreso(acceso: AccesoConCurso): number {
    const lecciones = acceso.curso.secciones?.flatMap((s) => s.lecciones) ?? [];
    const total = lecciones.length;
    if (total === 0) return 0;
    const completadas = (acceso.progreso ?? []).filter(
      (p) => p.completada,
    ).length;
    return Math.round((completadas / total) * 100);
  }
}
