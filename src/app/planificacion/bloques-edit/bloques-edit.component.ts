import { Location } from '@angular/common';
import { Component, inject, ViewChild } from '@angular/core';
import { FormArray, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { cloneDeep, uniqueId } from 'lodash';
import { ToastrService } from 'ngx-toastr';
import { OrderList } from 'primeng/orderlist';
import { firstValueFrom, map, tap } from 'rxjs';
import { PlanificacionesService } from '../../services/planificaciones.service';
import { TemaService } from '../../services/tema.service';
import {
  PlanificacionBloque,
  SubBloque,
} from '../../shared/models/planificacion.model';
import { groupedTemas } from '../../utils/utils';
@Component({
  selector: 'app-bloques-edit',
  templateUrl: './bloques-edit.component.html',
  styleUrl: './bloques-edit.component.scss',
})
export class BloquesEditComponent {
  location = inject(Location);
  activedRoute = inject(ActivatedRoute);
  planificacionesService = inject(PlanificacionesService);
  temaService = inject(TemaService);
  fb = inject(FormBuilder);
  toast = inject(ToastrService);
  router = inject(Router);
  @ViewChild(OrderList) orderList!: OrderList;
  private editingIndex = 0;

  public checked = {};
  public getAllTemas$ = this.temaService.getAllTemas$().pipe(
    map((temas) => {
      return groupedTemas(temas);
    })
  );

  public goBack() {
    return this.activedRoute.snapshot.queryParamMap.get('goBack') === 'true';
  }

  formGroup = this.fb.group({
    identificador: ['', Validators.required],
    descripcion: ['', Validators.required],
    subBloques: this.fb.array([]),
  });

  public get subBloques() {
    return this.formGroup.get('subBloques') as any;
  }

  dragIndex: number | null = null;

  public lastLoaded!: PlanificacionBloque;
  public isDialogVisible: boolean = false;
  public editSubBloqueData!: SubBloque;

  ngOnInit(): void {
    this.load();
  }

  public agregarSubBloque() {
    this.subBloques.push(this.getEmptySubBloqueForm());
    setTimeout(() => {
      this.editarSubBloque(this.subBloques.value.length - 1);
    }, 0);
  }

  private getEmptySubBloqueForm() {
    return this.fb.group({
      id: [null],
      duracion: [60, [Validators.required, Validators.min(1)]],
      nombre: ['', [Validators.required]],
      comentarios: [''],
      color: [''],
      siendoEditado: [false],
      controlId: [uniqueId()],
      importante: [false],
      tiempoAviso: [0]
    });
  }

  public getId() {
    return this.activedRoute.snapshot.paramMap.get('id') as number | 'new';
  }

  public guardarSubBloque(index: number) {
    this.subBloques.at(index).get('siendoEditado').patchValue(false);
  }

  public editarSubBloque(index: number) {
    const subBloque = this.subBloques.at(index);
    this.editingIndex = index;
    this.openDialog(subBloque.value);
  }

  private openDialog(data: SubBloque) {
    this.editSubBloqueData = data;
    this.isDialogVisible = true;
  }

  public savedSubbloqueDialog(data: SubBloque) {
    this.subBloques.at(this.editingIndex).patchValue(data);
    this.editingIndex = -1;
  }

  public clonarSubbloque(subBloque: SubBloque, index: number) {
    let subBloqueAClonar = cloneDeep(subBloque);
    const form = this.getEmptySubBloqueForm();
    subBloqueAClonar.id = null;
    form.patchValue(subBloqueAClonar);
    (this.subBloques as FormArray).insert(index, form);
  }

  public eliminarSubBloque(index: number) {
    this.subBloques.removeAt(index);
  }

  private load() {
    const itemId = this.getId();
    if (itemId === 'new') {
      this.formGroup.reset();
    } else {
      firstValueFrom(
        this.planificacionesService.getBloqueById(itemId).pipe(
          tap((entry) => {
            this.subBloques.clear();
            this.lastLoaded = entry;
            this.lastLoaded.subBloques.forEach((subBloque) => {
              const form = this.getEmptySubBloqueForm();
              form.patchValue(subBloque);
              this.subBloques.push(form);
            });
            this.formGroup.patchValue(entry);
            this.formGroup.markAsPristine();
          })
        )
      );
    }
  }

  private async update() {
    const order = cloneDeep(this.subBloques.value.map((e: any) => e.controlId));
    const merged = cloneDeep({
      ...this.lastLoaded,
      ...this.formGroup.getRawValue(),
    });

    merged.subBloques.sort((a: any, b: any) => {
      return order.indexOf(a.controlId) - order.indexOf(b.controlId);
    });

    merged.subBloques.forEach((e: any) => {
      if (!e['id']) delete e['id'];
      delete e['siendoEditado'];
      delete e['controlId'];
    });

    const updated = await firstValueFrom(
      this.planificacionesService.updateBloque$(merged as PlanificacionBloque)
    );
    return updated;
  }

  public async actualizar() {
    await this.update();
    this.toast.success('Bloque actualizado con éxito!', 'Guardado exitoso');
    this.load();
  }

  public async crear() {
    const res = await this.update();
    this.toast.success('Bloque creado con éxito!', 'Creación exitosa');
    await this.router.navigate(['app/planificacion/bloques/' + res.id]);
    this.load();
  }

  public handleBackButton() {
    if (this.goBack()) {
      this.location.back();
    } else {
      this.router.navigate(['/app/planificacion/bloques']);
    }
  }
}
