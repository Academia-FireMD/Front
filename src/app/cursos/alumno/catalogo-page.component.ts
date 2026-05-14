import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { CursosAlumnoService } from '../services/cursos-alumno.service';
import { CursoPublico } from '../models/curso.model';

const WOO_STAGING_BASE = 'https://staging2.tecnikafire.com/?p=';

@Component({
  selector: 'app-catalogo-page',
  standalone: true,
  imports: [ButtonModule, TagModule, RouterLink, DecimalPipe],
  templateUrl: './catalogo-page.component.html',
  styleUrl: './catalogo-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogoPageComponent implements OnInit {
  private readonly service = inject(CursosAlumnoService);

  cursos = signal<CursoPublico[]>([]);
  loading = signal(true);
  error = signal(false);

  ngOnInit(): void {
    this.service.listCatalogo().subscribe({
      next: (data) => {
        this.cursos.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  comprar(curso: CursoPublico): void {
    if (curso.wooProductId) {
      window.open(`${WOO_STAGING_BASE}${curso.wooProductId}`, '_blank');
    }
  }
}
