import { dirname, join } from "path";
import { Enums } from "../../proxy/Enums.js";
import { Player } from "../../proxy/Player.js";
import { config } from "./config.js";
import { ConnectType } from "./types.js";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { isValidIp } from "./utils.js";
import { serverStore } from "./store.js";

const SEPARATOR = "======================================";
const METADATA: {
  name: string;
  id: string;
  version: string;
  entry_point: string;
  requirements: any[];
  load_after: any[];
  incompatibilities: any[];
} = JSON.parse((await fs.readFile(join(dirname(fileURLToPath(import.meta.url)), "metadata.json"))).toString());

export function sendPluginChatMessage(client: Player, ...components: { text: string; color: string;[otherFields: string]: any }[]) {
  if (components.length == 0) throw new Error("There must be one or more passed components!");
  else {
    client.ws.send(
      client.serverSerializer.createPacketBuffer({
        name: "chat",
        params: {
          message: JSON.stringify({
            text: "[EagPAAS] ",
            color: "gold",
            extra: components,
          }),
        },
      })
    );
  }
}

export function handleCommand(sender: Player, cmd: string): void {
  switch (cmd.toLowerCase().split(/ /gim)[0]) {
    default:
      sendPluginChatMessage(sender, {
        text: `"${cmd.split(/ /gim, 1)[0]}" は有効なコマンドではありません`,
        color: "red",
      });
      break;
    case "/eag-help":
      helpCommand(sender);
      break;
    case "/eag-toggleparticles":
      toggleParticles(sender);
      break;
    case "/eag-switchservers":
      switchServer(cmd, sender);
      break;
    case "/server":
    case "/sv":
      handleServerCommand(sender, cmd);
      break;
  }
}

export function helpCommand(sender: Player) {
  sendPluginChatMessage(sender, {
    text: SEPARATOR,
    color: "yellow",
  });
  sendPluginChatMessage(sender, {
    text: "利用可能なコマンド:",
    color: "aqua",
  });
  sendPluginChatMessage(sender, {
    text: "/eag-help",
    color: "light_green",
    hoverEvent: {
      action: "show_text",
      value: Enums.ChatColor.GOLD + "クリックしてコマンドを実行",
    },
    clickEvent: {
      action: "run_command",
      value: "/eag-help",
    },
    extra: [
      {
        text: " - コマンド一覧を表示",
        color: "aqua",
      },
    ],
  });
  sendPluginChatMessage(sender, {
    text: "/eag-toggleparticles",
    color: "light_green",
    hoverEvent: {
      action: "show_text",
      value: Enums.ChatColor.GOLD + "クリックしてコマンドを実行",
    },
    clickEvent: {
      action: "run_command",
      value: "/eag-toggleparticles",
    },
    extra: [
      {
        text: " - パーティクル表示の切り替え",
        color: "aqua",
      },
    ],
  });
  sendPluginChatMessage(sender, {
    text: `/eag-switchservers <mode: online|offline> <ip>${config.allowCustomPorts ? " [port]" : ""}`,
    color: "light_green",
    hoverEvent: {
      action: "show_text",
      value: Enums.ChatColor.GOLD + "クリックしてコマンドをチャットに貼り付け",
    },
    clickEvent: {
      action: "suggest_command",
      value: `/eag-switchservers <mode: online|offline> <ip>${config.allowCustomPorts ? " [port]" : ""}`,
    },
    extra: [
      {
        text: " - サーバーを切り替え",
        color: "aqua",
      },
    ],
  });
  sendPluginChatMessage(sender, {
    text: `/server <add|remove|list> ...`,
    color: "light_green",
    hoverEvent: {
      action: "show_text",
      value: Enums.ChatColor.GOLD + "クリックしてコマンドをチャットに貼り付け",
    },
    clickEvent: {
      action: "suggest_command",
      value: `/server `,
    },
    extra: [
      {
        text: " - サーバーブックマークの管理",
        color: "aqua",
      },
    ],
  });
  sendPluginChatMessage(sender, {
    text: `${METADATA.name} バージョン v${METADATA.version} を実行中。`,
    color: "gray",
  });
  sendPluginChatMessage(sender, {
    text: SEPARATOR,
    color: "yellow",
  });
}

