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
    flashcardsMalPivote: [0, Validators.required],
    flashcardsRepasarPivote: [0, Validators.required],
    flashcardsBalanceNoRespondidas: [0, Validators.required],
    flashcardsBalanceMal: [0, Validators.required],
    flashcardsBalanceRevisar: [0, Validators.required],
    flashcardsBalanceBien: [0, Validators.required],
  });
  ngOnInit(): void {
    this.getFactor$.subscribe((factors) => {
      if (!factors || factors.length == 0) return;
      this.factors.patchValue({
        preguntasFallidasPivote: factors[0].value ?? 0,
        flashcardsMalPivote: factors[1].value ?? 0,
        flashcardsRepasarPivote: factors[2].value ?? 0,
        flashcardsBalanceNoRespondidas: factors[3].value ?? 0,
        flashcardsBalanceMal: factors[4].value ?? 0,
        flashcardsBalanceRevisar: factors[5].value ?? 0,
        flashcardsBalanceBien: factors[6].value ?? 0,
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
    await firstValueFrom(
      this.factorsService.updateFactor$({
        name: FactorName.FLASHCARDS_MAL_PRIVOT,
        value: this.factors.value.flashcardsMalPivote ?? 0,
      })
    );
    await firstValueFrom(
      this.factorsService.updateFactor$({
        name: FactorName.FLASHCARDS_REPASAR_PIVOT,
        value: this.factors.value.flashcardsRepasarPivote ?? 0,
      })
    );
    await firstValueFrom(
      this.factorsService.updateFactor$({
        name: FactorName.FLASHCARDS_BALANCE_NO_RESPONDIDAS,
        value: this.factors.value.flashcardsBalanceNoRespondidas ?? 0,
      })
    );
    await firstValueFrom(
      this.factorsService.updateFactor$({
        name: FactorName.FLASHCARDS_BALANCE_MAL,
        value: this.factors.value.flashcardsBalanceMal ?? 0,
      })
    );
    await firstValueFrom(
      this.factorsService.updateFactor$({
        name: FactorName.FLASHCARDS_BALANCE_REVISAR,
        value: this.factors.value.flashcardsBalanceRevisar ?? 0,
      })
    );
    await firstValueFrom(
      this.factorsService.updateFactor$({
        name: FactorName.FLASHCARDS_BALANCE_BIEN,
        value: this.factors.value.flashcardsBalanceBien ?? 0,
      })
    );
    this.toast.success('Ajustes actualizados exitosamente!');
  }
}
