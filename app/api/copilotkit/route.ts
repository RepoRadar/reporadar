import {
  CopilotRuntime,
  GoogleGenerativeAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

const serviceAdapter = new GoogleGenerativeAIAdapter({
  apiKey: process.env.GOOGLE_API_KEY,
  model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
});

const runtimeInstance = new CopilotRuntime();

export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime: runtimeInstance,
    serviceAdapter,
    endpoint: "/api/copilotkit",
  });
  return handleRequest(req);
};
