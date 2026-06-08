export class Logger {
  constructor(private readonly context?: string) {}

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date()
      .toISOString()
      .replace("T", " ")
      .substring(0, 19);
    const ctx = this.context ? ` [${this.context}]` : "";
    return `[Ingestor] - ${timestamp} ${level.padEnd(5)}:${ctx} ${message}`;
  }

  log(message: string, ...optionalParams: any[]) {
    console.log(this.formatMessage("LOG", message), ...optionalParams);
  }

  warn(message: string, ...optionalParams: any[]) {
    console.warn(this.formatMessage("WARN", message), ...optionalParams);
  }

  error(message: string, ...optionalParams: any[]) {
    console.error(this.formatMessage("ERROR", message), ...optionalParams);
  }

  debug(message: string, ...optionalParams: any[]) {
    console.debug(this.formatMessage("DEBUG", message), ...optionalParams);
  }
}
