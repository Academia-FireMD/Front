import { Component, inject, Input } from '@angular/core';
import { FormControl } from '@angular/forms';
import { map, tap } from 'rxjs';
import { TemaService } from '../../services/tema.service';
import { groupedTemas } from '../../utils/utils';

@Component({
  selector: 'app-tema-select',
  templateUrl: './tema-select.component.html',
  styleUrl: './tema-select.component.scss',
})
export class TemaSelectComponent {
  @Input() formControl!: FormControl;
  temaService = inject(TemaService);
  public getAllTemas$ = this.temaService.getAllTemas$().pipe(
    map((temas) => groupedTemas(temas)),
    tap((e) => (this.lastLoadedTemas = e))
  );
  private lastLoadedTemas: Array<any> = [];
  public filterQuery = '';

  filteredTemas(temas: Array<any>) {
    return temas
      .map((group) => {
        const items = group.items.filter((i: any) =>
          i.label.toLowerCase().includes(this.filterQuery)
        );
        return { ...group, items };
      })
      .filter((g) => g.items.length > 0);
  }

  filterLocal(event: Event) {
    const query = (event.target as HTMLInputElement).value.toLowerCase();
    this.filterQuery = query;
  }

  get allSelected(): boolean {
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
    const allValues = this.lastLoadedTemas.flatMap((g) =>
      g.items.map((i: any) => i.value)
    );
    const newValues = checked ? allValues : [];
    this.formControl?.setValue(newValues as any);
    this.formControl?.updateValueAndValidity();
  }

  isGroupSelected(groupItems: { value: any }[]): boolean {
    const selectedValues = (this.formControl?.value ?? []) as Array<string>;
    return groupItems.every((item: any) =>
      selectedValues?.includes(item.value)
    );
  }

  onSelectGroup(checked: boolean, groupItems: { value: any }[]) {
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
}
