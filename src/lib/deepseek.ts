// ============================================================
// DeepSeek API 封装 (OpenAI 兼容 chat/completions)
// 用途: 把非结构化文本 (如招聘职位页公开正文) 交给 DeepSeek 抽成结构化 JSON。
// 仅服务端 / 本地脚本使用, 读取 DEEPSEEK_API_KEY (.env.local), 切勿暴露到前端 bundle。
// 合规: 本封装只做"正文 → 结构化", 不发起任何抓取/登录/绕验证码行为。
// ============================================================

/** DeepSeek API 默认地址 (OpenAI 兼容, 可用 DEEPSEEK_BASE_URL 覆盖) */
const DEEPSEEK_BASE_URL = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
/** 默认模型 (可用 DEEPSEEK_MODEL 覆盖) */
const DEFAULT_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

/** DeepSeek 调用相关错误 (与普通 Error 区分, 便于上层给出友好提示) */
export class DeepSeekError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeepSeekError';
  }
}

/**
 * 读取并校验 DEEPSEEK_API_KEY。缺失时抛出清晰的 DeepSeekError (不崩成栈)。
 */
export function getDeepSeekApiKey(): string {
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  if (!key) {
    throw new DeepSeekError(
      'DEEPSEEK_API_KEY 未设置。请在 .env.local 写入 DEEPSEEK_API_KEY=sk-... ,\n' +
      '  或运行时传入: DEEPSEEK_API_KEY=sk-... bun run scripts/ingest-recruit.ts <输入>',
    );
  }
  return key;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface DeepSeekChatOptions {
  /** 模型名, 缺省读 DEEPSEEK_MODEL 或 deepseek-chat */
  model?: string;
  /** 采样温度, 抽取任务建议低温 (默认 0) */
  temperature?: number;
  /** 是否启用 JSON 输出模式 (response_format: json_object) */
  jsonMode?: boolean;
  /** 失败重试次数 (默认 2, 即最多 3 次尝试) */
  maxRetries?: number;
  /** 单次请求超时毫秒 (默认 60000) */
  timeoutMs?: number;
}

/** 可重试的 HTTP 状态码 (限流 / 服务端临时故障) */
function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 调用 DeepSeek chat/completions, 返回首条回复的纯文本内容。
 * 失败 (网络异常 / 429 / 5xx) 按指数退避重试; 4xx (除 429) 不重试。
 */
export async function deepseekChat(
  messages: ChatMessage[],
  options: DeepSeekChatOptions = {},
): Promise<string> {
  const apiKey = getDeepSeekApiKey();
  const model = options.model || DEFAULT_MODEL;
  const temperature = options.temperature ?? 0;
  const maxRetries = options.maxRetries ?? 2;
  const timeoutMs = options.timeoutMs ?? 60000;

  const body: Record<string, unknown> = { model, messages, temperature };
  if (options.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        const snippet = text.slice(0, 500);
        if (isRetryableStatus(res.status) && attempt < maxRetries) {
          lastErr = new DeepSeekError(`HTTP ${res.status}: ${snippet}`);
          await sleep(500 * 2 ** attempt);
          continue;
        }
        throw new DeepSeekError(`DeepSeek 请求失败 HTTP ${res.status}: ${snippet}`);
      }

      const json = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = json.choices?.[0]?.message?.content;
      if (!content) {
        throw new DeepSeekError('DeepSeek 返回为空 (choices[0].message.content 缺失)');
      }
      return content;
    } catch (err) {
      lastErr = err;
      // 主动 abort / 网络异常: 在还有重试次数时退避重试
      const retryable = !(err instanceof DeepSeekError) || /HTTP (429|5\d\d)/.test(String((err as Error).message));
      if (attempt < maxRetries && retryable) {
        await sleep(500 * 2 ** attempt);
        continue;
      }
      break;
    } finally {
      clearTimeout(timer);
    }
  }

  if (lastErr instanceof DeepSeekError) throw lastErr;
  throw new DeepSeekError(`DeepSeek 调用失败: ${String((lastErr as Error)?.message ?? lastErr)}`);
}

/**
 * 调用 DeepSeek 并把回复解析为 JSON 对象 (启用 json_object 模式)。
 * 解析失败时抛出 DeepSeekError, 并附带原始文本片段便于排查。
 */
export async function deepseekJson<T = unknown>(
  system: string,
  user: string,
  options: DeepSeekChatOptions = {},
): Promise<T> {
  const content = await deepseekChat(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { ...options, jsonMode: true },
  );
  try {
    return JSON.parse(content) as T;
  } catch {
    throw new DeepSeekError(`DeepSeek 返回非合法 JSON: ${content.slice(0, 500)}`);
  }
}
