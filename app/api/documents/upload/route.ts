import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { ALLOWED_DOCUMENT_TYPES, DOCUMENT_PREFIX, MAX_DOCUMENT_BYTES } from "@/lib/dal/documents";
import { getCurrentUser } from "@/lib/dal/session";

// Issues short-lived client tokens so files upload straight from the browser to Vercel Blob
// (no 4.5 MB function body limit). The document is recorded by registerDocumentAction afterwards.
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const user = await getCurrentUser();
        if (!user || user.role === "engineer") throw new Error("Not allowed");
        if (!/^documents\/(opportunity|project|client)\/[a-f0-9]{24}\//.test(pathname) || !pathname.startsWith(DOCUMENT_PREFIX)) {
          throw new Error("Invalid path");
        }
        return {
          allowedContentTypes: ALLOWED_DOCUMENT_TYPES,
          maximumSizeInBytes: MAX_DOCUMENT_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
