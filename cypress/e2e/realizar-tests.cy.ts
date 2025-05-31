describe('Realizar Tests - Tests E2E', () => {
  beforeEach(() => {
    // Login como alumno antes de cada test
    cy.loginAsAlumno();
    cy.visit('/app/test/alumno/realizar-test');
    cy.waitForComponent('[data-testid="realizar-test-container"]');
  });

  // Función helper para seleccionar temas - mejorada
  const seleccionarTemas = () => {
    // Abrir el multiselect de temas
    cy.get('[data-testid="temas-multiselect"]').click();

    // Esperar a que aparezca el panel
    cy.get('.p-multiselect-panel').should('be.visible');

    cy.get('.p-multiselect-panel').within(() => {
      cy.get('p-checkbox').first().click();
    });

    // Esperar un momento para que se procese la selección
    cy.wait(500);

    // Cerrar el panel presionando escape
    cy.get('body').type('{esc}');

    // Verificar que el panel se cerró
    cy.get('.p-multiselect-panel').should('not.exist');
  };

  // Función helper para limpiar tests pendientes antes de crear nuevos
  const limpiarTestsPendientes = () => {
    cy.get('body').then(($body) => {
      // Verificar si existen tests pendientes usando find en lugar de get
      const testsPendientesContainer = $body.find('[data-testid="tests-pendientes-container"]');

      if (testsPendientesContainer.length > 0) {
        // Si hay container de tests pendientes, verificar si hay botones de abortar
        const botonesAbortar = $body.find('[data-testid="abortar-test-btn"]');

        if (botonesAbortar.length > 0) {
          // Función recursiva para abortar tests pendientes
          const abortarTestsPendientes = () => {
            cy.get('body').then(($currentBody) => {
              const currentButtons = $currentBody.find('[data-testid="abortar-test-btn"]');

              if (currentButtons.length > 0) {
                // Clickear el primer botón disponible
                cy.get('[data-testid="abortar-test-btn"]').first().click();

                // Esperar a que aparezca el diálogo de PrimeNG y confirmar
                cy.get('.p-confirm-dialog').should('be.visible');
                cy.get('.p-confirm-dialog-accept').click();

                // Esperar a que se procese y verificar si quedan más
                cy.wait(1000).then(() => {
                  abortarTestsPendientes(); // Llamada recursiva
                });
              }
            });
          };

          abortarTestsPendientes();
        }
      }
    });
  };

  describe('🧪 Test Normal (Configuración y Generación)', () => {
    it('debería mostrar la interfaz de configuración correctamente', () => {
      // Verificar elementos básicos de configuración
      cy.get('[data-testid="configuracion-test-card"]').should('be.visible');
      cy.get('[data-testid="num-preguntas-dropdown"]').should('be.visible');
      cy.get('[data-testid="dificultad-multiselect"]').should('be.visible');
      cy.get('[data-testid="temas-select"]').should('be.visible');
      cy.get('[data-testid="generar-test-btn"]').should('be.visible');
    });

    it('debería configurar y generar un test normal básico', () => {
      // Limpiar tests pendientes antes de crear nuevo
      limpiarTestsPendientes();

      // Configurar número de preguntas
      cy.get('[data-testid="num-preguntas-dropdown"]').click();
      cy.get('.p-dropdown-item').contains('10').click();

      // Configurar dificultad
      cy.get('[data-testid="dificultad-multiselect"]').click();
      cy.get('.p-multiselect-item').first().click();
      cy.get('body').click(); // Cerrar dropdown

      // Configurar temas usando la función helper
      seleccionarTemas();

      // Generar test
      cy.get('[data-testid="generar-test-btn"]').click();

      // Confirmar generación
      cy.get('[data-testid="confirmacion-dialog"]').within(() => {
        cy.get('.p-confirm-dialog-accept').click();
      });

      // Verificar redirección a página de test
      cy.url().should('include', '/app/test/alumno/realizar-test/');
      cy.get('[data-testid="pregunta-card"]').should('be.visible');
    });

    it('debería validar campos requeridos', () => {
      // Limpiar tests pendientes antes de crear nuevo
      limpiarTestsPendientes();

      // Intentar generar sin seleccionar temas
      cy.get('[data-testid="generar-test-btn"]').should('be.disabled');

      // Configurar temas para habilitar botón
      seleccionarTemas();

      cy.get('[data-testid="generar-test-btn"]').should('not.be.disabled');
    });
  });



  describe('⏰ Test de Examen (con Cronómetro)', () => {
    it('debería mostrar campo de tiempo límite cuando se activa test de examen', () => {
      // Limpiar tests pendientes antes de crear nuevo
      limpiarTestsPendientes();

      // Activar test de examen
      cy.get('[data-testid="test-examen-switch"]').click();

      // Verificar que aparece el campo de tiempo límite
      cy.get('[data-testid="tiempo-limite-input"]').should('be.visible');
    });

    it('debería requerir tiempo límite para test de examen', () => {
      // Limpiar tests pendientes antes de crear nuevo
      limpiarTestsPendientes();

      // Configurar temas
      seleccionarTemas();

      // Activar test de examen sin configurar tiempo
      cy.get('[data-testid="test-examen-switch"]').click();

      // El botón debería estar deshabilitado sin tiempo límite
      cy.get('[data-testid="generar-test-btn"]').should('be.disabled');

      // Configurar tiempo límite
      cy.get('[data-testid="tiempo-limite-input"]').type('60');

      // Ahora el botón debería estar habilitado
      cy.get('[data-testid="generar-test-btn"]').should('not.be.disabled');
    });

    it('debería configurar y generar un test de examen con cronómetro', () => {
      // Limpiar tests pendientes antes de crear nuevo
      limpiarTestsPendientes();

      // Configurar número de preguntas
      cy.get('[data-testid="num-preguntas-dropdown"]').click();
      cy.get('.p-dropdown-item').contains('60').click();

      // Configurar dificultad
      cy.get('[data-testid="dificultad-multiselect"]').click();
      cy.get('.p-multiselect-item').first().click();
      cy.get('body').click();

      // Configurar temas
      seleccionarTemas();

      // Activar test de examen
      cy.get('[data-testid="test-examen-switch"]').click();

      // Configurar tiempo límite
      cy.get('[data-testid="tiempo-limite-input"]').type('60');

      // Generar test
      cy.get('[data-testid="generar-test-btn"]').click();

      // Confirmar generación (mensaje especial para examen)
      cy.get('[data-testid="confirmacion-dialog"]').within(() => {
        cy.contains('examen').should('be.visible');
        cy.contains('tiempo empezará a descontarse').should('be.visible');
        cy.get('.p-confirm-dialog-accept').click();
      });

      // Verificar redirección y que se muestra el cronómetro
      cy.url().should('include', '/app/test/alumno/realizar-test/');
      cy.get('[data-testid="pregunta-card"]').should('be.visible');
      cy.get('[data-testid="cronometro"]').should('be.visible');
    });
  });

  describe('📝 Ejecutar Test - Interfaz de Preguntas', () => {
    beforeEach(() => {
      // Limpiar tests pendientes antes de crear nuevo
      limpiarTestsPendientes();

      // Crear un test para poder ejecutarlo
      cy.get('[data-testid="num-preguntas-dropdown"]').click();
      cy.get('.p-dropdown-item').contains('60').click();

      cy.get('[data-testid="dificultad-multiselect"]').click();
      cy.get('.p-multiselect-item').first().click();
      cy.get('body').click();

      seleccionarTemas();

      cy.get('[data-testid="generar-test-btn"]').click();
      cy.get('[data-testid="confirmacion-dialog"]').within(() => {
        cy.get('.p-confirm-dialog-accept').click();
      });

      cy.url().should('include', '/app/test/alumno/realizar-test/');
      cy.waitForComponent('[data-testid="pregunta-card"]');
    });

    it('debería mostrar correctamente la interfaz de pregunta', () => {
      // Verificar elementos de la pregunta
      cy.get('[data-testid="pregunta-identificador"]').should('be.visible');
      cy.get('[data-testid="numero-pregunta"]').should('contain', 'Pregunta 1/60');
      cy.get('[data-testid="tema-pregunta"]').should('be.visible');
      cy.get('[data-testid="enunciado-pregunta"]').should('be.visible');
      cy.get('[data-testid="opcion-respuesta"]').should('have.length', 4);
    });

    it('debería permitir seleccionar una respuesta', () => {
      // Seleccionar primera opción
      cy.get('[data-testid="opcion-respuesta"]').first().click();

      // Verificar que se marca como seleccionada
      cy.get('[data-testid="opcion-respuesta"]').first()
        .should('have.class', 'respuesta-seleccionada');

      // Debería aparecer el botón continuar
      cy.get('[data-testid="continuar-btn"]').scrollIntoView().should('be.visible');
    });

    it('debería navegar entre preguntas', () => {
      // Responder primera pregunta
      cy.get('[data-testid="opcion-respuesta"]').first().click();
      cy.get('[data-testid="continuar-btn"]').click();

      // Verificar que avanza a la siguiente pregunta
      cy.get('[data-testid="numero-pregunta"]').should('contain', 'Pregunta 2/60');

      // Usar navegación manual
      cy.get('[data-testid="anterior-pregunta-btn"]').click();
      cy.get('[data-testid="numero-pregunta"]').should('contain', 'Pregunta 1/60');
    });

    it('debería permitir omitir preguntas', () => {
      cy.get('[data-testid="omitir-pregunta-btn"]').click();

      // Verificar que avanza a la siguiente pregunta
      cy.get('[data-testid="numero-pregunta"]').should('contain', 'Pregunta 2/60');
    });

    it('debería permitir seleccionar nivel de confianza', () => {
      // Verificar que se muestran las opciones de confianza
      cy.get('[data-testid="selector-confianza"]').should('be.visible');

      // Seleccionar respuesta
      cy.get('[data-testid="opcion-respuesta"]').first().click();

      // Seleccionar nivel de confianza (⭐ - No dudo)
      cy.get('[data-testid="selector-confianza"]').within(() => {
        cy.contains('⭐').click();
      });

      cy.get('[data-testid="continuar-btn"]').click();
    });

    it('debería finalizar el test', () => {
      // Responder todas las preguntas rápidamente
      for (let i = 0; i < 5; i++) {
        cy.get('[data-testid="opcion-respuesta"]').first().click();

        // En la última pregunta, usar el botón finalizar
        if (i === 4) {
          cy.get('[data-testid="finalizar-test-btn"]').click();
        } else {
          cy.get('[data-testid="continuar-btn"]').click();
        }
      }

      // Verificar redirección a estadísticas
      cy.url().should('include', '/app/test/alumno/stats-test/');
    });
  });

  describe('⏱️ Test de Examen - Cronómetro', () => {
    beforeEach(() => {
      // Limpiar tests pendientes antes de crear nuevo
      limpiarTestsPendientes();

      // Crear un test de examen
      cy.get('[data-testid="num-preguntas-dropdown"]').click();
      cy.get('.p-dropdown-item').contains('60').click();

      cy.get('[data-testid="dificultad-multiselect"]').click();
      cy.get('.p-multiselect-item').first().click();
      cy.get('body').click();

      seleccionarTemas();

      cy.get('[data-testid="test-examen-switch"]').click();
      cy.get('[data-testid="tiempo-limite-input"]').type('5'); // 5 minutos

      cy.get('[data-testid="generar-test-btn"]').click();
      cy.get('[data-testid="confirmacion-dialog"]').within(() => {
        cy.get('.p-confirm-dialog-accept').click();
      });

      cy.url().should('include', '/app/test/alumno/realizar-test/');
      cy.waitForComponent('[data-testid="pregunta-card"]');
    });

    it('debería mostrar el cronómetro en test de examen', () => {
      cy.get('[data-testid="cronometro"]').should('be.visible');
      cy.get('[data-testid="cronometro"]').should('contain', ':'); // Formato mm:ss
    });

    it('debería comportarse diferente en modo examen (no mostrar soluciones inmediatamente)', () => {
      // Seleccionar una respuesta
      cy.get('[data-testid="opcion-respuesta"]').first().click();

      // En modo examen, no debería mostrar la solución inmediatamente
      cy.get('[data-testid="solucion-container"]').should('not.exist');

      // Pero sí debería poder continuar
      cy.get('[data-testid="siguiente-pregunta-btn"]').should('be.visible');
    });
  });

  describe('📚 Test de Repaso (con Fallos)', () => {
    beforeEach(() => {
      // Interceptar API para simular que el usuario tiene fallos
      cy.reload();
      cy.waitForComponent('[data-testid="realizar-test-container"]');
    });

    it('debería mostrar opciones de test de repaso cuando hay fallos', () => {

      // Verificar que se muestran las opciones de repaso
      cy.get('[data-testid="test-repaso-switch"]').should('be.visible');
      cy.get('[data-testid="ver-fallos-btn"]').should('be.visible');
    });


    it('debería configurar y generar un test de repaso', () => {

      // Interceptar la creación del test de repaso
      cy.intercept('POST', '**/tests/start', {
        statusCode: 201,
        body: { id: 2684, message: 'Test de repaso creado correctamente' }
      }).as('createRepasoTest');

      // Limpiar tests pendientes antes de crear nuevo
      limpiarTestsPendientes();

      // Configurar número de preguntas
      cy.get('[data-testid="num-preguntas-dropdown"]').click();
      cy.get('.p-dropdown-item').contains('20').click();

      // Activar test de repaso
      cy.get('[data-testid="test-repaso-switch"]').click();

      // Verificar que el botón se habilita incluso sin temas (para test de repaso)
      cy.get('[data-testid="generar-test-btn"]').should('not.be.disabled');

      // Generar test
      cy.get('[data-testid="generar-test-btn"]').click();

      // Confirmar generación
      cy.get('[data-testid="confirmacion-dialog"]').within(() => {
        cy.get('.p-confirm-dialog-accept').click();
      });

      // Esperar la petición interceptada
      cy.wait('@createRepasoTest');

      // Verificar redirección
      cy.url().should('include', '/app/test/alumno/realizar-test');
    });

    it('debería requerir tiempo límite para test de examen', () => {
      // Limpiar tests pendientes antes de crear nuevo
      limpiarTestsPendientes();

      // Configurar temas
      seleccionarTemas();

      // Activar test de examen sin configurar tiempo
      cy.get('[data-testid="test-examen-switch"]').click();

      // El botón debería estar deshabilitado sin tiempo límite
      cy.get('[data-testid="generar-test-btn"]').should('be.disabled');

      // Configurar tiempo límite
      cy.get('[data-testid="tiempo-limite-input"]').type('60');

      // Ahora el botón debería estar habilitado
      cy.get('[data-testid="generar-test-btn"]').should('not.be.disabled');
    });

    it('debería configurar y generar un test de examen con cronómetro', () => {
      // Limpiar tests pendientes antes de crear nuevo
      limpiarTestsPendientes();

      // Configurar número de preguntas
      cy.get('[data-testid="num-preguntas-dropdown"]').click();
      cy.get('.p-dropdown-item').contains('60').click();

      // Configurar dificultad
      cy.get('[data-testid="dificultad-multiselect"]').click();
      cy.get('.p-multiselect-item').first().click();
      cy.get('body').click();

      // Configurar temas
      seleccionarTemas();

      // Activar test de examen
      cy.get('[data-testid="test-examen-switch"]').click();

      // Configurar tiempo límite
      cy.get('[data-testid="tiempo-limite-input"]').type('60');

      // Generar test
      cy.get('[data-testid="generar-test-btn"]').click();

      // Confirmar generación (mensaje especial para examen)
      cy.get('[data-testid="confirmacion-dialog"]').within(() => {
        cy.contains('examen').should('be.visible');
        cy.contains('tiempo empezará a descontarse').should('be.visible');
        cy.get('.p-confirm-dialog-accept').click();
      });

      // Verificar redirección y que se muestra el cronómetro
      cy.url().should('include', '/app/test/alumno/realizar-test/');
      cy.get('[data-testid="pregunta-card"]').should('be.visible');
      cy.get('[data-testid="cronometro"]').should('be.visible');
    });
  });

  describe('🔄 Tests Pendientes', () => {
    it('debería mostrar tests pendientes cuando existen', () => {
      // Limpiar tests pendientes antes de crear nuevo
      limpiarTestsPendientes();

      // Crear un test parcialmente completado
      cy.get('[data-testid="num-preguntas-dropdown"]').click();
      cy.get('.p-dropdown-item').contains('10').click();

      cy.get('[data-testid="dificultad-multiselect"]').click();
      cy.get('.p-multiselect-item').first().click();
      cy.get('body').click();

      seleccionarTemas();

      cy.get('[data-testid="generar-test-btn"]').click();
      cy.get('[data-testid="confirmacion-dialog"]').within(() => {
        cy.get('.p-confirm-dialog-accept').click();
      });

      // Responder solo una pregunta y volver
      cy.get('[data-testid="opcion-respuesta"]').first().click();
      cy.get('[data-testid="continuar-btn"]').click();

      // Volver a la página principal
      cy.visit('/app/test/alumno/realizar-test');

      // Verificar que se muestra el test pendiente
      cy.get('[data-testid="tests-pendientes-container"]').should('be.visible');
      cy.get('[data-testid="test-pendiente"]').should('exist');
      cy.get('[data-testid="test-pendiente-titulo"]').should('contain', 'test pendiente');
      cy.get('[data-testid="continuar-test-btn"]').should('be.visible');
    });

    it('debería permitir continuar un test pendiente', () => {
      // Assumiendo que ya hay un test pendiente del test anterior
      cy.get('[data-testid="continuar-test-btn"]').first().click();

      // Verificar que se redirige al test
      cy.url().should('include', '/app/test/alumno/realizar-test/');
      cy.get('[data-testid="pregunta-card"]').should('be.visible');
    });

    it('debería permitir abortar un test pendiente', () => {
      // Click en abortar
      cy.get('[data-testid="abortar-test-btn"]').first().click();

      // Confirmar en el diálogo
      cy.get('[data-testid="confirmacion-dialog"]').within(() => {
        cy.get('.p-confirm-dialog-accept').click();
      });

      // El test pendiente debería desaparecer
      cy.get('[data-testid="test-pendiente"]').should('not.exist');
    });
  });

  describe('♿ Accesibilidad y UX', () => {
    it('debería tener labels apropiados en los controles', () => {
      cy.get('[data-testid="num-preguntas-dropdown"]').should('have.attr', 'placeholder');
      cy.get('[data-testid="dificultad-multiselect"]').should('have.attr', 'placeholder');
    });

    it('debería manejar estados de carga', () => {
      // Limpiar tests pendientes antes de crear nuevo
      limpiarTestsPendientes();

      // Configurar test válido
      seleccionarTemas();

      // Verificar que el botón muestra estado de carga durante generación
      cy.get('[data-testid="generar-test-btn"]').click();
      cy.get('[data-testid="confirmacion-dialog"]').within(() => {
        cy.get('.p-confirm-dialog-accept').click();
      });

      // El botón debería mostrar loading momentáneamente
      cy.get('[data-testid="generar-test-btn"]').should('have.class', 'p-button-loading');
    });
  });
});
