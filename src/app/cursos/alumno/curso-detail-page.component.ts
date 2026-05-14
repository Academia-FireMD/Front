import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { AccordionModule } from 'primeng/accordion';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { CursosAlumnoService } from '../services/cursos-alumno.service';
import { CursoSlugResponse, Leccion, TipoLeccion } from '../models/curso.model';

@Component({
  selector: 'app-curso-detail-page',
  standalone: true,
  imports: [
    AccordionModule,
    ButtonModule,
    TagModule,
    TooltipModule,
    RouterLink,
    DecimalPipe,
  ],
  templateUrl: './curso-detail-page.component.html',
  styleUrl: './curso-detail-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CursoDetailPageComponent implements OnInit {
  private readonly service = inject(CursosAlumnoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  cursoData = signal<CursoSlugResponse | null>(null);
  loading = signal(true);
  error = signal(false);

  tipoIconos: Record<TipoLeccion, string> = {
    VIDEO: 'pi pi-play-circle',
    TEXTO: 'pi pi-file',
    TEST: 'pi pi-question-circle',
    FLASHCARDS: 'pi pi-clone',
  };

  tipoLabels: Record<TipoLeccion, string> = {
    VIDEO: 'Vídeo',
    TEXTO: 'Lectura',
    TEST: 'Test',
    FLASHCARDS: 'Flashcards',
  };

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    this.service.getCurso(slug).subscribe({
      next: (data) => {
        this.cursoData.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  openLeccion(leccion: Leccion): void {
    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    this.router.navigate(['/app/cursos', slug, 'leccion', leccion.id]);
  }

  totalLecciones(): number {
    return (
      this.cursoData()?.curso.secciones?.flatMap((s) => s.lecciones).length ?? 0
    );
  }
}
