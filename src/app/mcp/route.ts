import { handleMcpPost, mcpMethodNotAllowed, mcpPreflight } from "@/lib/mcp/handle";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = (request: Request) => handleMcpPost(request);
export const GET = () => mcpMethodNotAllowed();
export const DELETE = () => mcpMethodNotAllowed();
export const OPTIONS = () => mcpPreflight();
