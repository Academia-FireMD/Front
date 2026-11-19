const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const script = readFileSync(join(__dirname, "librillo-anclas.frame"), "utf8");
const anclasLibrillo = new Function(script + "\nreturn anclasLibrillo;")();

function hoja(texto) {
  return { txt: [texto], bloques: [["p", texto]] };
}

const marca = { s: 0, e: 4, c: 1 };

describe("anclas del Librillo", () => {
  it("restaura la misma nota en el pasaje original aunque la hoja se reordene", () => {
    const hojaA = hoja("El municipio");
    const hojaB = hoja("El consorcio");
    const original = anclasLibrillo({ id: "tema", hojas: [hojaA, hojaB] });
    const despues = anclasLibrillo({ id: "tema", hojas: [hojaB, hojaA] });
    const anotaciones = original.empaquetar("own", { 1: { 0: [marca] } });

    expect(despues.indice(original.hoja(1))).toBe(0);
    expect(despues.desempaquetar("own", anotaciones)).toEqual({
      0: { 0: [marca] },
    });
  });

  it("conserva la anotación huérfana cuando el texto se sustituye", () => {
    const original = anclasLibrillo({
      id: "tema",
      hojas: [hoja("El municipio")],
    });
    const despues = anclasLibrillo({
      id: "tema",
      hojas: [hoja("La provincia")],
    });
    const anotaciones = original.empaquetar("own", { 0: { 0: [marca] } });

    expect(despues.indice(original.hoja(0))).toBe(-1);
    expect(despues.desempaquetar("own", anotaciones)).toEqual({});
    expect(despues.empaquetar("own", {})).toEqual(anotaciones);
  });

  it("mantiene el subrayado propio del pasaje que sigue intacto dentro de una hoja editada", () => {
    const conDosPasajes = (txt) => ({
      tit: "Organización",
      rango: "Art. 8",
      txt,
      bloques: txt.map((x) => ["p", x]),
    });
    const original = anclasLibrillo({
      id: "tema",
      hojas: [conDosPasajes(["A los efectos", "Datos de 2025"])],
    });
    const despues = anclasLibrillo({
      id: "tema",
      hojas: [conDosPasajes(["Datos de 2026", "A los efectos"])],
    });
    const anotaciones = original.empaquetar("own", {
      0: { 0: [marca], 1: [marca] },
    });

    expect(despues.desempaquetar("own", anotaciones)).toEqual({
      0: { 1: [marca] },
    });
    expect(despues.empaquetar("own", { 0: { 1: [marca] } })).toEqual(
      anotaciones,
    );
  });
});
