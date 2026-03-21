module.exports = {
  apps: [
    {
      name: 'invoicing-api',
      cwd: './backend',
      script: 'npx',
      args: 'tsx src/server.ts',
      watch: ['src'],
      ignore_watch: ['node_modules', 'dist'],
      env: {
        NODE_ENV: 'development',
        PORT: 3002,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3002,
      },
    },
    {
      name: 'invoicing-frontend',
      cwd: './frontend',
      script: 'npx',
      args: 'vite --port 5173',
      env: {
        NODE_ENV: 'development',
      },
    },
  ],
};
