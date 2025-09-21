export {};

type NodeInfo = {
  id: number;
  node_name: string;
  isp_name?: string;
  isp_code?: number;
};

type DigRecord = {
  node_id: number;
  node_name: string;
  origin_ip: string;
  records?: Array<{ name: string; value: string }>;
};

type DigTaskResult = {
  done?: boolean;
  list?: DigRecord[];
};

type DigTaskMap = Record<string, DigTaskResult>;

declare const Bun: {
  write(path: string, data: string): Promise<void>;
};

declare const process: {
  env: Record<string, string | undefined>;
};

const KEY = process.env.KEY ?? "YOUR_API_KEY";
const RESULT_PATH = "./resultv4.json";
const TARGET_HOSTS = [
  "szminorshort.weixin.qq.com",
  "szlong.weixin.qq.com",
  "shextshort.weixin.qq.com",
  "short.weixin.qq.com",
  "mllong.weixin.qq.com",
  "szextshort.weixin.qq.com",
  "szaxshort.weixin.qq.com",
  "quic.weixin.qq.com",
  "szquic.weixin.qq.com",
  "mlshort.mixpay.wechatpay.cn",
  "udns.weixin.qq.com",
  "short.mixpay.wechatpay.cn",
  "mlshort.snspay.wechatpay.cn",
  "szshort.mixpay.wechatpay.cn",
  "shshort.snspay.wechatpay.cn",
  "mlextshort.weixin.qq.com",
  "short.pay.weixin.qq.com",
  "shquic.weixin.qq.com",
  "long.weixin.qq.com",
  "mlminorshort.weixin.qq.com",
  "mlshort.pay.weixin.qq.com",
  "shshort.pay.weixin.qq.com",
  "shshort.mixpay.wechatpay.cn",
  "mlaxshort.weixin.qq.com",
  "mlshort.weixin.qq.com",
  "szdisas.weixin.qq.com",
  "mldisas.weixin.qq.com",
  "shdisas.weixin.qq.com",
  "minorshort.weixin.qq.com",
  "szshort.weixin.qq.com",
  "szshort.pay.weixin.qq.com",
  "extshort.weixin.qq.com",
  "axshort.weixin.qq.com",
  "short.snspay.wechatpay.cn",
  "szshort.snspay.wechatpay.cn",
  "mlquic.weixin.qq.com",
  "hkshort.pay.weixin.qq.com",
  "hkshort.weixin.qq.com",
  "hklong.weixin.qq.com",
  "sgminorshort.wechat.com",
  "sgshort.pay.wechat.com",
  "hkshort.mixpay.wechatpay.cn",
  "sgquic.wechat.com",
  "hkquic.weixin.qq.com",
  "hkshort.snspay.wechatpay.cn",
  "sgshort.snspay.wechat.com",
  "sgshort.wechat.com",
  "hkaxshort.weixin.qq.com",
  "hkextshort.weixin.qq.com",
  "dns.wechat.com",
  "sglong.wechat.com",
  "hkshort6.weixin.qq.com",
  "hkdisas.weixin.qq.com",
  "sgaxshort.wechat.com",
  "hkminorshort.weixin.qq.com",
  "sgshort.mixpay.wechat.com",
  "mmsns.hk.wechat.com",
  "szsupport.weixin.qq.com",
  "api.weixin.qq.com",
  "wxapp.tc.qq.com",
  "mmsns.qpic.cn",
  "c6.y.qq.com",
  "shmmsns.qpic.cn",
  "szmmsns.qpic.cn",
  "mlsupport.weixin.qq.com",
  "weixin110.qq.com",
  "shp.qlogo.cn",
  "wx.qlogo.cn",
  "weixin.qq.com",
  "vweixinf.tc.qq.com",
  "support.weixin.qq.com",
  "weixinc2c.tc.qq.com",
  "hksupport.weixin.qq.com",
  "wxsnsdythumb.wxs.qq.com",
  "mp.weixin.qq.com",
  "open.weixin.qq.com",
  "wxsnsdy.wxs.qq.com",
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const readJsonSafely = <T>(raw: unknown, fallback: T): T => {
  return (raw && typeof raw === "object" ? (raw as T) : fallback) ?? fallback;
};

const getNodeList = async (): Promise<NodeInfo[]> => {
  const response = await fetch(`https://api.boce.com/v3/node/list?key=${KEY}`);
  const raw = await response.json();
  const data = readJsonSafely<{ data?: { list?: NodeInfo[] } }>(raw, {});
  const list = Array.isArray(data.data?.list) ? data.data?.list : [];
  return list.filter((item): item is NodeInfo => typeof item?.id === "number");
};

const createDigTask = async (host: string, nodeIds: string): Promise<string | null> => {
  const response = await fetch(
    `https://api.boce.com/v3/task/create/dig?key=${KEY}&host=${encodeURIComponent(host)}&node_ids=${nodeIds}`
  );
  const raw = await response.json();
  const data = readJsonSafely<{ data?: { id?: string } }>(raw, {});
  const id = data.data?.id;
  return typeof id === "string" && id.length > 0 ? id : null;
};

const fetchDigStatus = async (taskId: string): Promise<DigTaskResult> => {
  const response = await fetch(`https://api.boce.com/v3/task/dig/${taskId}?key=${KEY}`);
  const raw = await response.json();
  const data = readJsonSafely<DigTaskResult>(raw, {});
  if (Array.isArray(data.list)) {
    data.list = data.list.filter((item): item is DigRecord => typeof item?.origin_ip === "string");
  } else {
    data.list = [];
  }
  return data;
};

const main = async () => {
  const nodeList = await getNodeList();
  if (!nodeList.length) {
    console.error("未获取到节点列表，请检查 KEY 配置或接口状态。");
    return;
  }
  const nodeListString = nodeList.map((node) => node.id).join(",");
  console.log("节点数:", nodeList.length, "列表:", nodeListString);

  const result: DigTaskMap = {};

  for (const host of TARGET_HOSTS) {
    const taskId = await createDigTask(host, nodeListString);
    if (!taskId) {
      console.warn("创建任务失败:", host);
      continue;
    }
    console.log(`Task Created: ${taskId} - ${host}`);
    for (let i = 0; i < 12; i += 1) {
      await sleep(10_000);
      const status = await fetchDigStatus(taskId);
      if (status.done) {
        console.log("Task Done:", host, status.list?.length ?? 0);
        result[host] = status;
        break;
      }
      if (i === 11) {
        console.warn("任务超时:", host);
      }
    }
  }

  await Bun.write(RESULT_PATH, JSON.stringify(result, null, 2));
  console.log("结果已写入", RESULT_PATH);
};

main().catch((error) => {
  console.error("执行失败:", error);
});
