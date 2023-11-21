'use strict';

const os = require('os');
const address = require('address');
const { wrap } = require('aggregate-base');
const { Transport } = require('egg-logger');

const ip = address.ip();
const hostname = os.hostname();

class SLSTransport extends Transport {
  constructor(options) {
    super(options);

    this.client = options.client;
    this.logTag = {
      ip,
      hostname,
      env: options.env,
      appName: options.appName,
      loggerName: options.loggerName,
      loggerFileName: options.loggerFileName,
    };
    this.transform = options.transform;
  }

  async upload(data) {
    await this.client.upload(data);
  }

}

module.exports = wrap(SLSTransport, {
  interval: 1000,
  intercept: 'log',
  interceptTransform(level, args, meta) {
    const content = this.log(level, args, meta);
    let contents = { level, content, ...this.logTag };

    const ctx = meta.ctx || {};
    const userId = meta.ctx.userId || '-';
    const traceId = meta.ctx.tracer ? meta.ctx.tracer.traceId || '-' : '-';
    let use = 0;
    if (ctx.performanceStarttime) {
      // eslint-disable-next-line no-undef
      use = Math.floor((performance.now() - ctx.performanceStarttime) * 1000) / 1000;
    } else if (ctx.starttime) {
      use = Date.now() - ctx.starttime;
    }

    contents = {
      ...contents,
      ip: meta.ctx.ip,
      userId,
      traceId,
      use,
      method: meta.ctx.method,
      url: meta.ctx.url,
    };


    // set errorCode if the first argument is the instance of Error
    const err = args[0];
    if (err instanceof Error && err.code) {
      contents.errorCode = err.code;
    }

    // support transform
    if (this.transform) {
      contents = this.transform(contents, args);
      if (contents === false) return false;
    }

    return {
      time: new Date(),
      contents,
    };
  },
  flush: 'upload',
});
