const { initEggNacos } = require('./lib/nacos');

// app.js
class AppBootHook {
  constructor(app) {
    this.app = app;
  }

  configWillLoad() {
    initEggNacos(this.app);
  }
}

module.exports = AppBootHook;

