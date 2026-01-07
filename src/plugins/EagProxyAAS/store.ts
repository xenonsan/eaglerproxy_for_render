import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { SavedServer } from "./types.js";

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../../data");
const DATA_FILE = path.join(DATA_DIR, "user_servers.json");

export class UserServerStore {
    private data: Record<string, SavedServer[]> = {};

    async load() {
        try {
            await fs.mkdir(DATA_DIR, { recursive: true });
            const content = await fs.readFile(DATA_FILE, "utf-8");
            this.data = JSON.parse(content);
        } catch (err) {
            if (err.code !== "ENOENT") {
                console.error("Failed to load user servers:", err);
            }
            this.data = {};
        }
    }

    async save() {
        try {
            await fs.mkdir(DATA_DIR, { recursive: true });
            await fs.writeFile(DATA_FILE, JSON.stringify(this.data, null, 2), "utf-8");
        } catch (err) {
            console.error("Failed to save user servers:", err);
        }
    }

    getServers(username: string): SavedServer[] {
        return this.data[username] || [];
    }

    async addServer(username: string, server: SavedServer) {
        if (!this.data[username]) {
            this.data[username] = [];
        }
        // Check for duplicate names and update if exists, or push new
        const existingIndex = this.data[username].findIndex((s) => s.name === server.name);
        if (existingIndex >= 0) {
            this.data[username][existingIndex] = server;
        } else {
            this.data[username].push(server);
        }
        await this.save();
    }

    async removeServer(username: string, serverName: string) {
        if (this.data[username]) {
            this.data[username] = this.data[username].filter((s) => s.name !== serverName);
            await this.save();
        }
    }
}

export const serverStore = new UserServerStore();
