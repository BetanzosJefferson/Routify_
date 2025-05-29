module.exports = {
  apps: [{
    name: 'transroute',
    script: 'dist/index.js',
    interpreter: 'node',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production'
    },
    env_file: '.env'
  }]
}