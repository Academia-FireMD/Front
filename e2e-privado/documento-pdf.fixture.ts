export function documentoPdf() {
  const contenidos = [1, 2].map(
    (pagina) =>
      `BT /F1 18 Tf 45 760 Td (Documento de prueba R07, hoja ${pagina}) Tj ET`,
  );
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    ...[5, 6].map(
      (contenido) =>
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contenido} 0 R /Resources << /Font << /F1 7 0 R >> >> >>`,
    ),
    ...contenidos.map(
      (contenido) =>
        `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`,
    ),
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const posiciones = objetos.map((objeto, indice) => {
    const posicion = pdf.length;
    pdf += indice + 1 + ' 0 obj\n' + objeto + '\nendobj\n';
    return posicion;
  });
  const xref = pdf.length;
  const total = objetos.length + 1;
  pdf += `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (const posicion of posiciones) {
    pdf += String(posicion).padStart(10, '0') + ' 00000 n \n';
  }
  return Buffer.from(
    pdf +
      `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`,
  );
}
