import { loadConfig } from "./config";
import { MockAdapter } from "./mock";
import { SqlServerAdapter } from "./sqlserver";

const config = loadConfig(); const adapter = config.mode === "mock" ? new MockAdapter(config.sourceScope) : new SqlServerAdapter(config);
void Promise.all([adapter.health(), adapter.listCatalog()]).then(([health,catalog]) => console.log(JSON.stringify({ health, counts: { students: catalog.students.length, teachers: catalog.teachers.length, items: catalog.items.length } }, null, 2))).finally(() => adapter.close());
