describe('Autenticación', () => {
  beforeEach(() => {
    // Limpiar el localStorage antes de cada prueba
    cy.clearLocalStorage();
    // Intentar visitar la página con reintento
    cy.visit('/auth/login', { timeout: 30000 }).then(() => {
      // Esperar a que la página esté completamente cargada
      cy.get('input[formControlName="email"]').should('be.visible');
    });
  });

  describe('Login', () => {
    it('debería hacer login como administrador correctamente', () => {
      cy.get('input[formControlName="email"]').type('admin@test.com');
      // Usar el selector correcto para el input de contraseña dentro del componente
      cy.get('app-password-input input').type('test1234');
      cy.get('button[type="submit"]').click();

      // Verificar redirección a la ruta de admin
      cy.url().should('include', '/app/profile');
    });

    it('debería hacer login como alumno correctamente', () => {
      cy.get('input[formControlName="email"]').type('alumno@test.com');
      cy.get('app-password-input input').type('test1234');
      cy.get('button[type="submit"]').click();

      // Verificar redirección a la ruta de alumno
      cy.url().should('include', '/app/profile');
    });

    it('debería mostrar error con credenciales inválidas', () => {
      cy.get('input[formControlName="email"]').type('invalid@email.com');
      cy.get('app-password-input input').type('wrongpassword');
      cy.get('button[type="submit"]').click();

      // Verificar que aparece el toast de error
      cy.get('.toast-error').should('be.visible');
    });

    it('debería validar el formato del email', () => {
      cy.get('input[formControlName="email"]').type('invalidemail').blur();
      cy.contains('El formato del email no es válido').should('be.visible');
    });
  });

  describe('Registro', () => {
    beforeEach(() => {
      cy.visit('/auth/registro');
    });

    it('debería registrar un nuevo usuario correctamente', () => {
      const randomEmail = `test${Math.random().toString(36).substring(7)}@example.com`;

      // Llenar campos básicos
      cy.get('input[formControlName="nombre"]').type('Test');
      cy.get('input[formControlName="apellidos"]').type('Usuario');
      cy.get('input[formControlName="email"]').type(randomEmail);
      cy.get('app-password-input').first().find('input').type('Test1234!');
      cy.get('app-password-input').last().find('input').type('Test1234!');

      // Seleccionar comunidad
      cy.get('p-dropdown').first().click();
      cy.get('.p-dropdown-item').contains('Valencia').click();
      // Esperar a que el dropdown se cierre
      cy.get('.p-dropdown-panel').should('not.exist');

      // Seleccionar tutor
      cy.get('p-dropdown').last().click();
      cy.get('.p-dropdown-item').first().click();
      // Esperar a que el dropdown se cierre
      cy.get('.p-dropdown-panel').should('not.exist');

      // Hacer click fuera para asegurar que todo está cerrado
      cy.get('body').click(0, 0);

      // Pequeña pausa para asegurar que la UI se ha actualizado
      cy.wait(500);

      // Ahora intentar el checkbox
      cy.get('p-checkbox[formControlName="politicaDePrivacidadAceptada"]')
        .should('be.visible')
        .click();

      cy.get('button[type="submit"]').click();

      // Verificar redirección al login
      cy.url().should('include', '/auth/login');
    });

    it('debería validar que las contraseñas coincidan', () => {
      cy.get('app-password-input').first().find('input').type('Password123!');
      cy.get('app-password-input').last().find('input').type('DifferentPassword123!').blur();
      cy.contains('Las contraseñas no coinciden').should('be.visible');
    });
  });

  describe('Recuperación de contraseña', () => {
    beforeEach(() => {
      cy.visit('/auth/recuperar-contrasenya');
    });

    it('debería enviar email de recuperación', () => {
      cy.get('input[formControlName="email"]').type('admin@test.com');
      cy.get('button[type="submit"]').click();

      // Verificar mensaje de confirmación
      cy.contains('Revisa tu email').should('be.visible');
    });

    it('debería validar el formato del email', () => {
      cy.get('input[formControlName="email"]').type('invalidemail').blur();
      cy.contains('El formato del email no es válido').should('be.visible');
    });

    it('debería cambiar la contraseña con token válido', () => {
      // Interceptar la petición de cambio de contraseña
      cy.intercept('POST', 'http://localhost:3000/auth/reset-password', {
        headers: {
          'content-type': 'application/json',
        },
        body: {
          message: 'Contraseña actualizada correctamente'
        },
        statusCode: 200
      }).as('resetPassword');

      // Simular acceso con token
      cy.visit('/auth/reset-password?token=valid-token');

      cy.get('app-password-input input').type('NewPassword123!');
      cy.get('button[type="submit"]').click();

      // Verificar que la petición se hizo con el cuerpo correcto
      cy.wait('@resetPassword').its('request.body').should('deep.equal', {
        token: 'valid-token',
        newPassword: 'NewPassword123!'
      });

      // Verificar redirección al login
      cy.url().should('include', '/auth/login');
    });

    it('debería mostrar error con token inválido', () => {
      // Interceptar la petición con error
      cy.intercept('POST', 'http://localhost:3000/auth/reset-password', {
        statusCode: 400,
        body: {
          message: 'Token inválido o expirado'
        }
      }).as('resetPasswordError');

      cy.visit('/auth/reset-password?token=invalid-token');

      cy.get('app-password-input input').type('NewPassword123!');
      cy.get('button[type="submit"]').click();

      // Verificar que la petición se hizo con el cuerpo correcto
      cy.wait('@resetPasswordError').its('request.body').should('deep.equal', {
        token: 'invalid-token',
        newPassword: 'NewPassword123!'
      });

      // Verificar que se muestra el mensaje de error
      cy.get('.toast-error').should('be.visible');
    });
  });
});
