import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CursosAlumnoService } from '../services/cursos-alumno.service';
import { LeccionResponse } from '../models/curso.model';
import { LeccionVideoComponent } from './leccion-video.component';
import { LeccionTextoComponent } from './leccion-texto.component';

@Component({
  selector: 'app-leccion-page',
  standalone: true,
  imports: [ButtonModule, LeccionVideoComponent, LeccionTextoComponent],
  templateUrl: './leccion-page.component.html',
  styleUrl: './leccion-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeccionPageComponent implements OnInit {
  private readonly service = inject(CursosAlumnoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  leccionData = signal<LeccionResponse | null>(null);
  loading = signal(true);
  error = signal(false);

  get slug(): string {
    return this.route.snapshot.paramMap.get('slug') ?? '';
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    const id = idParam ? parseInt(idParam, 10) : NaN;
    if (isNaN(id)) {
      this.error.set(true);
      this.loading.set(false);
      return;
    }
    this.service.getLeccion(id).subscribe({
      next: (data) => {
        this.leccionData.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  volver(): void {
    this.router.navigate(['/app/cursos', this.slug]);
  }

  abrirTest(testId: number): void {
    this.router.navigate(['/app/test/alumno/realizar-test', testId]);
  }

  abrirFlashcards(mazoId: number): void {
    this.router.navigate([
      '/app/test/alumno/realizar-flash-cards-test',
      mazoId,
    ]);
  }
}
