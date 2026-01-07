import { ConnectType, ServerGlobals } from "./types.js";
import * as Chunk from "prismarine-chunk";
import * as Block from "prismarine-block";
import * as Registry from "prismarine-registry";
import vec3 from "vec3";
import { Client } from "minecraft-protocol";
import { ClientState, ConnectionState } from "./types.js";
import { auth, ServerDeviceCodeResponse } from "./auth.js";
import { config } from "./config.js";
import { handleCommand } from "./commands.js";
import { getTokenProfileTheAltening } from "./auth_thealtening.js";
import { resolve4, resolveSrv } from "dns/promises";

const { Vec3 } = vec3 as any;
const Enums = PLUGIN_MANAGER.Enums;
const Util = PLUGIN_MANAGER.Util;
const MAX_LIFETIME_CONNECTED = 10 * 60 * 1000,
  MAX_LIFETIME_AUTH = 5 * 60 * 1000,
  MAX_LIFETIME_LOGIN = 1 * 60 * 1000;
const REGISTRY = Registry.default("1.8"),
  McBlock = (Block as any).default("1.8"),
  LOGIN_CHUNK = generateSpawnChunk().dump();
const logger = new PLUGIN_MANAGER.Logger("PlayerHandler");

let SERVER: ServerGlobals = null;

export function hushConsole() {
  const ignoredMethod = () => { };
  global.console.info = ignoredMethod;
  global.console.warn = ignoredMethod;
  global.console.error = ignoredMethod;
  global.console.debug = ignoredMethod;
}

