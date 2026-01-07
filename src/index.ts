import * as dotenv from "dotenv";
import process from "process";
import { Proxy } from "./proxy/Proxy.js";
import { config } from "./config.js";
dotenv.config();
import { Logger } from "./logger.js";
import { PROXY_BRANDING } from "./meta.js";
import { PluginManager } from "./proxy/pluginLoader/PluginManager.js";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ImageEditor } from "./proxy/skins/ImageEditor.js";

const logger = new Logger("Launcher");
let proxy: Proxy;

global.CONFIG = config;
config.adapter.useNatives = config.adapter.useNatives ?? true;

logger.info("ライブラリを読み込んでいます...");
await ImageEditor.loadLibraries(config.adapter.useNatives);

logger.info("プラグインを読み込んでいます...");
const pluginManager = new PluginManager(join(dirname(fileURLToPath(import.meta.url)), "plugins"));
global.PLUGIN_MANAGER = pluginManager;
await pluginManager.loadPlugins();

proxy = new Proxy(config.adapter, pluginManager);
pluginManager.proxy = proxy;

logger.info(`${PROXY_BRANDING} を起動しています...`);
await proxy.init();
global.PROXY = proxy;
