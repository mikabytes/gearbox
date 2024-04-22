import winston from "winston"

const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }),
  new winston.transports.File({
    filename: "gearbox.log",
    level: "error",
    format: winston.format.json(),
  }),
]

const logger = winston.createLogger({
  level: "info",
  transports,
})

export default logger

export function setLevels(level) {
  logger.setLevels(level)

  for (const transport of logger.transports) {
    transport.level = level
  }
}
