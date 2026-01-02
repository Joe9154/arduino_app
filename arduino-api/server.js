import express from 'express';
import cors from 'cors';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdtemp, writeFile, readFile, rm } from 'fs/promises';
import { join, basename } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ARDUINO_CLI = join(__dirname, 'bin', 'arduino-cli');
const execFileAsync = promisify(execFile);
const app = express();
const PORT = process.env.PORT || 8001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/compile', async (req, res) => {
  const { arduino_code } = req.body;

  if (!arduino_code || typeof arduino_code !== 'string') {
    return res.status(400).json({ error: "Missing 'arduino_code' in request body" });
  }

  let tempDir = null;

  try {
    tempDir = await mkdtemp(join(tmpdir(), 'arduino-compile-'));
    const sketchName = basename(tempDir);
    const inoFile = join(tempDir, `${sketchName}.ino`);

    await writeFile(inoFile, arduino_code, 'utf8');

    await execFileAsync(ARDUINO_CLI, [
      'compile',
      '-b', 'arduino:avr:uno',
      '--output-dir', tempDir,
      inoFile
    ], { cwd: tempDir, timeout: 30000 });

    const hexData = await readFile(join(tempDir, `${sketchName}.ino.hex`), 'utf8');
    res.json({ hex_data: hexData });

  } catch (error) {
    const message = error.code === 'ETIMEDOUT' ? 'Compilation timed out' :
                    error.stderr || error.message || 'Compilation failed';
    res.status(500).json({ error: message });
  } finally {
    if (tempDir) {
      rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