export async function handleServerCommand(sender: Player, cmd: string) {
  const args = cmd.split(" ");
  const subCommand = args[1]?.toLowerCase();

  await serverStore.load(); // Load latest data

  if (subCommand === "add") {
    const name = args[2];
    const ip = args[3];
    let port = parseInt(args[4] || "25565");
    let type: ConnectType = ConnectType.ONLINE;

    // Check if the last argument is a mode
    const lastArg = args[args.length - 1]?.toUpperCase();
    if (lastArg === "ONLINE" || lastArg === "OFFLINE") {
      type = lastArg as ConnectType;
      // If port was actually the mode, reset port to default
      if (args[4]?.toUpperCase() === lastArg) {
        port = 25565;
      }
    }

    if (!name || !ip) {
      return sendPluginChatMessage(sender, {
        text: "使用法: /server add <名前> <IP> [ポート] [online/offline]",
        color: "red",
      });
    }

    if (!(await isValidIp(ip))) {
      return sendPluginChatMessage(sender, {
        text: "無効なIPアドレスです。",
        color: "red",
      });
    }

    await serverStore.addServer(sender.username, { name, ip, port, type });
    sendPluginChatMessage(sender, {
      text: `サーバー '${name}' (${ip}:${port}, ${type}) を保存しました！`,
      color: "green",
    });

  } else if (subCommand === "remove") {
    const name = args[2];
    if (!name) {
      return sendPluginChatMessage(sender, {
        text: "使用法: /server remove <名前>",
        color: "red",
      });
    }

    await serverStore.removeServer(sender.username, name);
    sendPluginChatMessage(sender, {
      text: `サーバー '${name}' を削除しました。`,
      color: "green",
    });

  } else if (subCommand === "list") {
    const servers = serverStore.getServers(sender.username);
    if (servers.length === 0) {
      return sendPluginChatMessage(sender, {
        text: "保存されたサーバーはありません。",
        color: "yellow",
      });
    }

    sendPluginChatMessage(sender, {
      text: "=== 保存されたサーバー ===",
      color: "gold",
    });

    for (const server of servers) {
      sendPluginChatMessage(sender, {
        text: `[${server.name}] (${server.type || "ONLINE"})`,
        color: "aqua",
        clickEvent: {
          action: "run_command",
          value: `/connect-bookmark ${server.name}`,
        },
        hoverEvent: {
          action: "show_text",
          value: Enums.ChatColor.GRAY + `${server.ip}:${server.port} に接続`
        },
        extra: [
          {
            text: " [削除]",
            color: "red",
            clickEvent: {
              action: "run_command",
              value: `/server remove ${server.name}`
            },
            hoverEvent: {
              action: "show_text",
              value: Enums.ChatColor.RED + "このサーバーを削除"
            }
          }
        ]
      });
    }

  } else if (subCommand === "join") {
    // /server join <ip> [online/offline] [port]
    const ip = args[2];
    if (!ip) {
      return sendPluginChatMessage(sender, {
        text: "使用法: /server join <IP> [online/offline] [ポート]",
        color: "red",
      });
    }

    let mode = "online";
    let port = "25565";

    for (let i = 3; i < args.length; i++) {
      const arg = args[i].toLowerCase();
      if (arg === "online" || arg === "offline") mode = arg;
      else if (!isNaN(Number(arg))) port = arg;
    }

    // Delegate to switchServer
    return switchServer(`/eag-switchservers ${mode} ${ip} ${port}`, sender);

  } else {
    sendPluginChatMessage(sender, {
      text: "無効なサブコマンドです。add, remove, list が使用できます。",
      color: "red",
    });
  }
}

export function toggleParticles(sender: Player) {
  const listener = (sender as any)._particleListener;
  if (listener != null) {
    sender.removeListener("vanillaPacket", listener);
    (sender as any)._particleListener = undefined;
    sendPluginChatMessage(sender, {
      text: "パーティクル表示を有効にしました！",
      color: "red",
    });
  } else {
    (sender as any)._particleListener = (packet: { name: string; params: any; cancel: boolean }, origin: "SERVER" | "CLIENT") => {
      if (origin == "SERVER") {
        if (packet.name == "world_particles") {
          packet.cancel = true;
        } else if (packet.name == "world_event") {
          if (packet.params.effectId >= 2000) {
            packet.cancel = true;
          }
        }
      }
    };
    sender.on("vanillaPacket", (sender as any)._particleListener);
    sendPluginChatMessage(sender, {
      text: "パーティクル表示を無効にしました（FPS向上）！",
      color: "green",
    });
  }
}

