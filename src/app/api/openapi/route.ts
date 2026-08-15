import { NextResponse } from "next/server";
import { openApiDocument } from "@/lib/openapi";

/** The OpenAPI document, served for Swagger UI and for any client generator. */
export function GET() {
  return NextResponse.json(openApiDocument);
}
