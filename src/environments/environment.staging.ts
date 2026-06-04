export const environment = {
  production: true,
  apiUrl: 'https://api-staging.tecnikafire.com',
  wordpressUrl: 'https://staging2.tecnikafire.com',
  wooCommerceUrl: 'https://staging2.tecnikafire.com/tienda',
  aiAssistant: {
    // Previously pointed at the Railway-internal hostname (which now 404s on
    // the widget asset); the canonical custom domain serves both the API and
    // the widget bundle.
    apiUrl: 'https://ai-api.tecnikafire.com/api',
    embedToken: '43978f44-205d-42b9-8273-b0a3a1c7fb34',
    adminEmbedToken: 'admin-preauth-embed-001',
    widgetUrl: 'https://ai-api.tecnikafire.com/widget/ai-assistant-widget.js',
  },
};
