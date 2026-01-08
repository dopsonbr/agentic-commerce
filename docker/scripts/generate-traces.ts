import { chromium, Browser, Page } from 'playwright';

const CHAT_UI_URL = 'http://localhost:5173';
const MCP_TOOLS_URL = 'http://localhost:3001';
const SHOP_API_URL = 'http://localhost:3000';

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateApiTraces() {
  console.log('🔄 Generating API traces...');

  // Direct API calls to shop-api
  console.log('  → Fetching all products from shop-api');
  await fetch(`${SHOP_API_URL}/api/products`);

  console.log('  → Searching for "hammer" in shop-api');
  await fetch(`${SHOP_API_URL}/api/products?search=hammer`);

  console.log('  → Getting product details for SKU 100001');
  await fetch(`${SHOP_API_URL}/api/products/100001`);

  console.log('  → Getting product details for SKU 100004');
  await fetch(`${SHOP_API_URL}/api/products/100004`);

  // MCP tools calls (these will call shop-api internally)
  console.log('  → Calling search_products tool via mcp-tools');
  await fetch(`${MCP_TOOLS_URL}/tools/search_products/call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: 'trace-gen-1', args: { query: 'drill' } }),
  });

  console.log('  → Calling search_products tool for "safety"');
  await fetch(`${MCP_TOOLS_URL}/tools/search_products/call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: 'trace-gen-2', args: { query: 'safety' } }),
  });

  console.log('  → Calling get_product_details tool');
  await fetch(`${MCP_TOOLS_URL}/tools/get_product_details/call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: 'trace-gen-1', args: { sku: '100003' } }),
  });

  console.log('  → Setting customer ID');
  await fetch(`${MCP_TOOLS_URL}/tools/set_customer_id/call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: 'trace-gen-1', args: { customerId: 'trace-customer-001' } }),
  });
}

async function generateBrowserTraces() {
  console.log('\n🌐 Generating browser traces via Playwright...');

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Visit chat-ui to generate Faro traces
    console.log('  → Opening chat-ui');
    await page.goto(CHAT_UI_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await delay(2000);

    // Type in the chat input if available
    const chatInput = page.locator('input[type="text"], textarea').first();
    if (await chatInput.isVisible()) {
      console.log('  → Sending chat message: "show me hammers"');
      await chatInput.fill('show me hammers');
      await chatInput.press('Enter');
      await delay(3000);

      console.log('  → Sending chat message: "show me drills"');
      await chatInput.fill('show me drills');
      await chatInput.press('Enter');
      await delay(3000);
    }

    // Visit shop-ui to generate Angular/Faro/NgRx traces
    console.log('  → Opening shop-ui');
    await page.goto('http://localhost:4200', { waitUntil: 'networkidle', timeout: 30000 });
    await delay(3000); // Wait for Angular to bootstrap and load products

    // Interact with shop-ui to trigger NgRx actions
    console.log('  → Triggering NgRx actions in shop-ui');

    // Look for product cards and click "Add to Cart" buttons
    const addToCartButtons = page.locator('button:has-text("Add to Cart"), button:has-text("Add"), .add-to-cart');
    const buttonCount = await addToCartButtons.count();
    console.log(`  → Found ${buttonCount} add-to-cart buttons`);

    if (buttonCount > 0) {
      // Click first few add-to-cart buttons to trigger [Cart] actions
      for (let i = 0; i < Math.min(buttonCount, 3); i++) {
        console.log(`  → Clicking add-to-cart button ${i + 1}`);
        await addToCartButtons.nth(i).click();
        await delay(1000);
      }
    }

    // Look for cart link/button and click it
    const cartLink = page.locator('a:has-text("Cart"), button:has-text("Cart"), .cart-icon, [routerLink*="cart"]').first();
    if (await cartLink.isVisible()) {
      console.log('  → Opening cart');
      await cartLink.click();
      await delay(2000);
    }

    // Go back to products
    const productsLink = page.locator('a:has-text("Products"), a:has-text("Shop"), .nav-link, [routerLink="/"]').first();
    if (await productsLink.isVisible()) {
      console.log('  → Navigating back to products');
      await productsLink.click();
      await delay(2000);
    }

    // Reload to trigger [Products] Load actions
    console.log('  → Reloading to trigger product load');
    await page.reload();
    await delay(3000);

    console.log('  ✓ Browser traces generated');

  } catch (error) {
    console.error('  ⚠ Browser trace generation failed:', error instanceof Error ? error.message : error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function generateLoadTraces() {
  console.log('\n📊 Generating load traces...');

  const requests: Promise<Response>[] = [];

  // Generate multiple concurrent requests
  for (let i = 0; i < 10; i++) {
    requests.push(
      fetch(`${SHOP_API_URL}/api/products`),
      fetch(`${MCP_TOOLS_URL}/tools/search_products/call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: `load-test-${i}`,
          args: { query: ['hammer', 'drill', 'saw', 'level', 'tape'][i % 5] }
        }),
      })
    );
  }

  console.log(`  → Sending ${requests.length} concurrent requests...`);
  await Promise.all(requests);
  console.log('  ✓ Load traces generated');
}

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  Trace Data Generator for Agentic Commerce');
  console.log('═══════════════════════════════════════════════\n');

  try {
    await generateApiTraces();
    await generateBrowserTraces();
    await generateLoadTraces();

    console.log('\n═══════════════════════════════════════════════');
    console.log('  ✅ Trace generation complete!');
    console.log('═══════════════════════════════════════════════');
    console.log('\nView traces at:');
    console.log('  • Grafana: http://localhost:3003');
    console.log('  • Tempo API: http://localhost:3200/api/search');
    console.log('  • Service graph metrics: http://localhost:9090/api/v1/query?query=traces_service_graph_request_total');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
