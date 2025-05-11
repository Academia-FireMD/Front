import { Location } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom } from 'rxjs';
import { Modulo, ModuloDto, ModuloService } from '../../../shared/services/modulo.service';

@Component({
  selector: 'app-modulo-detailview',
  templateUrl: './modulo-detailview.component.html',
})
export class ModuloDetailviewComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private service = inject(ModuloService);
  private toast = inject(ToastrService);
  private location = inject(Location);
  private lastLoadedModulo!: Modulo;

  moduloForm: FormGroup;
  isNew = true;
  loading = false;

  constructor() {
    this.moduloForm = this.fb.group({
      nombre: ['', [Validators.required]],
      descripcion: [''],
      esPublico: [true]
    });
  }

  async ngOnInit() {
    const id = this.route.snapshot.params['id'];
    if (id !== 'new') {
      this.isNew = false;
      await this.cargarModulo(Number(id));
    }
  }

  private async cargarModulo(id: number) {
    try {
      this.loading = true;
      const modulo = await firstValueFrom(this.service.getModulo$(id));
      this.moduloForm.patchValue(modulo);
      this.lastLoadedModulo = modulo;
    } catch (error) {
      console.error('Error al cargar el módulo:', error);
      this.toast.error('Error al cargar el módulo');
    } finally {
      this.loading = false;
    }
  }

  async guardar() {
    if (this.moduloForm.invalid) {
      this.toast.error('Por favor, completa todos los campos requeridos');
      return;
    }

    try {
      this.loading = true;
      const merged = {
        ...this.lastLoadedModulo,
        ...this.moduloForm.getRawValue(),
      };
      const moduloDto: ModuloDto = merged as ModuloDto;
      await firstValueFrom(this.service.updateModulo$(moduloDto));

      this.toast.success(
        this.isNew ? 'Módulo creado correctamente' : 'Módulo actualizado correctamente'
      );
      this.router.navigate(['/app/test/modulos']);
    } catch (error) {
      console.error('Error al guardar el módulo:', error);
      this.toast.error('Error al guardar el módulo');
    } finally {
      this.loading = false;
    }
  }

  public getId() {
    return this.route.snapshot.paramMap.get('id') as string | 'new';
  }

  public goBack() {
    return this.route.snapshot.queryParamMap.get('goBack') === 'true';
  }

  public handleBackButton() {
    if (this.goBack()) {
      this.location.back();
    } else {
      this.router.navigate(['/app/test/modulos']);
    }
  }
}
