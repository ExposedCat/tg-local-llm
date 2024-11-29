export declare global {
  // biome-ignore lint/style/noNamespace: <explanation>
  namespace NodeJS {
    interface ProcessEnv {
      TOKEN: string;
      DB_CONNECTION_STRING: string;
    }
  }
}
