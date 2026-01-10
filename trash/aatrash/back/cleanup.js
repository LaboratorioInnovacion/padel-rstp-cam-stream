import fs from 'fs';
import path from 'path';

const BASE_DIR = 'streams/recordings';
const MAX_AGE_HOURS = 24;

function cleanOldRecordings() {
  const now = Date.now();
  fs.readdirSync(BASE_DIR).forEach(camId => {
    const camPath = path.join(BASE_DIR, camId);
    fs.readdirSync(camPath).forEach(session => {
      const sessionPath = path.join(camPath, session);
      const stat = fs.statSync(sessionPath);
      if ((now - stat.ctimeMs) > MAX_AGE_HOURS * 3600 * 1000) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        console.log(`🧹 Eliminado ${sessionPath}`);
      }
    });
  });
}

// Ejecutar periódicamente (ej: con cron o setInterval)
cleanOldRecordings();

// Puedes usar setInterval para ejecutar cada hora
// setInterval(cleanOldRecordings, 3600 * 1000); // cada hora
