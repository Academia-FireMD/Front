import { Location } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom, tap } from 'rxjs';
import { TemaService } from '../../../services/tema.service';
import { Tema } from '../../../shared/models/pregunta.model';

@Component({
  selector: 'app-tema-detailview',
  templateUrl: './tema-detailview.component.html',
  styleUrls: ['./tema-detailview.component.scss'],
})
export class TemaDetailviewComponent {
  location = inject(Location);
  activedRoute = inject(ActivatedRoute);
  temaService = inject(TemaService);
  fb = inject(FormBuilder);
  toast = inject(ToastrService);
  router = inject(Router);
  private lastLoadedTema!: Tema;

  formGroup = this.fb.group({
    numero: [1, Validators.required],
    descripcion: ['', Validators.required],
    categoria: ['', Validators.required],
  });

  ngOnInit(): void {
    this.loadTema();
  }

  public getId() {
    return this.activedRoute.snapshot.paramMap.get('id') as string | 'new';
  }

  public goBack() {
    return this.activedRoute.snapshot.queryParamMap.get('goBack') === 'true';
  }

  public handleBackButton() {
    if (this.goBack()) {
      this.location.back();
    } else {
      this.router.navigate(['/app/test/tema']);
    }
  }

  private loadTema() {
    const itemId = this.getId();
    if (itemId === 'new') {
      this.formGroup.reset();
    } else {
      firstValueFrom(
        this.temaService.getTema$(+itemId).pipe(
          tap((entry) => {
            this.lastLoadedTema = entry;
            this.formGroup.patchValue(entry);
            this.formGroup.markAsPristine();
          })
        )
      );
    }
  }

  private async updateTema() {
    const merged = {
      ...this.lastLoadedTema,
      ...this.formGroup.getRawValue(),
    };
    const result = await firstValueFrom(
      this.temaService.updateTema$(merged as Tema)
    );
    return result;
  }

  public async actualizarTema() {
    await this.updateTema();
    this.toast.success('Tema actualizado con éxito!', 'Guardado exitoso');
    this.loadTema();
  }

  public async crearTema() {
    const res = await this.updateTema();
    this.toast.success('Tema creado con éxito!', 'Creación exitosa');
    await this.router.navigate(['app/test/tema/' + res.id]);
    this.loadTema();
  }
}
