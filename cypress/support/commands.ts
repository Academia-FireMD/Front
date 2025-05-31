/// <reference types="cypress" />
// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })
//
// declare global {
//   namespace Cypress {
//     interface Chainable {
//       login(email: string, password: string): Chainable<void>
//       drag(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
//       dismiss(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
//       visit(originalFn: CommandOriginalFn, url: string, options: Partial<VisitOptions>): Chainable<Element>
//     }
//   }
// }

// Comando para hacer login como administrador
Cypress.Commands.add('loginAsAdmin', () => {
  cy.session('admin-session', () => {
    cy.visit('/auth/login');
    cy.get('input[formControlName="email"]').type('admin@test.com');
    cy.get('app-password-input input').type('test1234');
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/app/profile');
  });
});

// Comando para hacer login como alumno
Cypress.Commands.add('loginAsAlumno', () => {
  cy.session('alumno-session', () => {
    cy.visit('/auth/login');
    cy.get('input[formControlName="email"]').type('alumno@test.com');
    cy.get('app-password-input input').type('test1234');
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/app/profile');
  });
});

// Comando para esperar a que se cargue un componente específico
Cypress.Commands.add('waitForComponent', (selector: string, timeout = 10000) => {
  cy.get(selector, { timeout }).should('be.visible');
  // Esperar un poco más para que Angular termine de renderizar
  cy.wait(500);
  return cy.get(selector);
});

// Comando para interceptar las peticiones de exámenes
Cypress.Commands.add('setupExamenInterceptors', () => {
  cy.intercept('POST', '**/examenes/listar').as('getExamenes');
  cy.intercept('POST', '**/examenes/crear').as('createExamen');
  cy.intercept('GET', '**/examenes/**').as('getExamen');
  cy.intercept('POST', '**/examenes/iniciar/**').as('startExamen');
  cy.intercept('POST', '**/examenes/**/publicar').as('publicarExamen');
  cy.intercept('DELETE', '**/examenes/**').as('deleteExamen');
});

// Comando para crear un examen de prueba
Cypress.Commands.add('createTestExamen', (nombre = 'Examen de Prueba E2E') => {
  cy.get('[data-cy="crear-examen-btn"]').click();
  cy.get('input[formControlName="nombre"]').type(nombre);
  cy.get('textarea[formControlName="descripcion"]').type('Descripción del examen de prueba');
  cy.get('input[formControlName="duracionMinutos"]').clear().type('60');
  cy.get('button[type="submit"]').click();
});

declare global {
  namespace Cypress {
    interface Chainable {
      loginAsAdmin(): Chainable<void>
      loginAsAlumno(): Chainable<void>
      waitForComponent(selector: string, timeout?: number): Chainable<JQuery<HTMLElement>>
      setupTestInterceptors(): Chainable<void>
      setupExamenInterceptors(): Chainable<void>
      createTestExamen(nombre?: string): Chainable<void>
    }
  }
}

/**
 * Configurar interceptores comunes para tests
 */
Cypress.Commands.add('setupTestInterceptors', () => {
  // Interceptar APIs de test
  cy.intercept('POST', '**/test/generar', {
    fixture: 'test-generado.json'
  }).as('generarTest');

  cy.intercept('GET', '**/test/**', {
    fixture: 'test-detalle.json'
  }).as('getTest');

  cy.intercept('POST', '**/test/**/responder', {
    statusCode: 200,
    body: { success: true }
  }).as('responderPregunta');

  cy.intercept('POST', '**/test/**/finalizar', {
    statusCode: 200,
    body: { success: true }
  }).as('finalizarTest');
});

export { };

