export const environment = {
  production: true,
  apiUrl: 'https://server-production-0727.up.railway.app',
  wordpressUrl: 'https://tecnikafire.com',
  wooCommerceUrl: 'https://tecnikafire.com/tienda',
  aiAssistant: {
    // ai-assistant-production.up.railway.app quedó huérfano (Railway "Application
    // not found"): el servicio prod se sirve por el dominio custom ai-api.tecnikafire.com.
    apiUrl: 'https://ai-api.tecnikafire.com/api',
    embedToken: '43978f44-205d-42b9-8273-b0a3a1c7fb34',
    adminEmbedToken: 'admin-preauth-embed-001',
    widgetUrl: 'https://ai-api.tecnikafire.com/widget/ai-assistant-widget.js',
  },
};
