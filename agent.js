const utils = require('./lib/util');
const path = require('path');
const fs = require('fs/promises');
const { loadConfigAtBoot } = require('./lib/nacos');

class AgentBootHook {
  constructor(agent) {
    this.agent = agent;
  }
  async didReady() {
    let nacosConfig = {};
    const eggEnv = this.agent.config.env;
    utils.logger.info(`[Agent] Current env: ${eggEnv}, use nacos.${eggEnv}.json`);
    try {
      nacosConfig = require(path.join(this.agent.config.baseDir, 'config', `nacos.${eggEnv}.json`));
    } catch (err) {
      utils.logger.warn('[Agent] Nacos configuration file not find, use Egg configuration file instead.');
      nacosConfig = this.agent.config.nacos;
    }
    const { configClient, configs } = nacosConfig;
    if (!configClient || !configs) {
      utils.logger.warn('[Agent] There is no configuration for Nacos-config-client.');
      return;
    }
    utils.logger.info('[Agent] Load the remote boot configuration.');
    const bootConfig = await loadConfigAtBoot(configClient, configs);
    if (bootConfig && Object.keys(bootConfig).length > 0) {
      await fs.writeFile(path.join(this.agent.config.rundir, 'boot_config.json'), JSON.stringify(bootConfig, null, 2));
      utils.logger.info('[Agent] The remote boot configuration has been written.');
    } else {
      utils.logger.info('[Agent] There is no remote boot configuration.');
    }
  }
}

module.exports = AgentBootHook;
