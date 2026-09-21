import {
  Component,
  EventEmitter,
  forwardRef,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR,
} from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { ListboxModule } from 'primeng/listbox';
import { OverlayPanel, OverlayPanelModule } from 'primeng/overlaypanel';
import { TooltipModule } from 'primeng/tooltip';
import {
  ARBOL_OPOSICIONES,
  colapsarOposiciones,
  GrupoOposicion,
  gruposOposicion,
  NodoOposicion,
  oposiciones,
  OPOSICION_WILDCARD,
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
  enabledMembers?: Oposicion[];
  disabled?: boolean;
  disabledReason?: string;
  /** Nivel de indentación en el árbol: 0=raíz (GENERAL), 1=comunidad, 2=provincia. */
  nivel?: number;
}

export interface OposicionPickerOption {
  value: Oposicion;
  disabled?: boolean;
  disabledReason?: string;
}

@Component({
  selector: 'app-oposicion-picker',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    DropdownModule,
    ListboxModule,
    OverlayPanelModule,
    TooltipModule,
  ],
  templateUrl: './oposicion-picker.component.html',
  styleUrl: './oposicion-picker.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => OposicionPickerComponent),
      multi: true,
    },
  ],
})
export class OposicionPickerComponent
  implements OnChanges, OnInit, ControlValueAccessor
{
  @Input() oposiciones: Array<Oposicion> = [];
  @Input() allowAdd = false;
  @Input() multiple = true;
  @Input() presentation: 'compact' | 'field' = 'compact';
  @Input() opciones?: OposicionPickerOption[];
  @Input() inputId = 'oposicion-picker';
  @Input() placeholder = 'Selecciona oposición';
  @Input() invalid = false;
  @Input() disabled = false;
  /** Etiquetas opcionales por contexto; por defecto conserva el copy histórico. */
  @Input() labelMap?: Partial<Record<Oposicion, string>>;
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
  public overlayOpen = false;

  private onChange: (value: Oposicion | Oposicion[] | null) => void = () =>
    undefined;
  private onTouched: () => void = () => undefined;

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
    if (changes['opciones']) {
      this.selected = this.normalizarSeleccion(this.selected);
    }
    this.recompute();
  }

  writeValue(value: Oposicion | Oposicion[] | null): void {
    const values = value == null ? [] : Array.isArray(value) ? value : [value];
    this.selected = this.normalizarSeleccion(values);
    this.grupoActivoRef = this.multiple
      ? this.findGrupoExacto(this.selected)
      : null;
    this.recompute();
  }

  registerOnChange(fn: (value: Oposicion | Oposicion[] | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  /** Recalcula las vistas memoizadas desde el estado interno. Referencias estables. */
  private recompute(): void {
    // Opciones del listbox = el ÁRBOL de oposiciones (dos niveles bajo GENERAL):
    //   Todas las oposiciones (raíz) · Comunidad de Madrid (hoja) · Comunidad
    //   Valenciana (grupo) → Valencia / Alicante (provincias, indentadas).
    // En modo simple no hay árbol: lista plana de oposiciones reales.
    this.listboxOptions = this.multiple
      ? ARBOL_OPOSICIONES.map((n) => this.nodoToOption(n)).filter(
          (option): option is PickerOption => option !== null,
        )
      : this.valoresVisibles().map((op) => this.toIndividualOption(op));

    this.grupoActivo = !!this.grupoActivoRef;

    // listboxValue = qué se MARCA en el dropdown (depende del estado):
    //  - modo simple: la opción única
    //  - comodín GENERAL activo (exclusivo): solo GENERAL
    //  - grupo activo: el padre + sus dos hijas resaltados
    //  - resto: las individuales
    if (!this.multiple) {
      const op = this.selected[0];
      this.listboxValue = op ? this.toIndividualOption(op) : null;
    } else if (this.esWildcardActivo()) {
      this.listboxValue = [this.toIndividualOption(OPOSICION_WILDCARD)];
    } else if (this.grupoActivoRef) {
      const parent = this.toGrupoOption(this.grupoActivoRef);
      const memberOpts = this.grupoActivoRef.members.map((m) =>
        this.toIndividualOption(m),
      );
      this.listboxValue = [parent, ...memberOpts];
    } else {
      this.listboxValue = this.selected.map((op) =>
        this.toIndividualOption(op),
      );
    }

    // displayItems = badges RESUMEN. Usa la MISMA lógica de colapso compartida
    // (colapsarOposiciones) que las tarjetas/overviews → consistencia garantizada:
    // Valencia + Alicante se muestran como un solo badge "Comunidad Valenciana".
    this.displayItems = colapsarOposiciones(this.selected, {
      labels: this.labelMap,
    });
  }

  /** ¿Está seleccionado solo el comodín GENERAL ("todas las oposiciones")? */
  private esWildcardActivo(): boolean {
    return (
      this.selected.length === 1 && this.selected[0] === OPOSICION_WILDCARD
    );
  }

  private nodoToOption(n: NodoOposicion): PickerOption | null {
    if (n.tipo !== 'GRUPO' && !this.esVisible(n.code as Oposicion)) {
      return null;
    }
    const members = n.members?.filter((member) => this.esVisible(member));
    if (n.tipo === 'GRUPO' && !members?.length) return null;
    const enabledMembers = members?.filter((member) =>
      this.estaHabilitada(member),
    );
    return {
      label:
        n.tipo === 'GRUPO'
          ? n.label
          : (this.labelMap?.[n.code as Oposicion] ?? n.label),
      code: n.code,
      icon: n.icon,
      image: n.image,
      nivel: n.nivel,
      members,
      enabledMembers,
      disabled:
        n.tipo === 'GRUPO'
          ? enabledMembers?.length === 0
          : !this.estaHabilitada(n.code as Oposicion),
      disabledReason:
        n.tipo === 'GRUPO'
          ? enabledMembers?.length === 0
            ? 'No hay oposiciones disponibles en este grupo'
            : undefined
          : this.opcionConfigurada(n.code as Oposicion)?.disabledReason,
    };
  }

  /** Códigos actualmente marcados en el listbox (para diffear el cambio). */
  private listboxValueCodes(): string[] {
    const v = this.listboxValue;
    if (Array.isArray(v)) return v.map((o) => o.code);
    return v ? [v.code] : [];
  }

  /**
   * Reacciona a un cambio de selección del listbox. `value` es lo que emite PrimeNG:
   * un array de opciones (multiple) o una única opción / null (simple).
   */
  onSelectionChange(
    value: PickerOption[] | PickerOption | null,
    overlay?: OverlayPanel,
  ): void {
    if (this.disabled) return;
    if (!this.multiple) {
      const op = value as PickerOption | null;
      if (op?.disabled) {
        this.onTouched();
        return;
      }
      this.selected = op && !op.members ? [op.code as Oposicion] : [];
      this.grupoActivoRef = null;
      this.emit();
      overlay?.hide();
      return;
    }

    // p-listbox (multiple) normalmente alterna UNA opción por clic. Diffeamos la
    // nueva selección contra lo que estaba marcado (padre + hijas cuando el grupo
    // está activo) para distinguir "clic en el padre" de "clic/quitar una hija".
    // Robusto al orden y a eventos multi-cambio (p.ej. limpiar todo → []).
    const nextOpts = ((value as PickerOption[]) ?? []).filter(
      (option) => !option.disabled,
    );
    const prevCodes = new Set(this.listboxValueCodes());
    const nextCodes = new Set(nextOpts.map((o) => o.code));
    const added = [...nextCodes].filter((c) => !prevCodes.has(c));
    const removed = [...prevCodes].filter((c) => !nextCodes.has(c));

    const wildcardAdded = added.includes(OPOSICION_WILDCARD);
    const wildcardRemoved = removed.includes(OPOSICION_WILDCARD);
    const grupoAdded = gruposOposicion.find((g) => added.includes(g.code));
    const grupoRemoved = gruposOposicion.find((g) => removed.includes(g.code));
    const esGrupo = (c: string) => gruposOposicion.some((g) => g.code === c);
    const esWildcard = (c: string) => c === OPOSICION_WILDCARD;

    if (wildcardAdded) {
      // GENERAL ("todas las oposiciones") es EXCLUSIVO: al marcarlo, limpia el resto.
      this.selected = [OPOSICION_WILDCARD];
    } else if (wildcardRemoved && added.length === 0) {
      // Se deseleccionó GENERAL sin elegir otra cosa.
      this.selected = [];
    } else if (grupoAdded) {
      // Activar el padre: añade sus miembros, quita GENERAL, conserva otras sueltas.
      const set = new Set<Oposicion>(
        this.selected.filter(
          (op) => op !== OPOSICION_WILDCARD && !grupoAdded.members.includes(op),
        ),
      );
      (grupoAdded.members ?? [])
        .filter((member) => this.estaHabilitada(member))
        .forEach((m) => set.add(m));
      this.selected = [...set];
    } else if (grupoRemoved) {
      // Desmarcar el padre = quitar sus miembros de golpe (rompe/limpia el grupo).
      this.selected = this.selected.filter(
        (op) => !(grupoRemoved.members ?? []).includes(op),
      );
    } else {
      // Toggles de oposiciones individuales. Elegir una concreta quita GENERAL.
      const set = new Set<Oposicion>(
        this.selected.filter((op) => op !== OPOSICION_WILDCARD),
      );
      for (const c of added)
        if (!esGrupo(c) && !esWildcard(c)) set.add(c as Oposicion);
      for (const c of removed)
        if (!esGrupo(c) && !esWildcard(c)) set.delete(c as Oposicion);
      this.selected = [...set];
    }

    // Se pinta agrupado solo si el resultado coincide EXACTAMENTE con un grupo.
    this.grupoActivoRef = this.findGrupoExacto(this.selected);
    this.emit();
  }

  private emit(): void {
    // Recalcular las vistas memoizadas ANTES de emitir, para que el template
    // refleje el nuevo estado sin depender de getters por-tick.
    this.recompute();
    this.updateSelection.emit([...this.selected]);
    this.onChange(
      this.multiple ? [...this.selected] : (this.selected[0] ?? null),
    );
    this.onTouched();
  }

  marcarTocado(): void {
    this.overlayOpen = false;
    this.onTouched();
  }

  get fieldLabel(): string {
    if (!this.selected.length) return this.placeholder;
    if (!this.multiple) {
      return this.toIndividualOption(this.selected[0]).label;
    }
    if (this.displayItems.length === 1) return this.displayItems[0].label;
    return `${this.selected.length} oposiciones seleccionadas`;
  }

  /**
   * Reconcilia el estado interno con el @Input. Si el input coincide (como conjunto)
   * con lo que ya teníamos, es un write-back del padre tras nuestra emisión: conservamos
   * el modo (agrupado/individual) que el usuario acaba de elegir. Si difiere, es una carga
   * externa genuina y recomputamos si toca agrupar.
   */
  private syncFromInput(input: Oposicion[]): void {
    const normalizada = this.normalizarSeleccion(input);
    if (this.sameSet(normalizada, this.selected)) return;
    this.selected = normalizada;
    this.grupoActivoRef = this.multiple
      ? this.findGrupoExacto(normalizada)
      : null;
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
    const configured = this.opcionConfigurada(op);
    return {
      label: this.labelMap?.[op] ?? this.map[op]?.name ?? op,
      code: op,
      icon: this.map[op]?.icon || '📋',
      image: this.map[op]?.image || null,
      disabled: configured?.disabled ?? false,
      disabledReason: configured?.disabledReason,
    };
  }

  private toGrupoOption(g: GrupoOposicion): PickerOption {
    return {
      label: g.name,
      code: g.code,
      icon: g.icon,
      image: g.image,
      members: g.members,
      enabledMembers: g.members.filter((member) => this.estaHabilitada(member)),
    };
  }

  private valoresVisibles(): Oposicion[] {
    const values = this.opciones?.map((option) => option.value);
    return this.opciones !== undefined
      ? (values ?? [])
      : Object.values(Oposicion);
  }

  private opcionConfigurada(
    oposicion: Oposicion,
  ): OposicionPickerOption | undefined {
    return this.opciones?.find((option) => option.value === oposicion);
  }

  private esVisible(oposicion: Oposicion): boolean {
    return (
      !this.opciones ||
      this.opciones.some((option) => option.value === oposicion)
    );
  }

  private estaHabilitada(oposicion: Oposicion): boolean {
    return (
      this.esVisible(oposicion) && !this.opcionConfigurada(oposicion)?.disabled
    );
  }

  private normalizarSeleccion(input: Oposicion[]): Oposicion[] {
    const unicas = [...new Set(input)].filter((oposicion) =>
      this.estaHabilitada(oposicion),
    );
    return this.multiple ? unicas : unicas.slice(0, 1);
  }
}
