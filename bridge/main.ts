import { loadConfig } from "./config";
import { ApiClient } from "./api-client";
import { BridgeRunner } from "./runner";
import { MockAdapter } from "./mock";
import { SqlServerAdapter } from "./sqlserver";

const config = loadConfig();
const adapter = config.mode === "mock" ? new MockAdapter(config.sourceScope) : new SqlServerAdapter(config);
const runner = new BridgeRunner(config, new ApiClient(config), adapter);
process.on("SIGINT", () => runner.stop()); process.on("SIGTERM", () => runner.stop());
void runner.run().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
