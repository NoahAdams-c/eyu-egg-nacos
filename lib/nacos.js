const utils = require('./util');
const { NacosConfigClient, NacosNamingClient } = require('nacos');
const path = require('path');
const fs = require('fs');

const createNamingClient = async options => {
  const {
    serviceName,
    serviceIp,
    servicePort,
    serverHost,
    namespace,
    group,
    username,
    password,
  } = options;
  if (!serverHost || !namespace || !group) {
    utils.logger.warn('Create Nacos naming client fail: missing parameter.');
    return;
  }
  const client = new NacosNamingClient({
    serverList: serverHost,
    namespace,
    username,
    password,
    logger: console,
  });
  await client.ready();
  client.registerInstance(
    serviceName,
    {
      ip: serviceIp, // 服务实例IP
      port: servicePort, // 服务实例端口
      weight: 1, // 服务实例权重
      healthy: true, // 是否健康
      enabled: true, // 是否启用
      ephemeral: true, // 是否临时实例
    //   metadata,
    },
    group
  );
  return client;
};

const createConfigClient = (options, configItems) => {
  const { serverHost, namespace, username, password } = options;
  const client = new NacosConfigClient({
    serverAddr: serverHost,
    namespace,
    username,
    password,
  });

  const configClientHandler = { };

  for (const configName of Object.keys(configItems)) {
    const { dataId, group } = configItems[configName];
    if (!dataId || !group) {
      utils.logger.warn(`Create Nacos config client fail: config[${configName}] missing parameter.`);
      continue;
    }
    if (configName === 'default') {
      configClientHandler.getConfig = async () => utils.dataParse(await client.getConfig(dataId, group));
      configClientHandler.subscribe = cb => client.subscribe(
        {
          dataId,
          group,
        },
        configContent => cb(utils.dataParse(configContent))
      );
      continue;
    }
    configClientHandler[configName] = {
      getConfig: async () => utils.dataParse(await client.getConfig(dataId, group)),
      subscribe: cb => client.subscribe(
        {
          dataId,
          group,
        },
        configContent => cb(utils.dataParse(configContent))
      ),
    };
  }

  return configClientHandler;
};

const loadConfigAtBoot = async (options, configItems) => {
  const { serverHost, namespace, username, password } = options;
  const client = new NacosConfigClient({
    serverAddr: serverHost,
    namespace,
    username,
    password,
  });

  const bootConfigKeys = Object.keys(configItems).filter(key => configItems[key].loadAtBoot);
  const bootConfigDatas = {};
  for (const bootConfigKey of bootConfigKeys) {
    const { dataId, group } = configItems[bootConfigKey];
    const configDatas = utils.dataParse(await client.getConfig(dataId, group));
    if (!configDatas) continue;
    if (bootConfigKey === 'default') {
      Object.assign(bootConfigDatas, configDatas);
    } else {
      Object.assign(bootConfigDatas, { [bootConfigKey]: configDatas });
    }
  }
  return bootConfigDatas;
};

const setDataToObj = (obj, source) => {
  const keys = Object.keys(source);
  for (const key of keys) {
    if (obj[key] && typeof obj[key] === 'object') {
      obj[key] = { ...obj[key], ...source[key] };
    } else {
      obj[key] = source[key];
    }
  }
};

const setBootConfig = app => {
  try {
    const buf = fs.readFileSync(path.join(app.config.rundir, 'boot_config.json'));
    const bootConfig = JSON.parse(buf.toString());
    setDataToObj(app.config, bootConfig);
    utils.logger.info('The remote boot configuration has been applied.');
  } catch (err) {
    utils.logger.error('Failed to apply the remote boot configuration:', err);
  }
};

const initEggNacos = app => {
  let nacosConfig = {};
  const eggEnv = app.config.env;
  utils.logger.info(`Current env: ${eggEnv}, use nacos.${eggEnv}.json`);
  try {
    nacosConfig = require(path.join(app.config.baseDir, 'config', `nacos.${eggEnv}.json`));
  } catch (err) {
    utils.logger.warn('Nacos configuration file not find, use Egg configuration file instead.');
    nacosConfig = app.config.nacos;
  }
  const { configClient, configs, namingClient } = nacosConfig;

  if (namingClient) {
    app.beforeStart(async () => {
      app.nacos.namingClient = await createNamingClient({
        serviceName: app.name,
        serviceIp: utils.getIPAddress(),
        servicePort: app.config.cluster.listen.port,
        ...namingClient,
      });
    });
  }
  if (configClient) {
    app.nacos = {};
    app.nacos.configClient = createConfigClient(configClient, configs);
    app.nacos.setBootConfig = setBootConfig;
  }
};

module.exports = { initEggNacos, loadConfigAtBoot };
