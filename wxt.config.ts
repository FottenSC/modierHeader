import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifestVersion: 3,
  srcDir: '.',
  manifest: ({ browser }) => ({
    name: browser === 'edge' ? 'CleanHeader for Edge' : 'CleanHeader',
    short_name: 'CleanHeader',
    description:
      'Modify HTTP request headers, response headers, and redirects locally without ads or telemetry.',
    permissions: [
      'activeTab',
      'declarativeNetRequest',
      'declarativeNetRequestWithHostAccess',
      'storage',
    ],
    optional_host_permissions: ['<all_urls>'],
    minimum_chrome_version: '121',
    browser_specific_settings:
      browser === 'edge'
        ? {
            edge: {
              strict_min_version: '121.0.0.0',
            },
          }
        : undefined,
  }),
});
