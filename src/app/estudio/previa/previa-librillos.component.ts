import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
} from '@angular/core';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterLink,
  RouterOutlet,
} from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { filter, map, startWith } from 'rxjs';
import { AulaInmersivaService } from '../../cursos/ui/aula-inmersiva.service';
import {
  parametrosPracticaLibrillo,
  TEMAS_PREVIA_LIBRILLOS,
} from './previa-librillos';

@Component({
  standalone: true,
  imports: [RouterLink, RouterOutlet, ButtonModule],
  templateUrl: './previa-librillos.component.html',
  styleUrl: './previa-librillos.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PreviaLibrillosComponent {
  private readonly router = inject(Router);
  private readonly ruta = inject(ActivatedRoute);

  readonly temas = TEMAS_PREVIA_LIBRILLOS;
  readonly tema = toSignal(
    this.router.events.pipe(
      filter((evento) => evento instanceof NavigationEnd),
      startWith(null),
      map(
        () =>
          this.temas.find(
            ({ clave }) =>
              this.ruta.snapshot?.firstChild?.routeConfig?.path === clave,
          ) ?? this.temas[0],
      ),
    ),
    { initialValue: this.temas[0] },
  );
  readonly parametrosPractica = parametrosPracticaLibrillo;

  constructor() {
    const aula = inject(AulaInmersivaService);
    aula.activar();
    inject(DestroyRef).onDestroy(() => aula.desactivar());
  }
}
