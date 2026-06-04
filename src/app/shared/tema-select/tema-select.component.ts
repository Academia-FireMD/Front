import {
  Component,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { OverlayPanel } from 'primeng/overlaypanel';
import { map, Subscription } from 'rxjs';
import { TemaService } from '../../services/tema.service';
import { Tema } from '../models/pregunta.model';
import { Oposicion } from '../models/subscription.model';
import { groupedTemas } from '../../utils/utils';

@Component({
  selector: 'app-tema-select',
  templateUrl: './tema-select.component.html',
  styleUrl: './tema-select.component.scss',
})
export class TemaSelectComponent implements OnInit, OnChanges, OnDestroy {
  @Input() formControl!: FormControl;
  @Input() multiple: boolean = true;
  /**
   * Refactor 2026-05-25 (T11.1 / D6): filtra los temas a los que aparecen en
   * un Modulo cuya `relevancia` incluye esta oposición. `null`, `undefined` o
   * `Oposicion.GENERAL` desactivan el filtro (muestra todos). El filtrado es
   * client-side sobre el dataset que `getAllTemas$()` ya devuelve (sin nuevo
   * endpoint backend).
   */
  @Input() oposicion: Oposicion | null = null;
  @ViewChild('op') overlayPanel!: OverlayPanel;
  private subs = new Subscription();

  temaService = inject(TemaService);
  public collapsedGroups = new Map<string, boolean>();

  /** Temas crudos antes del groupedTemas, para poder re-filtrar por oposición. */
  private temasOriginales: Tema[] = [];
  private gruposOriginal: Array<any> = [];
  public grupos: Array<any> = [];
  private lastLoadedTemas: Array<any> = [];
  public filterQuery = '';

  ngOnInit() {
    const s = this.temaService.getAllTemas$().subscribe((temas) => {
      this.temasOriginales = temas;
      this.rebuildGroups();
    });
    this.subs.add(s);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['oposicion'] && !changes['oposicion'].firstChange) {
      this.rebuildGroups();
    }
  }

  private rebuildGroups(): void {
    const filtered = this.filterByOposicion(this.temasOriginales);
    const groups = groupedTemas(filtered);
    this.gruposOriginal = groups;
    this.grupos = groups;
    this.lastLoadedTemas = groups;
    groups.forEach((g) => {
      if (!this.collapsedGroups.has(g.label))
        this.collapsedGroups.set(g.label, true);
    });
    // Reaplica el filtro de búsqueda activo si lo hubiera.
    this.recompute();
  }

  private filterByOposicion(temas: Tema[]): Tema[] {
    const op = this.oposicion;
    if (!op || op === Oposicion.GENERAL) return temas;
    return temas.filter((t) => {
      const relevancia = t.modulo?.relevancia;
      if (!relevancia || relevancia.length === 0) return true; // sin restricción → mostrar
      return relevancia.includes(op);
    });
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
  }

  togglePanel(event: Event) {
    this.overlayPanel?.toggle(event);
  }

  private getAllValues(): any[] {
    return this.lastLoadedTemas.flatMap((g) =>
      g.items.map((i: any) => i.value),
    );
  }

  private isValidSingleSelection(value: any): boolean {
    if (value === null || value === undefined) return false;
    const allValues = this.getAllValues();
    return allValues.includes(value);
  }

  selectedCount(): number {
    const value = this.formControl?.value;
    if (this.multiple) {
      return (value ?? []).length;
    }
    return this.isValidSingleSelection(value) ? 1 : 0;
  }

  visibleChips(): string[] {
    if (this.multiple) {
      const selectedValues = (this.formControl?.value ?? []) as number[];
      const labels: string[] = [];
      for (const group of this.lastLoadedTemas) {
        for (const item of group.items) {
          if (selectedValues.includes(item.value)) labels.push(item.label);
          if (labels.length >= 2) return labels; // show first 2
        }
      }
      return labels;
    }
    const selectedValue = this.formControl?.value as number | null | undefined;
    if (!this.isValidSingleSelection(selectedValue)) return [];
    for (const group of this.lastLoadedTemas) {
      for (const item of group.items) {
        if (item.value === selectedValue) return [item.label];
      }
    }
    return [];
  }

  isSelected(value: any): boolean {
    const selected = this.formControl?.value;
    if (this.multiple) {
      const arr = (selected ?? []) as any[];
      return arr.includes(value);
    }
    return selected === value;
  }

  private recompute() {
    const q = this.filterQuery.trim().toLowerCase();
    if (!q) {
      this.grupos = this.gruposOriginal;
      return;
    }

    this.grupos = this.gruposOriginal
      .map((group) => {
        const groupMatches = (group.label ?? '').toLowerCase().includes(q);
        const items = groupMatches
          ? group.items
          : group.items.filter((i: any) =>
              (i.label ?? '').toLowerCase().includes(q),
            );
        return { ...group, items };
      })
      .filter((g) => g.items.length > 0);
  }

  filterLocal(event: Event) {
    const query = (event.target as HTMLInputElement).value.toLowerCase();
    this.filterQuery = query;
    this.recompute();
  }

  get allSelected(): boolean {
    if (!this.multiple) return false;
    const selected = (this.formControl?.value ?? []) as any[];
    if (!selected) return false;

    const allValues = this.lastLoadedTemas.flatMap((g) =>
      g.items.map((i: any) => i.value),
    );
    return (
      allValues.length > 0 && allValues.every((val) => selected.includes(val))
    );
  }

  onSelectAll(checked: boolean) {
    if (!this.multiple) return;
    const allValues = this.lastLoadedTemas.flatMap((g) =>
      g.items.map((i: any) => i.value),
    );
    const newValues = checked ? allValues : [];
    this.formControl?.setValue(newValues as any);
    this.formControl?.updateValueAndValidity();
  }

  isGroupSelected(groupItems: { value: any }[]): boolean {
    if (!this.multiple) return false;
    const selectedValues = (this.formControl?.value ?? []) as Array<string>;
    return groupItems.every((item: any) =>
      selectedValues?.includes(item.value),
    );
  }

  onSelectGroup(checked: boolean, groupItems: { value: any }[]) {
    if (!this.multiple) {
      // For single select, only act when a single item is toggled
      if (groupItems.length === 1) {
        const item = groupItems[0];
        const newValue = checked ? item.value : null;
        this.formControl?.setValue(newValue as any);
        this.formControl?.updateValueAndValidity();
        // Close after single selection
        if (checked) this.overlayPanel?.hide();
      }
      return;
    }

    let selected = (this.formControl?.value ?? []) as Array<string>;

    if (checked) {
      groupItems.forEach((item) => {
        if (!selected.includes(item.value)) {
          selected.push(item.value);
        }
      });
    } else {
      selected = selected.filter(
        (val) => !groupItems.some((item) => item.value === val),
      );
    }

    this.formControl?.setValue(selected as any);
    this.formControl?.updateValueAndValidity();
  }

  toggleGroup(label: string) {
    this.collapsedGroups.set(label, !this.isGroupCollapsed(label));
  }

  isGroupCollapsed(label: string): boolean {
    return this.collapsedGroups.get(label) ?? false;
  }

  trackGroup = (_: number, g: any) => g.label;
  trackItem = (_: number, i: any) => i.value;
}
