import { Component, ViewChild, inject, Input, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { map, tap, Subscription } from 'rxjs';
import { TemaService } from '../../services/tema.service';
import { groupedTemas } from '../../utils/utils';
import { OverlayPanel } from 'primeng/overlaypanel';

@Component({
  selector: 'app-tema-select',
  templateUrl: './tema-select.component.html',
  styleUrl: './tema-select.component.scss',
})
export class TemaSelectComponent implements OnInit, OnDestroy {
  @Input() formControl!: FormControl;
  @Input() multiple: boolean = true;
  @ViewChild('op') overlayPanel!: OverlayPanel;
  private subs = new Subscription();

  temaService = inject(TemaService);
  public collapsedGroups = new Map<string, boolean>();

  private gruposOriginal: Array<any> = [];
  public grupos: Array<any> = [];
  private lastLoadedTemas: Array<any> = [];
  public filterQuery = '';

  ngOnInit() {
    const s = this.temaService
      .getAllTemas$()
      .pipe(map((temas) => groupedTemas(temas)))
      .subscribe((groups) => {
        this.gruposOriginal = groups;
        this.grupos = groups;
        this.lastLoadedTemas = groups;
        groups.forEach((g) => {
          if (!this.collapsedGroups.has(g.label)) this.collapsedGroups.set(g.label, false);
        });
      });
    this.subs.add(s);
  }

  ngOnDestroy() {
    this.subs.unsubscribe();
  }

  togglePanel(event: Event) {
    this.overlayPanel?.toggle(event);
  }

  private getAllValues(): any[] {
    return this.lastLoadedTemas.flatMap((g) => g.items.map((i: any) => i.value));
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
          : group.items.filter((i: any) => (i.label ?? '').toLowerCase().includes(q));
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
      g.items.map((i: any) => i.value)
    );
    return (
      allValues.length > 0 && allValues.every((val) => selected.includes(val))
    );
  }

  onSelectAll(checked: boolean) {
    if (!this.multiple) return;
    const allValues = this.lastLoadedTemas.flatMap((g) =>
      g.items.map((i: any) => i.value)
    );
    const newValues = checked ? allValues : [];
    this.formControl?.setValue(newValues as any);
    this.formControl?.updateValueAndValidity();
  }

  isGroupSelected(groupItems: { value: any }[]): boolean {
    if (!this.multiple) return false;
    const selectedValues = (this.formControl?.value ?? []) as Array<string>;
    return groupItems.every((item: any) => selectedValues?.includes(item.value));
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
        (val) => !groupItems.some((item) => item.value === val)
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