export async function switchServer(cmd: string, sender: Player) {
  if ((sender as any)._serverSwitchLock) {
    return sendPluginChatMessage(sender, {
      text: `現在サーバー切り替え処理中です。しばらくお待ちください！`,
      color: "red",
    });
  }
  let split = cmd.split(/ /gim).slice(1),
    mode = split[0]?.toLowerCase(),
    ip = split[1],
    port = split[2];
  if (mode != "online" && mode != "offline") {
    return sendPluginChatMessage(sender, {
      text: `無効なコマンド形式です - 有効なモードを指定してください！ `,
      color: "red",
      extra: [
        {
          text: `/eag-switchservers <mode: online|offline> <ip>${config.allowCustomPorts ? " [port]" : ""}.`,
          color: "gold",
        },
      ],
    });
  }
  if (ip == null) {
    return sendPluginChatMessage(sender, {
      text: `無効なコマンド形式です - 有効なIPまたはホスト名（例: example.com, 1.2.3.4など）を指定してください！ `,
      color: "red",
      extra: [
        {
          text: `/eag-switchservers <mode: online|offline> <ip>${config.allowCustomPorts ? " [port]" : ""}.`,
          color: "gold",
        },
      ],
    });
  }
  if (port != null && (isNaN(Number(port)) || Number(port) < 1 || Number(port) > 65535)) {
    return sendPluginChatMessage(sender, {
      text: `無効なコマンド形式です - ポート番号は0より大きく65536未満（0～65535）である必要があります！ `,
      color: "red",
      extra: [
        {
          text: `/eag-switchservers <mode: online|offline> <ip>${config.allowCustomPorts ? " [port]" : ""}.`,
          color: "gold",
        },
      ],
    });
  }
  if (port != null && !config.allowCustomPorts) {
    return sendPluginChatMessage(sender, {
      text: `無効なコマンド形式です - このプロキシインスタンスではカスタムサーバーポートは無効化されています！ `,
      color: "red",
      extra: [
        {
          text: `/eag-switchservers <mode: online|offline> <ip>${config.allowCustomPorts ? " [port]" : ""}.`,
          color: "gold",
        },
      ],
    });
  }

  let connectionType = mode == "offline" ? ConnectType.OFFLINE : ConnectType.ONLINE,
    addr = ip,
    addrPort = Number(port);
  if (connectionType == ConnectType.ONLINE) {
    if ((sender as any)._onlineSession == null) {
      sendPluginChatMessage(sender, {
        text: `オフラインモードで接続しているか、オンライン/TheAlteningのセッションがタイムアウトして無効になっています。`,
        color: "red",
      });
      return sendPluginChatMessage(sender, {
        text: `オンラインサーバーに切り替えるには、再接続してオンライン/TheAlteningモードでログインしてください。`,
        color: "red",
      });
    } else {
      if (!(await isValidIp(addr))) {
        return sendPluginChatMessage(sender, {
          text: "このIPは無効です！",
          color: "red",
        });
      }
      const savedAuth = (sender as any)._onlineSession;
      sendPluginChatMessage(sender, {
        text: `(${savedAuth.username} / あなたの ${savedAuth.isTheAltening ? "TheAltening" : "Minecraft"} アカウント名としてサーバーに参加しています)`,
        color: "aqua",
      });
      sendPluginChatMessage(sender, {
        text: "サーバーを切り替えています。しばらくお待ちください...（しばらく経っても接続されない場合、そのサーバーはMinecraftサーバーではない可能性があります。再接続してやり直してください。）",
        color: "gray",
      });
      (sender as any)._serverSwitchLock = true;
      try {
        await sender.switchServers({
          host: addr,
          port: addrPort,
          version: "1.8.8",
          keepAlive: false,
          skipValidation: true,
          hideErrors: true,
          ...savedAuth,
        });
        (sender as any)._serverSwitchLock = false;
      } catch (err) {
        if (sender.state! != Enums.ClientState.DISCONNECTED) {
          sender.disconnect(
            Enums.ChatColor.RED +
            `サーバー切り替え中にエラーが発生しました: ${err.message}${err.code == "ENOTFOUND" ? (addr.includes(":") ? `\n${Enums.ChatColor.GRAY}ヒント: IP内の : をスペースに置き換えてみてください。` : "\nそのIPは有効ですか？") : ""}`
          );
        }
      }
    }
  } else {
    sendPluginChatMessage(sender, {
      text: `(${sender.username} / Eaglercraftユーザー名としてサーバーに参加しています)`,
      color: "aqua",
    });
    sendPluginChatMessage(sender, {
      text: "サーバーを切り替えています。しばらくお待ちください...（しばらく経っても接続されない場合、そのサーバーはオンラインモード専用である可能性があります）",
      color: "gray",
    });
    try {
      (sender as any)._serverSwitchLock = true;
      await sender.switchServers({
        host: addr,
        port: addrPort,
        version: "1.8.8",
        username: sender.username,
        auth: "offline",
        keepAlive: false,
        skipValidation: true,
        hideErrors: true,
      });
      (sender as any)._serverSwitchLock = false;
    } catch (err) {
      if (sender.state! != Enums.ClientState.DISCONNECTED) {
        sender.disconnect(
          Enums.ChatColor.RED +
          `サーバー切り替え中にエラーが発生しました: ${err.message}${err.code == "ENOTFOUND" ? (addr.includes(":") ? `\n${Enums.ChatColor.GRAY}ヒント: IP内の : をスペースに置き換えてみてください。` : "\nそのIPは有効ですか？") : ""}`
        );
      }
    }
  }
}
