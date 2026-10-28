import { expect, type Page } from '@playwright/test';

/**
 * Entra en el modo explícito de marcado del calendario del alumno.
 * El contrato exige que las casillas no existan hasta activar el modo.
 */
export async function entrarModoMarcado(page: Page): Promise<void> {
  const toggle = page.getByTestId('marking-toggle');
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveText('Marcar progreso');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('completion-toggle')).toHaveCount(0);

  await toggle.click();

  await expect(toggle).toHaveText('Terminar');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('marking-status')).toContainText(
    'Marcando progreso',
  );
  await expect(page.getByTestId('completion-toggle').first()).toBeVisible();
}

/** Sale del modo y comprueba que las casillas vuelven a ocultarse. */
export async function salirModoMarcado(page: Page): Promise<void> {
  const toggle = page.getByTestId('marking-toggle');
  await expect(toggle).toHaveText('Terminar');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(toggle).not.toHaveAttribute('aria-disabled', 'true');
  await toggle.click();
  await expect(toggle).toHaveText('Marcar progreso');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('completion-toggle')).toHaveCount(0);
}
