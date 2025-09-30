export interface AppConfig {
  server: {
    port: number;
    host: string;
    cors: {
      origin: string[];
      credentials: boolean;
    };
  };
  session: {
    secret: string;
    ttl: number;
  };
  monitoring: {
    enabled: boolean;
    logLevel: string;
  };
}

export interface EnvironmentConfig {
  development: AppConfig;
  production: AppConfig;
  test: AppConfig;
}
