module.exports = {
  apps: [{
    name: 'transroute',
    script: 'dist/index.js',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production'
    },
    env_file: '.env'
  }]
}