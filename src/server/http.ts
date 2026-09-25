import { z } from "zod";
import { NotFoundError } from "./workspace";

/**
 * Shared Route Handler plumbing: JSON responses, zod validation, and consistent
 * error shapes ({ error, issues? }) with the right status codes.
 */

export function route<C>(fn: (req: Request, ctx: C) => Promise<unknown>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      const result = await fn(req, ctx);
      if (result instanceof Response) return result;
      return result === undefined ? new Response(null, { status: 204 }) : Response.json(result);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export function errorResponse(error: unknown): Response {
  if (error instanceof z.ZodError) {
    return Response.json({ error: "Invalid request", issues: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, { status: 400 });
  }
  if (error instanceof SyntaxError) return Response.json({ error: "Body must be valid JSON" }, { status: 400 });
  if (error instanceof NotFoundError) return Response.json({ error: error.message }, { status: 404 });
  if (error instanceof RangeError) return Response.json({ error: error.message }, { status: 422 });
  console.error(error);
  return Response.json({ error: "Something went wrong on our side" }, { status: 500 });
}

export async function body<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  return schema.parse(await req.json());
}

export function query<T extends z.ZodType>(req: Request, schema: T): z.infer<T> {
  return schema.parse(Object.fromEntries(new URL(req.url).searchParams));
}

export function created(data: unknown) {
  return Response.json(data, { status: 201 });
}

export const schemas = {
  meetingType: z.enum(["Sales", "Product", "Engineering", "Research", "Investor", "1:1", "Interview", "Onboarding", "Marketing"]),
  template: z.enum(["general", "sales", "research", "one-on-one", "interview", "product"]),
  platform: z.enum(["zoom", "google-meet", "teams", "upload"]),
  isoDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
};