export async function isValidIp(ip: string): Promise<boolean> {
  const hostPart = ip.split(":")[0];
  const ipFormat = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = hostPart.match(ipFormat);

  if (match) {
    const octets = match.slice(1).map(Number);
    if (octets.some((octet) => isNaN(octet) || octet < 0 || octet > 255)) return false;

    const [a, b, c, d] = octets;
    if (
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      a === 127 ||
      a === 0 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224 ||
      (a === 192 && b === 88 && c === 99) ||
      (a === 198 && b >= 18 && b <= 19) ||
      (a === 192 && b === 52 && c === 193)
    )
      return false;

    return true;
  }

  const hostnameRegex = /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/;
  if (!hostnameRegex.test(hostPart)) return false;

  const lowerHost = hostPart.toLowerCase();
  if (
    ["localhost", "local", "0.0.0.0", "127.0.0.1", "::1"].includes(lowerHost) ||
    lowerHost.endsWith(".local") ||
    lowerHost.endsWith(".localhost") ||
    lowerHost.endsWith(".internal") ||
    lowerHost.endsWith(".intranet") ||
    lowerHost.endsWith(".localdomain") ||
    lowerHost.endsWith(".lan")
  )
    return false;

  try {
    if (lowerHost.startsWith("_minecraft._tcp.")) {
      const srvRecords = await resolveSrv(hostPart);
      return srvRecords && srvRecords.length > 0;
    }

    const addresses = await resolve4(hostPart);
    if (addresses && addresses.length > 0) {
      return addresses.some((addr) => {
        const ipMatch = addr.match(ipFormat);
        if (ipMatch) {
          const [a, b, c, d] = ipMatch.slice(1).map(Number);
          return !(a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || a === 127 || a === 0);
        }
        return false;
      });
    }
  } catch (e) {
    if (!lowerHost.startsWith("_minecraft._tcp.")) {
      try {
        const srvRecords = await resolveSrv(`_minecraft._tcp.${hostPart}`);
        return srvRecords && srvRecords.length > 0;
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  return true;
}

function validateSessionObject(session: any) {
  if (typeof session !== "object" || session === null) return false;

  const hasValidAuth = typeof session.auth === "string";
  const hasValidUsername = typeof session.username === "string";
  const hasValidExpiresOn = typeof session.expires_on === "number" || session.expires_on instanceof Date;

  if (!hasValidAuth || !hasValidUsername || !hasValidExpiresOn) return false;

  if (typeof session.session !== "object" || session.session === null) return false;

  const { session: sessionData } = session;

  const hasValidAccessToken = typeof sessionData.accessToken === "string";
  const hasValidClientToken = typeof sessionData.clientToken === "string";

  if (!hasValidAccessToken || !hasValidClientToken) return false;

  if (typeof sessionData.selectedProfile !== "object" || sessionData.selectedProfile === null) return false;

  const hasValidProfileId = typeof sessionData.selectedProfile.id === "string";
  const hasValidProfileName = typeof sessionData.selectedProfile.name === "string";

  if (!hasValidProfileId || !hasValidProfileName) return false;

  // Ensure no extra properties exist
  const validSessionKeys = ["auth", "username", "expires_on", "session"];
  const validSessionDataKeys = ["accessToken", "clientToken", "selectedProfile"];
  const validSelectedProfileKeys = ["id", "name"];

  if (Object.keys(session).some((key) => !validSessionKeys.includes(key))) return false;
  if (Object.keys(sessionData).some((key) => !validSessionDataKeys.includes(key))) return false;
  if (Object.keys(sessionData.selectedProfile).some((key) => !validSelectedProfileKeys.includes(key))) return false;

  return true;
}

export function setSG(svr: ServerGlobals) {
  SERVER = svr;
}

export function disconectIdle() {
  SERVER.players.forEach((client) => {
    if (client.state == ConnectionState.AUTH && Date.now() - client.lastStatusUpdate > MAX_LIFETIME_AUTH) {
      client.gameClient.end("Microsoftでのログイン待機中にタイムアウトしました");
    } else if (client.state == ConnectionState.SUCCESS && Date.now() - client.lastStatusUpdate > MAX_LIFETIME_CONNECTED) {
      client.gameClient.end(Enums.ChatColor.RED + "チャットで接続したいサーバーのIPを入力してください。");
    }
  });
}

export function handleConnect(client: ClientState, additionalParams: { ip: string; port: number; mode: ConnectType; session: any }) {
  client.gameClient.write("login", {
    entityId: 1,
    gameMode: 2,
    dimension: 1,
    difficulty: 1,
    maxPlayers: 1,
    levelType: "flat",
    reducedDebugInfo: false,
  });
  client.gameClient.write("map_chunk", {
    x: 0,
    z: 0,
    groundUp: true,
    bitMap: 0xffff,
    chunkData: LOGIN_CHUNK,
  });
  client.gameClient.write("position", {
    x: 0,
    y: 65,
    z: 8.5,
    yaw: -90,
    pitch: 0,
    flags: 0x01,
  });

  client.gameClient.write("playerlist_header", {
    header: JSON.stringify({
      text: ` ${Enums.ChatColor.GOLD}EaglerProxy 認証サーバー `,
    }),
    footer: JSON.stringify({
      text: `${Enums.ChatColor.GOLD}指示をお待ちください。`,
    }),
  });

  if (additionalParams != null && additionalParams.ip != null && additionalParams.port != null) {
    sendMessage(client.gameClient, `${Enums.ChatColor.GREEN}サーバー ${Enums.ChatColor.GOLD}${additionalParams.ip}:${additionalParams.port}${Enums.ChatColor.GREEN} に自動接続しています。`);
  }
  if (additionalParams && additionalParams.session && additionalParams.session.expires_on - Date.now() > 24 * 60 * 60 * 1000) {
    sendMessage(
      client.gameClient,
      `${Enums.ChatColor.RED}あなたのセッショントークンはあと ${Math.floor((additionalParams.session.expires_on - Date.now()) / 1000 / 60)} 分間有効ですが、24時間以内に期限切れになります新しいセッションURLを取得してください。`
    );
  }
  onConnect(client, additionalParams);
}

export function awaitCommand(client: Client, filter: (msg: string) => boolean): Promise<string> {
  return new Promise<string>((res, rej) => {
    const onMsg = (packet) => {
      if (filter(packet.message)) {
        client.removeListener("chat", onMsg);
        client.removeListener("end", onEnd);
        res(packet.message);
      }
    };
    const onEnd = () => rej("Client disconnected before promise could be resolved");
    client.on("chat", onMsg);
    client.on("end", onEnd);
  });
}

export function sendMessage(client: Client, msg: string) {
  client.write("chat", {
    message: JSON.stringify({ text: msg }),
    position: 1,
  });
}

export function sendCustomMessage(client: Client, msg: string, color: string, ...components: { text: string; color: string }[]) {
  client.write("chat", {
    message: JSON.stringify(
      components.length > 0
        ? {
          text: msg,
          color,
          extra: components,
        }
        : { text: msg, color }
    ),
    position: 1,
  });
}

export function sendChatComponent(client: Client, component: any) {
  client.write("chat", {
    message: JSON.stringify(component),
    position: 1,
  });
}

export function sendMessageWarning(client: Client, msg: string) {
  client.write("chat", {
    message: JSON.stringify({
      text: msg,
      color: "yellow",
    }),
    position: 1,
  });
}

export function sendMessageLogin(client: Client, url: string, token: string) {
  client.write("chat", {
    message: JSON.stringify({
      text: "",
      color: Enums.ChatColor.RESET,
      extra: [
        {
          text: "こちらのリンク",
          color: "gold",
          clickEvent: {
            action: "open_url",
            value: `${url}/?otc=${token}`,
          },
          hoverEvent: {
            action: "show_text",
            value: Enums.ChatColor.GOLD + "クリックして新しいウィンドウで開く",
          },
        },
        {
          text: " を開いて、Microsoftで認証してください。",
        },
      ],
    }),
    position: 1,
  });
}

export function updateState(client: Client, newState: "CONNECTION_TYPE" | "AUTH_THEALTENING" | "AUTH" | "SERVER", uri?: string, code?: string) {
  switch (newState) {
    case "CONNECTION_TYPE":
      client.write("playerlist_header", {
        header: JSON.stringify({
          text: ` ${Enums.ChatColor.GOLD}EaglerProxy 認証サーバー `,
        }),
        footer: JSON.stringify({
          text: `${Enums.ChatColor.RED}接続タイプを選択してください: 1 = オンライン, 2 = オフライン, 3 = TheAltening`,
        }),
      });
      break;
    case "AUTH_THEALTENING":
      client.write("playerlist_header", {
        header: JSON.stringify({
          text: ` ${Enums.ChatColor.GOLD}EaglerProxy 認証サーバー `,
        }),
        footer: JSON.stringify({
          text: `${Enums.ChatColor.RED}panel.thealtening.com/#generator${Enums.ChatColor.GOLD} | ${Enums.ChatColor.RED}/login <alt_token>`,
        }),
      });
      break;
    case "AUTH":
      if (code == null || uri == null) throw new Error("Missing code/uri required for title message type AUTH");
      client.write("playerlist_header", {
        header: JSON.stringify({
          text: ` ${Enums.ChatColor.GOLD}EaglerProxy 認証サーバー `,
        }),
        footer: JSON.stringify({
          text: `${Enums.ChatColor.RED}${uri}${Enums.ChatColor.GOLD} | コード: ${Enums.ChatColor.RED}${code}`,
        }),
      });
      break;
    case "SERVER":
      client.write("playerlist_header", {
        header: JSON.stringify({
          text: ` ${Enums.ChatColor.GOLD}EaglerProxy 認証サーバー `,
        }),
        footer: JSON.stringify({
          text: `${Enums.ChatColor.RED}/join <ip>${config.allowCustomPorts ? " [ポート]" : ""}`,
        }),
      });
      break;
  }
}

export function printSessionMessage(client: ClientState, session: any, proxySession = PLUGIN_MANAGER.proxy.players.get(client.gameClient.username)) {
  const stringifiedSession = JSON.stringify(session),
    url = new URL(proxySession.ws.httpRequest.url, "wss://" + proxySession.ws.httpRequest.headers.host);
  url.searchParams.set("session", stringifiedSession);
  url.protocol = "wss:";
  const secureURL = new URL("/eagpaas/link", "http://" + proxySession.ws.httpRequest.headers.host);
  secureURL.searchParams.set("url", url.toString());
  const http = secureURL.toString();
  secureURL.protocol = "https:";
  const https = secureURL.toString();

  sendChatComponent(client.gameClient, {
    text: "ログインしましたこのアカウントを引き続き使用するには、こちらのサーバーURLを使用してください（各リンクを試してください）: ",
    color: "green",
    extra: [
      {
        text: "[https]",
        color: "gold",
        hoverEvent: {
          action: "show_text",
          value: Enums.ChatColor.GOLD + "クリックしてコピー",
        },
        clickEvent: {
          action: "open_url",
          value: https,
        },
      },
      { text: " ", color: "green" },
      {
        text: "[http]",
        color: "gold",
        hoverEvent: {
          action: "show_text",
          value: Enums.ChatColor.GOLD + "クリックしてコピー",
        },
        clickEvent: {
          action: "open_url",
          value: http,
        },
      },
    ],
  });
  sendChatComponent(client.gameClient, {
    text: "このURL（サーバーURLを含む）を他人に教えると、アカウントが乗っ取られる可能性があります。\n" + "他人が見ている場所で上記のリンクを操作しないでください。",
    color: "red",
  });
}

// assuming that the player will always stay at the same pos
export function playSelectSound(client: Client) {
  client.write("named_sound_effect", {
    soundName: "note.hat",
    x: 8.5,
    y: 65,
    z: 8.5,
    volume: 100,
    pitch: 63,
  });
}

export async function onConnect(client: ClientState, metadata?: { ip: string; port: number; mode?: ConnectType; session?: object }) {
  try {
    client.state = ConnectionState.AUTH;
    client.lastStatusUpdate = Date.now();

    client.gameClient.on("packet", (packet, meta) => {
      if (meta.name == "client_command" && packet.payload == 1) {
        client.gameClient.write("statistics", {
          entries: [],
        });
      }
    });

    if (config.showDisclaimers) {
      sendMessageWarning(client.gameClient, `警告: このプロキシは任意の1.8.9サーバーへの接続を許可します。プレイに大きな問題は見られませんが、EaglercraftXが一部のアンチチートに検知される可能性があることに注意してください。`);
      await new Promise((res) => setTimeout(res, 2000));

      sendMessageWarning(
        client.gameClient,
        `Hypixelプレイヤーへの勧告: このプロキシはHypixelの「許可されていない改造(Disallowed Modifications)」カテゴリに該当します。参加すると、アカウントに異議申し立て不可能な罰則が適用されることになります。自己責任でプレイしてください`
      );
      await new Promise((res) => setTimeout(res, 2000));
    }

    if (config.authentication.enabled) {
      sendCustomMessage(client.gameClient, "このインスタンスはパスワードで保護されています。 /password <パスワード> でサインインしてください", "gold");
      const password = await awaitCommand(client.gameClient, (msg) => msg.startsWith("/password "));
      if (password === `/password ${config.authentication.password}`) {
        sendCustomMessage(client.gameClient, "インスタンスへのサインインに成功しました", "green");
      } else {
        client.gameClient.end(Enums.ChatColor.RED + "パスワードが違います");
        return;
      }
    }

    let chosenOption: ConnectType | null = null;
    if (!metadata || metadata.mode == null) {
      sendCustomMessage(client.gameClient, "接続方法を選択", "gray");
      sendChatComponent(client.gameClient, {
        text: "1) ",
        color: "gold",
        extra: [
          {
            text: "1) オンラインサーバーに接続する (Minecraftアカウントが必要)",
            color: "white",
          },
        ],
        hoverEvent: {
          action: "show_text",
          value: Enums.ChatColor.GOLD + "クリックして選択",
        },

        clickEvent: {
          action: "run_command",
          value: "$1",
        },
      });
      sendChatComponent(client.gameClient, {
        text: "2) ",
        color: "gold",
        extra: [
          {
            text: "2) オフラインサーバーに接続する (Minecraftアカウント不要)",
            color: "white",
          },
        ],
        hoverEvent: {
          action: "show_text",
          value: Enums.ChatColor.GOLD + "クリックして選択",
        },
        clickEvent: {
          action: "run_command",
          value: "$2",
        },
      });
      sendChatComponent(client.gameClient, {
        text: "3) ",
        color: "gold",
        extra: [
          {
            text: "3) TheAlteningアカウントプールを使用してオンラインサーバーに接続する (Minecraftアカウント不要)",
            color: "white",
          },
        ],
        hoverEvent: {
          action: "show_text",
          value: Enums.ChatColor.GOLD + "クリックして選択",
        },
        clickEvent: {
          action: "run_command",
          value: "$3",
        },
      });
      sendCustomMessage(client.gameClient, "上記のオプションから選択してください（1 = オンライン, 2 = オフライン, 3 = TheAltening）。クリックするか、リストの番号を直接入力してください。", "green");
      updateState(client.gameClient, "CONNECTION_TYPE");

      while (true) {
        const option = await awaitCommand(client.gameClient, (msg) => true);
        switch (option.replace(/\$/gim, "")) {
          default:
            sendCustomMessage(client.gameClient, `"${option}" の意味がわかりません。有効なオプションを入力してください`, "red");
            break;
          case "1":
            chosenOption = ConnectType.ONLINE;
            break;
          case "2":
            chosenOption = ConnectType.OFFLINE;
            break;
          case "3":
            chosenOption = ConnectType.THEALTENING;
            break;
        }
        if (chosenOption != null) {
          if (option.startsWith("$")) playSelectSound(client.gameClient);
          break;
        }
      }
    } else chosenOption = metadata.mode;

    if (chosenOption == ConnectType.ONLINE) {
      if (!metadata || !metadata.session) {
        if (config.showDisclaimers) {
          sendMessageWarning(
            client.gameClient,
            `警告: 参加に必要なセッショントークンを取得するために、Microsoft経由でのログインを求められます。アカウントに関するデータは保存されません。透明性の向上のため、このプロキシのソースコードはGithubで公開されています。`
          );
        }
        await new Promise((res) => setTimeout(res, 2000));
      }

      client.lastStatusUpdate = Date.now();
      let errored = false,
        savedAuth;
      if (!metadata || !metadata.session) {
        const quit = { quit: false },
          authHandler = auth(quit),
          codeCallback = (code: ServerDeviceCodeResponse) => {
            updateState(client.gameClient, "AUTH", code.verification_uri, code.user_code);
            sendMessageLogin(client.gameClient, code.verification_uri, code.user_code);
          };
        client.gameClient.once("end", (res) => {
          quit.quit = true;
        });

        authHandler.once("error", (err) => {
          if (!client.gameClient.ended) client.gameClient.end(err.message);
          errored = true;
        });
        if (errored) return;
        authHandler.on("code", codeCallback);
        await new Promise((res) =>
          authHandler.once("done", (result) => {
            savedAuth = result;
            res(result);
          })
        );
        sendMessage(client.gameClient, Enums.ChatColor.BRIGHT_GREEN + "Minecraftへのログインに成功しました");
      }

      client.state = ConnectionState.SUCCESS;
      client.lastStatusUpdate = Date.now();
      let host: string, port: number;
      if (metadata && metadata.ip != null && metadata.port != null) {
        host = metadata.ip;
        port = metadata.port;
      } else {
        updateState(client.gameClient, "SERVER");
        sendMessage(client.gameClient, `参加するサーバーを指定してください。 ${Enums.ChatColor.GOLD}/join <ip>${config.allowCustomPorts ? " [ポート]" : ""}${Enums.ChatColor.RESET}`);
        while (true) {
          const msg = await awaitCommand(client.gameClient, (msg) => msg.startsWith("/join")),
            parsed = msg.split(/ /gi, 3);
          if (parsed.length < 2) sendMessage(client.gameClient, `接続先サーバーを指定してください。 ${Enums.ChatColor.GOLD}/join <ip>${config.allowCustomPorts ? " [ポート]" : ""}${Enums.ChatColor.RESET}`);
          else if (parsed.length > 2 && isNaN(parseInt(parsed[2])))
            sendMessage(client.gameClient, `有効なポート番号を入力してください ${Enums.ChatColor.GOLD}/join <ip>${config.allowCustomPorts ? " [ポート]" : ""}${Enums.ChatColor.RESET}`);
          else {
            host = parsed[1];
            if (parsed.length > 2) port = parseInt(parsed[2]);
            if (port != null && !config.allowCustomPorts) {
              sendCustomMessage(client.gameClient, "カスタムサーバーポートの使用は許可されていません /join <ip>" + (config.allowCustomPorts ? " [ポート]" : ""), "red");
              host = null;
              port = null;
            } else {
              if (host.match(/^(?:\*\.)?((?!hypixel\.net$)[^.]+\.)*hypixel\.net$/) && config.disallowHypixel) {
                sendCustomMessage(
                  client.gameClient,
                  "許可されていないサーバーです。接続を拒否しましたHypixelはEaglercraftクライアントを誤検知することが知られているため、接続を許可していません。 /join <ip>" + (config.allowCustomPorts ? " [ポート]" : ""),
                  "red"
                );
              } else if (!(await isValidIp(host))) {
                sendCustomMessage(client.gameClient, "無効なサーバーアドレスです /join <ip>" + (config.allowCustomPorts ? " [ポート]" : ""), "red");
                host = null;
                port = null;
              } else {
                port = port ?? 25565;
                break;
              }
            }
          }
        }
      }

      validateSessionObject(savedAuth);
      const session = (metadata ? metadata.session : undefined) || {
        auth: "mojang",
        username: savedAuth.selectedProfile.name,
        expires_on: savedAuth.expiresOn,
        session: {
          accessToken: savedAuth.accessToken,
          clientToken: savedAuth.selectedProfile.id,
          selectedProfile: {
            id: savedAuth.selectedProfile.id,
            name: savedAuth.selectedProfile.name,
          },
        },
      };
      // printSessionMessage(client, session);

      try {
        sendChatComponent(client.gameClient, {
          text: `${savedAuth.selectedProfile.name} (あなたのMinecraftアカウント) として参加していますプロキシコマンドの一覧を表示するには `,
          color: "aqua",
          extra: [
            {
              text: "/eag-help",
              color: "gold",
              hoverEvent: {
                action: "show_text",
                value: Enums.ChatColor.GOLD + "クリックしてコマンドを実行",
              },
              clickEvent: {
                action: "run_command",
                value: "/eag-help",
              },
            },
            {
              text: " を実行してください。",
              color: "aqua",
            },
          ],
        });
        logger.info(`Player ${client.gameClient.username} is attempting to connect to ${host}:${port} under their Minecraft account's username (${savedAuth.selectedProfile.name}) using online mode!`);
        const player = PLUGIN_MANAGER.proxy.players.get(client.gameClient.username);
        player.on("vanillaPacket", (packet, origin) => {
          if (origin == "CLIENT" && packet.name == "chat" && (packet.params.message as string).toLowerCase().startsWith("/eag-") && !packet.cancel) {
            packet.cancel = true;
            handleCommand(player, packet.params.message as string);
          }
        });

        (player as any)._onlineSession = session;

        await player.switchServers({
          host: host,
          port: port,
          version: "1.8.8",
          username: savedAuth.selectedProfile.name,
          auth: "mojang",
          keepAlive: false,
          session: {
            accessToken: savedAuth.accessToken,
            clientToken: savedAuth.selectedProfile.id,
            selectedProfile: {
              id: savedAuth.selectedProfile.id,
              name: savedAuth.selectedProfile.name,
            },
          },
          skipValidation: true,
          hideErrors: true,
        });
      } catch (err) {
        if (!client.gameClient.ended) {
          client.gameClient.end(
            Enums.ChatColor.RED +
            `サーバー切り替え中にエラーが発生しました: ${err.message}${err.code == "ENOTFOUND" ? (host.includes(":") ? `\n${Enums.ChatColor.GRAY}ヒント: IP内の : をスペースに置き換えてみてください。` : "\nそのIPは有効ですか？") : ""}`
          );
        }
      }
    } else if (chosenOption == ConnectType.THEALTENING) {
      const THEALTENING_GET_TOKEN_URL = "panel.thealtening.com/#generator";
      client.state = ConnectionState.AUTH;
      client.lastStatusUpdate = Date.now();
      updateState(client.gameClient, "AUTH_THEALTENING");

      if (config.showDisclaimers) {
        sendMessageWarning(client.gameClient, `警告: TheAlteningのアカウントプールを使用することを選択しました。アカウントは共有されているため、参加しようとしているサーバーで禁止されている可能性があることに注意してください。`);
      }
      sendChatComponent(client.gameClient, {
        text: "ログインして、こちらでアルトトークンを生成してください ",
        color: "white",
        extra: [
          {
            text: THEALTENING_GET_TOKEN_URL,
            color: "gold",
            hoverEvent: {
              action: "show_text",
              value: Enums.ChatColor.GOLD + "クリックして新しいウィンドウで開く",
            },
            clickEvent: {
              action: "open_url",
              value: `https://${THEALTENING_GET_TOKEN_URL}`,
            },
          },
          {
            text: "。その後、ログインするために ",
            color: "white",
          },
          {
            text: "/login <alt_token>",
            color: "gold",
            hoverEvent: {
              action: "show_text",
              value: Enums.ChatColor.GOLD + "Copy me to chat!",
            },
            clickEvent: {
              action: "suggest_command",
              value: `/login <alt_token>`,
            },
          },
          {
            text: " を実行してください。",
            color: "white",
          },
        ],
      });

      let appendOptions: any;
      while (true) {
        const tokenResponse = await awaitCommand(client.gameClient, (msg) => msg.toLowerCase().startsWith("/login")),
          splitResponse = tokenResponse.split(/ /gim, 2).slice(1);
        if (splitResponse.length != 1) {
          sendChatComponent(client.gameClient, {
            text: "無効な使い方です次のようにコマンドを使用してください: ",
            color: "red",
            extra: [
              {
                text: "/login <alt_token>",
                color: "gold",
                hoverEvent: {
                  action: "show_text",
                  value: Enums.ChatColor.GOLD + "チャットにコピー",
                },
                clickEvent: {
                  action: "suggest_command",
                  value: `/login <alt_token>`,
                },
              },
              {
                text: ".",
                color: "red",
              },
            ],
          });
        } else {
          const token = splitResponse[0];
          if (!token.endsWith("@alt.com")) {
            sendChatComponent(client.gameClient, {
              text: "有効なトークンを提供してください（取得は",
              color: "red",
              extra: [
                {
                  text: "こちら",
                  color: "white",
                  hoverEvent: {
                    action: "show_text",
                    value: Enums.ChatColor.GOLD + "クリックして新しいウィンドウで開く",
                  },
                  clickEvent: {
                    action: "open_url",
                    value: `https://${THEALTENING_GET_TOKEN_URL}`,
                  },
                },
                {
                  text: "）。 ",
                  color: "red",
                },
                {
                  text: "/login <alt_token>",
                  color: "gold",
                  hoverEvent: {
                    action: "show_text",
                    value: Enums.ChatColor.GOLD + "チャットにコピー",
                  },
                  clickEvent: {
                    action: "suggest_command",
                    value: `/login <alt_token>`,
                  },
                },
                {
                  text: ".",
                  color: "red",
                },
              ],
            });
          } else {
            sendCustomMessage(client.gameClient, "アルトトークンを検証中...", "gray");
            try {
              appendOptions = await getTokenProfileTheAltening(token);
              sendCustomMessage(client.gameClient, `アルトトークンの検証とセッションプロファイルの取得に成功しました ${appendOptions.username} としてサーバーに参加します。`, "green");
              break;
            } catch (err) {
              sendChatComponent(client.gameClient, {
                text: `TheAlteningのサーバーがエラー (${err.message}) を返しました。もう一度お試しください `,
                color: "red",
                extra: [
                  {
                    text: "/login <alt_token>",
                    color: "gold",
                    hoverEvent: {
                      action: "show_text",
                      value: Enums.ChatColor.GOLD + "チャットにコピー",
                    },
                    clickEvent: {
                      action: "suggest_command",
                      value: `/login <alt_token>`,
                    },
                  },
                  {
                    text: ".",
                    color: "red",
                  },
                ],
              });
            }
          }
        }
      }

      client.state = ConnectionState.SUCCESS;
      client.lastStatusUpdate = Date.now();
      let host: string, port: number;
      if (metadata && metadata.ip != null && metadata.port != null) {
        host = metadata.ip;
        port = metadata.port;
      } else {
        updateState(client.gameClient, "SERVER");
        sendMessage(client.gameClient, `参加するサーバーを指定してください。 ${Enums.ChatColor.GOLD}/join <ip>${config.allowCustomPorts ? " [ポート]" : ""}${Enums.ChatColor.RESET}`);
        while (true) {
          const msg = await awaitCommand(client.gameClient, (msg) => msg.startsWith("/join")),
            parsed = msg.split(/ /gi, 3);
          if (parsed.length < 2) sendMessage(client.gameClient, `接続先サーバーを指定してください。 ${Enums.ChatColor.GOLD}/join <ip>${config.allowCustomPorts ? " [ポート]" : ""}${Enums.ChatColor.RESET}`);
          else if (parsed.length > 2 && isNaN(parseInt(parsed[2])))
            sendMessage(client.gameClient, `有効なポート番号を入力してください ${Enums.ChatColor.GOLD}/join <ip>${config.allowCustomPorts ? " [ポート]" : ""}${Enums.ChatColor.RESET}`);
          else {
            host = parsed[1];
            if (parsed.length > 2) port = parseInt(parsed[2]);
            if (port != null && !config.allowCustomPorts) {
              sendCustomMessage(client.gameClient, "カスタムサーバーポートの使用は許可されていません /join <ip>" + (config.allowCustomPorts ? " [ポート]" : ""), "red");
              host = null;
              port = null;
            } else if (!(await isValidIp(host))) {
              sendCustomMessage(client.gameClient, "無効なサーバーアドレスです /join <ip>" + (config.allowCustomPorts ? " [ポート]" : ""), "red");
              host = null;
              port = null;
            } else {
              port = port ?? 25565;
              break;
            }
          }
        }
      }
      try {
        sendChatComponent(client.gameClient, {
          text: `${appendOptions.username} (TheAlteningアカウント) として参加していますプロキシコマンドの一覧を表示するには `,
          color: "aqua",
          extra: [
            {
              text: "/eag-help",
              color: "gold",
              hoverEvent: {
                action: "show_text",
                value: Enums.ChatColor.GOLD + "クリックしてコマンドを実行",
              },
              clickEvent: {
                action: "run_command",
                value: "/eag-help",
              },
            },
            {
              text: " を実行してください。",
              color: "aqua",
            },
          ],
        });
        logger.info(`Player ${client.gameClient.username} is attempting to connect to ${host}:${port} under their TheAltening alt token's username (${appendOptions.username}) using TheAltening mode!`);
        const player = PLUGIN_MANAGER.proxy.players.get(client.gameClient.username);
        player.on("vanillaPacket", (packet, origin) => {
          if (origin == "CLIENT" && packet.name == "chat" && (packet.params.message as string).toLowerCase().startsWith("/eag-") && !packet.cancel) {
            packet.cancel = true;
            handleCommand(player, packet.params.message as string);
          }
        });
        (player as any)._onlineSession = {
          ...appendOptions,
          isTheAltening: true,
        };

        await player.switchServers({
          host: host,
          port: port,
          version: "1.8.8",
          keepAlive: false,
          skipValidation: true,
          hideErrors: true,
          ...appendOptions,
        });
      } catch (err) {
        if (!client.gameClient.ended) {
          client.gameClient.end(
            Enums.ChatColor.RED +
            `Something went wrong whilst switching servers: ${err.message}${err.code == "ENOTFOUND" ? (host.includes(":") ? `\n${Enums.ChatColor.GRAY}Suggestion: Replace the : in your IP with a space.` : "\nIs that IP valid?") : ""}`
          );
        }
      }
    } else {
      client.state = ConnectionState.SUCCESS;
      client.lastStatusUpdate = Date.now();
      let host: string, port: number;
      if (metadata && metadata.ip != null && metadata.port != null) {
        host = metadata.ip;
        port = metadata.port;
      } else {
        updateState(client.gameClient, "SERVER");
        sendMessage(client.gameClient, `参加するサーバーを指定してください。 ${Enums.ChatColor.GOLD}/join <ip>${config.allowCustomPorts ? " [ポート]" : ""}${Enums.ChatColor.RESET}`);
        while (true) {
          const msg = await awaitCommand(client.gameClient, (msg) => msg.startsWith("/join")),
            parsed = msg.split(/ /gi, 3);
          if (parsed.length < 2) sendMessage(client.gameClient, `接続先サーバーを指定してください。 ${Enums.ChatColor.GOLD}/join <ip>${config.allowCustomPorts ? " [ポート]" : ""}${Enums.ChatColor.RESET}`);
          else if (parsed.length > 2 && isNaN(parseInt(parsed[2])))
            sendMessage(client.gameClient, `有効なポート番号を入力してください ${Enums.ChatColor.GOLD}/join <ip>${config.allowCustomPorts ? " [ポート]" : ""}${Enums.ChatColor.RESET}`);
          else {
            host = parsed[1];
            if (parsed.length > 2) port = parseInt(parsed[2]);
            if (port != null && !config.allowCustomPorts) {
              sendCustomMessage(client.gameClient, "カスタムサーバーポートの使用は許可されていません /join <ip>" + (config.allowCustomPorts ? " [ポート]" : ""), "red");
              host = null;
              port = null;
            } else if (!(await isValidIp(host))) {
              sendCustomMessage(client.gameClient, "無効なサーバーアドレスです /join <ip>" + (config.allowCustomPorts ? " [ポート]" : ""), "red");
              host = null;
              port = null;
            } else {
              port = port ?? 25565;
              break;
            }
          }
        }
      }
      try {
        sendChatComponent(client.gameClient, {
          text: `${client.gameClient.username} (Eaglercraftユーザー名) として参加していますプロキシコマンドの一覧を表示するには `,
          color: "aqua",
          extra: [
            {
              text: "/eag-help",
              color: "gold",
              hoverEvent: {
                action: "show_text",
                value: Enums.ChatColor.GOLD + "クリックしてコマンドを実行",
              },
              clickEvent: {
                action: "run_command",
                value: "/eag-help",
              },
            },
            {
              text: " を実行してください。",
              color: "aqua",
            },
          ],
        });
        logger.info(`Player ${client.gameClient.username} is attempting to connect to ${host}:${port} under their Eaglercraft username (${client.gameClient.username}) using offline mode!`);
        const player = PLUGIN_MANAGER.proxy.players.get(client.gameClient.username);
        player.on("vanillaPacket", (packet, origin) => {
          if (origin == "CLIENT" && packet.name == "chat" && (packet.params.message as string).toLowerCase().startsWith("/eag-") && !packet.cancel) {
            packet.cancel = true;
            handleCommand(player, packet.params.message as string);
          }
        });

        await player.switchServers({
          host: host,
          port: port,
          auth: "offline",
          username: client.gameClient.username,
          version: "1.8.8",
          keepAlive: false,
          skipValidation: true,
          hideErrors: true,
        });
      } catch (err) {
        if (!client.gameClient.ended) {
          client.gameClient.end(
            Enums.ChatColor.RED +
            `Something went wrong whilst switching servers: ${err.message}${err.code == "ENOTFOUND" ? (host.includes(":") ? `\n${Enums.ChatColor.GRAY}Suggestion: Replace the : in your IP with a space.` : "\nIs that IP valid?") : ""}`
          );
        }
      }
    }
  } catch (err) {
    if (!client.gameClient.ended) {
      logger.error(`Error whilst processing user ${client.gameClient.username}: ${err.stack || err}`);
      client.gameClient.end(Enums.ChatColor.YELLOW + "リクエスト処理中にエラーが発生しました。再接続してください。");
    }
  }
}

export function generateSpawnChunk(): Chunk.PCChunk {
  const chunk = new (Chunk.default(REGISTRY))(null) as Chunk.PCChunk;
  chunk.initialize(() => new McBlock(REGISTRY.blocksByName.air.id, REGISTRY.biomesByName.the_end.id, 0));
  chunk.setBlock(new Vec3(8, 64, 8), new McBlock(REGISTRY.blocksByName.sea_lantern.id, REGISTRY.biomesByName.the_end.id, 0));
  chunk.setBlock(new Vec3(8, 67, 8), new McBlock(REGISTRY.blocksByName.barrier.id, REGISTRY.biomesByName.the_end.id, 0));
  chunk.setBlock(new Vec3(7, 65, 8), new McBlock(REGISTRY.blocksByName.barrier.id, REGISTRY.biomesByName.the_end.id, 0));
  chunk.setBlock(new Vec3(7, 66, 8), new McBlock(REGISTRY.blocksByName.barrier.id, REGISTRY.biomesByName.the_end.id, 0));
  chunk.setBlock(new Vec3(9, 65, 8), new McBlock(REGISTRY.blocksByName.barrier.id, REGISTRY.biomesByName.the_end.id, 0));
  chunk.setBlock(new Vec3(9, 66, 8), new McBlock(REGISTRY.blocksByName.barrier.id, REGISTRY.biomesByName.the_end.id, 0));
  chunk.setBlock(new Vec3(8, 65, 7), new McBlock(REGISTRY.blocksByName.barrier.id, REGISTRY.biomesByName.the_end.id, 0));
  chunk.setBlock(new Vec3(8, 66, 7), new McBlock(REGISTRY.blocksByName.barrier.id, REGISTRY.biomesByName.the_end.id, 0));
  chunk.setBlock(new Vec3(8, 65, 9), new McBlock(REGISTRY.blocksByName.barrier.id, REGISTRY.biomesByName.the_end.id, 0));
  chunk.setBlock(new Vec3(8, 66, 9), new McBlock(REGISTRY.blocksByName.barrier.id, REGISTRY.biomesByName.the_end.id, 0));
  // chunk.setBlockLight(new Vec3(8, 65, 8), 15);
  chunk.setBlockLight(new Vec3(8, 66, 8), 15);
  return chunk;
}
