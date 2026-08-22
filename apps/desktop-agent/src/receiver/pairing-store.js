import fs from 'node:fs';
import path from 'node:path';

export class PairingStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.tokens = new Set();
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          this.tokens = new Set(parsed);
        }
      }
    } catch (err) {
      // Ignore if file doesn't exist yet or is invalid
    }
  }

  save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify([...this.tokens], null, 2));
    } catch (err) {
      console.error('Failed to save pairing tokens:', err);
    }
  }

  addToken(token) {
    if (!token) return;
    this.tokens.add(token);
    this.save();
  }

  isValid(token) {
    return this.tokens.has(token);
  }

  clear() {
    this.tokens.clear();
    this.save();
  }
}
