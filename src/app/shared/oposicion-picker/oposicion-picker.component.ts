import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import {
  GrupoOposicion,
  gruposOposicion,
  oposiciones,
} from '../../utils/consts';
import { Oposicion } from '../models/subscription.model';

/**
 * Opción del listbox / badge. Puede ser una oposición individual (sin `members`)
 * o un grupo agrupador (con `members`, azúcar de UI). El `code` de un grupo es un
 * marcador sintético — jamás se emite hacia fuera.
 */
export interface PickerOption {
  label: string;
  code: string;
  icon: string;
  image: string | null;
  members?: Oposicion[];
}

@Component({
  selector: 'app-oposicion-picker',
  templateUrl: './oposicion-picker.component.html',
  styleUrl: './oposicion-picker.component.scss',
})
export class OposicionPickerComponent implements OnChanges, OnInit {
  @Input() oposiciones: Array<Oposicion> = [];
  @Input() allowAdd = false;
  @Input() multiple = true;
  // La firma pública NO cambia: siempre se emite Oposicion[] reales (nunca el grupo sintético).
  @Output() updateSelection = new EventEmitter<Oposicion[]>();

  public map = oposiciones;

  /** Fuente de verdad interna: oposiciones reales seleccionadas (valores de enum). */
  private selected: Oposicion[] = [];
  /** Grupo agrupador que se muestra ACTIVO (azúcar de UI, no persiste). null = modo individual. */
  private grupoActivoRef: GrupoOposicion | null = null;

  // Vistas MEMOIZADAS para el template. NUNCA usar getters que reconstruyan estos
  // arrays/objetos en cada ciclo de detección de cambios: al enlazarse a
  // `[ngModel]`/`[options]` de un p-listbox, una nueva referencia por tick
  // re-dispara CD en bucle y cuelga el hilo (Chromium se cae). Se recalculan solo
  // cuando cambia el estado real (ngOnChanges / onSelectionChange).
  public listboxOptions: PickerOption[] = [];
  public listboxValue: PickerOption[] | PickerOption | null = null;
  public displayItems: PickerOption[] = [];
  /** true si la agrupadora se muestra activa (para template). */
  public grupoActivo = false;

  ngOnInit(): void {
    // Estado inicial memoizado (por si no llega ningún ngOnChanges con inputs).
    this.syncFromInput(this.oposiciones ?? []);
    this.recompute();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['oposiciones']) {
      this.syncFromInput(this.oposiciones ?? []);
    }
    if (changes['multiple'] && !this.multiple) {
      // En modo simple la agrupadora no aplica: degradar a individual.
      this.grupoActivoRef = null;
    }
    this.recompute();
  }

  /** Recalcula las vistas memoizadas desde el estado interno. Referencias estables. */
  private recompute(): void {
    const grupos = this.multiple
      ? gruposOposicion.map((g) => this.toGrupoOption(g))
      : [];
    const individuales = Object.values(Oposicion).map((op) =>
      this.toIndividualOption(op),
    );
    this.listboxOptions = [...grupos, ...individuales];

    this.grupoActivo = !!this.grupoActivoRef;

    if (!this.multiple) {
      const op = this.selected[0];
      const single = op ? this.toIndividualOption(op) : null;
      this.listboxValue = single;
      this.displayItems = single ? [single] : [];
      return;
    }
    if (this.grupoActivoRef) {
      const chip = [this.toGrupoOption(this.grupoActivoRef)];
      this.listboxValue = chip;
      this.displayItems = chip;
      return;
    }
    const items = this.selected.map((op) => this.toIndividualOption(op));
    this.listboxValue = items;
    this.displayItems = items;
  }

  /**
   * Reacciona a un cambio de selección del listbox. `value` es lo que emite PrimeNG:
   * un array de opciones (multiple) o una única opción / null (simple).
   */
  onSelectionChange(value: PickerOption[] | PickerOption | null): void {
    if (!this.multiple) {
      const op = value as PickerOption | null;
      this.selected = op && !op.members ? [op.code as Oposicion] : [];
      this.grupoActivoRef = null;
      this.emit();
      return;
    }

    const seleccion = (value as PickerOption[]) ?? [];
    const grupoOpt = seleccion.find((o) => !!o.members) ?? null;
    const individuales = seleccion.filter((o) => !o.members);
    const grupoEstabaActivo = !!this.grupoActivoRef;

    if (grupoOpt && !grupoEstabaActivo) {
      // ACTIVACIÓN: el usuario acaba de marcar la agrupadora.
      // Marca sus miembros, desmarca GENERAL, conserva otras individuales ajenas (p.ej. Madrid).
      const set = new Set<Oposicion>(
        individuales.map((o) => o.code as Oposicion),
      );
      set.delete(Oposicion.GENERAL);
      grupoOpt.members!.forEach((m) => set.add(m));
      this.selected = [...set];
      // Solo se pinta agrupado si el resultado es EXACTAMENTE el par del grupo.
      this.grupoActivoRef = this.findGrupoExacto(this.selected);
    } else if (grupoOpt && grupoEstabaActivo && individuales.length > 0) {
      // El grupo estaba activo y el usuario tocó una individual → ROMPER agrupación.
      const set = new Set<Oposicion>(grupoOpt.members!);
      individuales.forEach((o) => set.add(o.code as Oposicion));
      this.selected = [...set];
      this.grupoActivoRef = null;
    } else if (grupoOpt) {
      // El grupo sigue como único seleccionado → permanece agrupado.
      this.selected = [...grupoOpt.members!];
      this.grupoActivoRef = this.findGrupoExacto(this.selected);
    } else {
      // Sin grupo en la selección → modo individual puro (no se auto-agrupa al editar a mano).
      this.selected = individuales.map((o) => o.code as Oposicion);
      this.grupoActivoRef = null;
    }
    this.emit();
  }

  private emit(): void {
    // Recalcular las vistas memoizadas ANTES de emitir, para que el template
    // refleje el nuevo estado sin depender de getters por-tick.
    this.recompute();
    this.updateSelection.emit([...this.selected]);
  }

  /**
   * Reconcilia el estado interno con el @Input. Si el input coincide (como conjunto)
   * con lo que ya teníamos, es un write-back del padre tras nuestra emisión: conservamos
   * el modo (agrupado/individual) que el usuario acaba de elegir. Si difiere, es una carga
   * externa genuina y recomputamos si toca agrupar.
   */
  private syncFromInput(input: Oposicion[]): void {
    if (this.sameSet(input, this.selected)) return;
    this.selected = [...input];
    this.grupoActivoRef = this.multiple ? this.findGrupoExacto(input) : null;
  }

  /** Grupo cuyos miembros coinciden EXACTAMENTE (como conjunto) con `input`, o null. */
  private findGrupoExacto(input: Oposicion[]): GrupoOposicion | null {
    return gruposOposicion.find((g) => this.sameSet(g.members, input)) ?? null;
  }

  private sameSet(a: Oposicion[], b: Oposicion[]): boolean {
    if (a.length !== b.length) return false;
    const setB = new Set(b);
    return a.every((x) => setB.has(x));
  }

  private toIndividualOption(op: Oposicion): PickerOption {
    return {
      label: this.map[op]?.name || op,
      code: op,
      icon: this.map[op]?.icon || '📋',
      image: this.map[op]?.image || null,
    };
  }

  private toGrupoOption(g: GrupoOposicion): PickerOption {
    return {
      label: g.name,
      code: g.code,
      icon: g.icon,
      image: g.image,
      members: g.members,
    };
  }
}
