import { Component, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom } from 'rxjs';
import { FactorsService } from '../../../services/factors.service';
import { FactorName } from '../../../shared/models/factor.model';

@Component({
  selector: 'app-ajustes-admin',
  templateUrl: './ajustes-admin.component.html',
  styleUrl: './ajustes-admin.component.scss',
})
export class AjustesAdminComponent {
  private fb = inject(FormBuilder);
  private factorsService = inject(FactorsService);
  toast = inject(ToastrService);
  getFactor$ = this.factorsService.getFactors$();
  public factors = this.fb.group({
    preguntasFallidasPivote: [0, Validators.required],
  });
  ngOnInit(): void {
    this.getFactor$.subscribe((factors) => {
      if (!factors || factors.length == 0) return;
      this.factors.patchValue({
        preguntasFallidasPivote: factors[0].value ?? 0,
      });
    });
  }
  public async actualizarAjustes() {
    await firstValueFrom(
      this.factorsService.updateFactor$({
        name: FactorName.PREGUNTAS_MALAS_PIVOT,
        value: this.factors.value.preguntasFallidasPivote ?? 0,
      })
    );
    this.toast.success('Ajustes actualizados exitosamente!');
  }
}