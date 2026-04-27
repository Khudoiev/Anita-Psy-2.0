const logger = require('../services/logger');

const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, originalUrl, ip } = req;
    const { statusCode } = res;

    const logData = {
      method,
      url: originalUrl,
      status: statusCode,
      duration: `${duration}ms`,
      ip,
      userAgent: req.get('user-agent'),
      userId: req.user ? req.user.userId : undefined,
      adminId: req.user ? req.user.adminId : undefined
    };

    if (statusCode >= 500) {
      logger.error(logData, 'Request Failed');
    } else if (statusCode >= 400) {
      logger.warn(logData, 'Request Warning');
    } else {
      logger.info(logData, 'Request Success');
    }
  });

  next();
};

module.exports = requestLogger;
