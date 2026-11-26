// Local KiWave API. Run: npm run api   (loads .env via node --env-file)
import http from 'node:http';
import { handler, configProblem } from './app.mjs';

const problem = configProblem();
if (problem) { console.error(`[api] ${problem} Preencha o .env.`); process.exit(1); }
const PORT = Number(process.env.API_PORT || 4000);
http.createServer(handler).listen(PORT, () => console.log(`[api] KiWave em http://localhost:${PORT}`));
