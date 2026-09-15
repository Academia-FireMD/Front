import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { filter, take } from 'rxjs';
import { Oposicion } from '../../shared/models/subscription.model';
import { Usuario } from '../../shared/models/user.model';
import { esAdminOSuperior } from '../../shared/utils/rol.utils';
import { selectCurrentUser } from '../../store/user/user.selectors';

export type DestinoCallejero =
  | 'valencia'
  | 'alicante'
  | 'selector'
  | 'sin-acceso';

export function resolverDestinoCallejero(
  user: Pick<Usuario, 'rol' | 'oposiciones'>,
): DestinoCallejero {
  if (esAdminOSuperior(user.rol)) return 'selector';

  const oposiciones = user.oposiciones ?? [];
  const tieneValencia = oposiciones.includes(Oposicion.VALENCIA_AYUNTAMIENTO);
  const tieneAlicante = oposiciones.includes(Oposicion.ALICANTE_CPBA);

  if (tieneValencia && tieneAlicante) return 'selector';
  if (tieneValencia) return 'valencia';
  if (tieneAlicante) return 'alicante';
  return 'sin-acceso';
}

@Component({
  selector: 'app-callejero-entrada',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './callejero-entrada.component.html',
  styleUrl: './callejero-entrada.component.scss',
})
export class CallejeroEntradaComponent implements OnInit {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  destino: DestinoCallejero | null = null;

  ngOnInit(): void {
    const subscription = this.store
      .select(selectCurrentUser)
      .pipe(
        filter((user) => user !== null),
        take(1),
      )
      .subscribe((user) => {
        this.destino = resolverDestinoCallejero(user);

        if (this.destino === 'valencia' || this.destino === 'alicante') {
          void this.router.navigate(['/app/callejero', this.destino], {
            replaceUrl: true,
          });
          return;
        }

        this.changeDetector.markForCheck();
      });

    this.destroyRef.onDestroy(() => subscription.unsubscribe());
  }
}
