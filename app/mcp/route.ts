import { handleMcpRequest } from "@/lib/opencode/mcp-server";
import { OpenCodeProvider } from "@/lib/opencode/provider";

function provider() {
  return new OpenCodeProvider({ apiKey: process.env.OPENCODE_GO_API_KEY });
}

export async function POST(request: Request) {
  return handleMcpRequest(request, { provider: provider() });
}

export async function GET(request: Request) {
  return handleMcpRequest(request, { provider: provider() });
}

export async function DELETE(request: Request) {
  return handleMcpRequest(request, { provider: provider() });
}
