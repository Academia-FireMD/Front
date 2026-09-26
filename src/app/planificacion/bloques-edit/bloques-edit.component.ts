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
      catalogoContenidoId: [null as number | null],
      tipoTrabajoPlanificacion: [null as SubBloque['tipoTrabajoPlanificacion']],
      duracion: [60, [Validators.required, Validators.min(1)]],
      nombre: ['', [Validators.required]],
      comentarios: [''],
      color: [''],
      siendoEditado: [false],
      controlId: [uniqueId()],
      importante: [false],
      tiempoAviso: [0],
      esEntrenamientoFisico: [false],
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
    delete (subBloqueAClonar as SubBloque & { controlId?: string }).controlId;
    form.patchValue(subBloqueAClonar);
    (this.subBloques as FormArray).insert(index, form);
  }

  public eliminarSubBloque(index: number) {
    this.subBloques.removeAt(index);
  }

  public reordenarSubBloques(event: { value?: Array<{ controlId: string }> }) {
    const orden = event.value?.map((item) => item.controlId) ?? [];
    if (orden.length !== this.subBloques.length) return;
    const controles = new Map(
      this.subBloques.controls.map((control: any) => [
        control.value.controlId,
        control,
      ]),
    );
    const ordenados = orden.map((id) => controles.get(id));
    if (ordenados.some((control) => !control)) return;
    this.subBloques.clear();
    ordenados.forEach((control) => this.subBloques.push(control));
    this.formGroup.markAsDirty();
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
          }),
        ),
      );
    }
  }

  private async update() {
    const merged = cloneDeep({
      ...this.lastLoaded,
      ...this.formGroup.getRawValue(),
    });
    merged.subBloques.forEach((e: any, orden: number) => {
      if (!e['id']) delete e['id'];
      e.ordenBloque = orden;
      delete e['siendoEditado'];
      delete e['controlId'];
    });

    const updated = await firstValueFrom(
      this.planificacionesService.updateBloque$(merged as PlanificacionBloque),
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
