import fs from 'fs';
import path from 'path';

const CONFIG_FILE = path.join(__dirname, '../../../data/status_config.json');

// Ensure data dir exists
const DATA_DIR = path.dirname(CONFIG_FILE);
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface StatusConfig {
    channelId: string;
    messageId: string;
}

export function loadStatusConfig(): StatusConfig | null {
    if (!fs.existsSync(CONFIG_FILE)) return null;
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
}

export function saveStatusConfig(config: StatusConfig) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}
