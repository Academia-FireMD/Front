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
import { environment } from '../../../environments/environment';
import { CursosAlumnoService } from '../services/cursos-alumno.service';
import { CursoPublico } from '../models/curso.model';

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
    if (!curso.wooProductId) return;
    // Resolve the WooCommerce host from environment so prod and staging
    // open the right storefront. wordpressUrl is the same WP install
    // WooCommerce is mounted on.
    const base =
      (environment as { wooCommerceUrl?: string; wordpressUrl?: string })
        .wooCommerceUrl ??
      (environment as { wordpressUrl?: string }).wordpressUrl ??
      '';
    if (!base) return;
    const sep = base.includes('?') ? '&' : '/?';
    window.open(`${base}${sep}p=${curso.wooProductId}`, '_blank');
  }
}
