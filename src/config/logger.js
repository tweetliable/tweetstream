var appRoot = require("app-root-path");
var winston = require("winston");

var options = {
  file: {
    level: "info",
    filename: `${appRoot}/logs/server.log`,
    handleExceptions: true,
    json: true,
    maxSize: 5242880, // 5 MB
    maxFiles: 5,
    colorize: false,
  },
  console: {
    level: "debug",
    handleExceptions: true,
    json: false,
    colorize: true,
  },
};

var logger = new winston.createLogger({
  transports: [
    new winston.transports.File(options.file),
    new winston.transports.Console(options.console),
  ],
  exitOnError: false,
});

module.exports = logger;
