import { createClient } from "@supabase/supabase-js";
import type { SupabaseServerClient } from "../supabase/server.ts";

// Запись запросов настоящего supabase-js. Клиентская библиотека сама строит HTTP-запрос
// (путь, query-строку, заголовки Prefer, тело) — тест перехватывает его на уровне fetch и
// отдаёт заготовленный ответ. Так проверяется именно то, что реально уйдёт в PostgREST, а не
// собственная имитация цепочки вызовов. Самого PostgREST здесь нет: разбор запроса на стороне
// сервера и выполнение SQL эти тесты не проверяют.

export interface RecordedRequest {
  method: string;
  url: URL;
  /** Таблица ('profiles') или null для RPC. */
  table: string | null;
  /** Имя функции ('award_xp') или null для таблицы. */
  rpc: string | null;
  query: URLSearchParams;
  /** Исходная query-строка — по ней видно, что '+' и '/' закодированы. */
  rawSearch: string;
  headers: Record<string, string>;
  body: unknown;
}

export interface MockResponse {
  status?: number;
  body?: unknown;
  /** Для count: 'exact' с HEAD — значение попадёт в Content-Range. */
  count?: number;
}

export type Responder = (request: RecordedRequest) => MockResponse | undefined;

export interface Recorder {
  requests: RecordedRequest[];
  /** Клиент для кода, принимающего supabase параметром. */
  client: SupabaseServerClient;
  /** Подменяет globalThis.fetch и переменные окружения для кода, создающего сервисный клиент сам. Возвращает откат. */
  install(): () => void;
}

const BASE = "http://postgrest.test";

export function createRecorder(responder: Responder = () => undefined): Recorder {
  const requests: RecordedRequest[] = [];

  const recordingFetch: typeof fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url);
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    const rawBody = typeof init?.body === "string" ? init.body : undefined;
    const match = /^\/rest\/v1\/(rpc\/)?([^/]+)$/.exec(url.pathname);
    const request: RecordedRequest = {
      method: (init?.method ?? "GET").toUpperCase(),
      url,
      table: match && !match[1] ? match[2] : null,
      rpc: match && match[1] ? match[2] : null,
      query: url.searchParams,
      rawSearch: url.search,
      headers,
      body: rawBody ? JSON.parse(rawBody) : undefined,
    };
    requests.push(request);

    const mock = responder(request) ?? {};
    let status = mock.status ?? 200;
    const responseHeaders: Record<string, string> = { "content-type": "application/json" };
    if (mock.count !== undefined) responseHeaders["content-range"] = `*/${mock.count}`;
    let body: unknown = mock.body ?? (request.rpc ? null : []);
    // .single(): PostgREST отдаёт объект и 406 (PGRST116), если строк не одна — повторяем это.
    if (request.headers["accept"]?.includes("application/vnd.pgrst.object+json") && Array.isArray(body)) {
      if (body.length === 1) body = body[0];
      else {
        status = 406;
        body = { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: `The result contains ${body.length} rows`, hint: null };
      }
    }
    const payload = request.method === "HEAD" ? null : JSON.stringify(body);
    return new Response(payload, { status, headers: responseHeaders });
  };

  const client = createClient(BASE, "test-anon-key", { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: recordingFetch } });

  return {
    requests,
    client: client as unknown as SupabaseServerClient,
    install() {
      const saved = { fetch: globalThis.fetch, url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
      globalThis.fetch = recordingFetch;
      process.env.NEXT_PUBLIC_SUPABASE_URL = BASE;
      process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
      return () => {
        globalThis.fetch = saved.fetch;
        if (saved.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
        else process.env.NEXT_PUBLIC_SUPABASE_URL = saved.url;
        if (saved.key === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        else process.env.SUPABASE_SERVICE_ROLE_KEY = saved.key;
      };
    },
  };
}
