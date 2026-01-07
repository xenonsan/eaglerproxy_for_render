import { dirname, join } from "path";
import { Enums } from "../../proxy/Enums.js";
import { Player } from "../../proxy/Player.js";
import { config } from "./config.js";
import { ConnectType } from "./types.js";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { isValidIp } from "./utils.js";

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
    text: `${METADATA.name} バージョン v${METADATA.version} を実行中。`,
    color: "gray",
  });
  sendPluginChatMessage(sender, {
    text: SEPARATOR,
    color: "yellow",
  });
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
