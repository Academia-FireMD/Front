export const environment = {
  production: true,
  apiUrl: 'https://api-staging.tecnikafire.com',
  wordpressUrl: 'https://staging2.tecnikafire.com',
  wooCommerceUrl: 'https://staging2.tecnikafire.com/tienda',
  aiAssistant: {
    // Apunta al Paidio de STAGING (entorno aislado), no al de prod. La BD de
    // staging es copia de prod, así que el mismo embedToken resuelve el
    // "Asistente de Estudio" (699f81d5) que sirve este entorno. El bundle del
    // widget y la API los sirve el propio backend de staging.
    apiUrl: 'https://unique-fascination-staging.up.railway.app/api',
    embedToken: '43978f44-205d-42b9-8273-b0a3a1c7fb34',
    adminEmbedToken: 'admin-preauth-embed-001',
    widgetUrl:
      'https://unique-fascination-staging.up.railway.app/widget/ai-assistant-widget.js',
  },
};
