// client/src/setupProxy.js
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    ['/ingest','/ask'],
    createProxyMiddleware({
      target: 'http://localhost:5000',
      changeOrigin: true,
      onProxyReq: (proxyReq, req, res) => {
        // strip out any cookies so the header block stays small
        proxyReq.removeHeader('cookie');
      }
    })
  );
};