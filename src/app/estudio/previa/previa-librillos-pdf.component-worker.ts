export function crearWorkerPdf() {
  return new Worker(new URL('./previa-librillos-pdf.worker', import.meta.url), {
    type: 'module',
  });
}
