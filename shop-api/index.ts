import { productRoutes } from "./src/routes/products.ts";
import { cartRoutes } from "./src/routes/cart.ts";
import { corsHeaders } from "./src/cors.ts";

const server = Bun.serve({
  port: 3000,
  routes: {
    "/health": {
      GET: () => Response.json({
        status: "ok",
        service: "shop-api",
        timestamp: new Date().toISOString()
      }, { headers: corsHeaders }),
    },
    ...productRoutes,
    ...cartRoutes,
  },
  fetch(req) {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
});

console.log(`Shop API running at http://localhost:${server.port}`);
