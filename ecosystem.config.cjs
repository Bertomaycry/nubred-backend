module.exports = {
  apps: [{
    name: "nubred-backend",
    script: "./src/index.js",
    instances: "max",
    exec_mode: "cluster",
    env: {
      NODE_ENV: "production",
    }
  }]
}
