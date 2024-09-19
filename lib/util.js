const YAML = require('yaml');

const getIPAddress = () => {
  const interfaces = require('os').networkInterfaces();
  for (const devName in interfaces) {
    const iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (
        alias.family === 'IPv4' &&
            alias.address !== '127.0.0.1' &&
            !alias.internal
      ) {
        return alias.address;
      }
    }
  }
};

const logger = {
  info: (...str) => {
    console.log('\x1b[36m[eyu-egg-nacos] ' + str.join(' ') + '\x1b[0m');
  },
  warn: (...str) => {
    console.log('\x1b[33m[eyu-egg-nacos] ' + str.join(' ') + '\x1b[0m');
  },
  error: (...str) => {
    console.log('\x1b[31m[eyu-egg-nacos] ' + str.join(' ') + '\x1b[0m');
  },
};

const dataParse = str => {
  let data = null;
  try {
    data = JSON.parse(str);
  } catch (err) {
    logger.warn('JSON parse fail.');
    try {
      data = YAML.parse(str);
    } catch (err) {
      logger.warn('YAML parse fail.');
      logger.error('The data format is incorrect. Only JSON and YAML are supported.');
    }
  }
  return data;
};

module.exports = { getIPAddress, logger, dataParse };
