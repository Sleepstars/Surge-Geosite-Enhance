export {};

type DigRecord = {
  node_id: number;
  node_name: string;
  origin_ip: string;
  records?: Array<{ name: string; value: string }>;
};

type DigTaskResult = {
  list?: DigRecord[];
};

declare const Bun: {
  file(path: string): { text(): Promise<string> };
  write(path: string, data: string): Promise<void>;
};

const RESULT_PATH = "./resultv4.json";
const OUTPUT_PATH = "wechat-ipv4.list";

const parseResultFile = async (): Promise<Record<string, DigTaskResult>> => {
  const file = Bun.file(RESULT_PATH);
  const text = await file.text();
  try {
    const parsed = JSON.parse(text);
    return (parsed && typeof parsed === "object" ? (parsed as Record<string, DigTaskResult>) : {}) ?? {};
  } catch (error) {
    console.error("解析 JSON 失败", error);
    return {};
  }
};

const isIPv4 = (value: string): boolean => {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(value);
};

const sortIPv4 = (ips: string[]): string[] => {
  return ips.sort((a, b) => {
    const aParts = a.split(".").map(Number);
    const bParts = b.split(".").map(Number);
    for (let i = 0; i < 4; i += 1) {
      const diff = (aParts[i] || 0) - (bParts[i] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  });
};

const buildOutput = (ipMap: Record<string, string[]>): string => {
  const lines: string[] = [];
  for (const ip of sortIPv4(Object.keys(ipMap))) {
    lines.push(`IP-CIDR,${ip}/32`);
    for (const host of ipMap[ip]) {
      lines.push(`\t# ${host}`);
    }
  }
  return lines.join("\n") + "\n";
};

const main = async () => {
  const results = await parseResultFile();
  const ipMap: Record<string, string[]> = {};

  for (const [host, task] of Object.entries(results)) {
    const list = Array.isArray(task?.list) ? task.list : [];
    for (const item of list) {
      const records = Array.isArray(item.records) ? item.records : [];
      for (const record of records) {
        if (!record?.value || !isIPv4(record.value)) continue;
        if (!ipMap[record.value]) {
          ipMap[record.value] = [];
        }
        ipMap[record.value].push(`${host} - ${item.node_name} (${item.origin_ip})`);
      }
    }
  }

  if (!Object.keys(ipMap).length) {
    console.warn("未找到任何 IPv4 记录");
  }

  const output = buildOutput(ipMap);
  await Bun.write(OUTPUT_PATH, output);
  console.log("已写入", OUTPUT_PATH);
};

main().catch((error) => {
  console.error("生成列表失败:", error);
});
