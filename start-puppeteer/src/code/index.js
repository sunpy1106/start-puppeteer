const puppeteer = require('puppeteer');

async function safeEvaluate(page, selector, callback, defaultValue) {
  try {
    const result = await page.$eval(selector, callback);
    return result;
  } catch (error) {
    console.error(`Error while fetching "${selector}": ${error.message}`);
    return defaultValue;
  }
}

async function getPluginInfo(pluginId) {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-setuid-sandbox',
      '--no-first-run',
      '--no-zygote',
      '--no-sandbox'
    ]
  });

  const page = await browser.newPage();
  await page.emulateTimezone('Asia/Shanghai');
  const pluginUrl = `https://chrome.google.com/webstore/detail/${pluginId}`;
  console.log('pluginUrl:',pluginUrl);
  await page.goto(pluginUrl);
  await page.waitForSelector("h1.e-f-w", { timeout: 5000 });
  const title = await safeEvaluate(
    page,
    "h1.e-f-w",
    (el) => el.innerText,
    "N/A"
  );
  const websiteLink = await safeEvaluate(
    page,
    "a.e-f-y",
    (el) => el.href,
    "N/A"
  );
  const description = await safeEvaluate(
    page,
    ".C-b-p-j-Oa",
    (el) => el.innerText,
    "N/A"
  );
  const lastUpdated = await safeEvaluate(
    page,
    "span.h-C-b-p-D-xh-hh",
    (el) => el.innerText,
    "N/A"
  );

  const type = await safeEvaluate(
    page,
    "span.e-f-yb-w a.e-f-y",
    (el) => el.innerText,
    "N/A"
  );
  const version = await safeEvaluate(
    page,
    "span.h-C-b-p-D-md",
    (el) => el.innerText,
    "N/A"
  );
  const language = await safeEvaluate(
    page,
    "span.h-C-b-p-D-Ba",
    (el) => el.innerText,
    "N/A"
  );

  const ratingCount = await safeEvaluate(
    page,
    "div.nAtiRe",
    (el) => el.innerText,
    "N/A"
  );

  // 根据 ratingCount 设置 ratingValue
  const ratingValue =
    ratingCount === "0"
      ? "0"
      : await safeEvaluate(
          page,
          "div.Y89Uic",
          (el) => {
            const titleAttribute = el.getAttribute("title");
            const ratingMatch = titleAttribute.match(
              /Average rating (\d+\.\d+)/
            );
            return ratingMatch ? ratingMatch[1] : "N/A";
          },
          "N/A"
        );

  const userCount = await safeEvaluate(
    page,
    "span.e-f-ih",
    (el) => el.innerText,
    "N/A"
  );

  const extensionData = {
    title,
    websiteLink,
    ratingValue,
    ratingCount,
    userCount,
    description,
    lastUpdated,
    type,
    version,
    language,
  };
  await browser.close();
  return extensionData;
}

module.exports.handler = function (request, response, context) {
  console.log('the request objecct:',request);
  const pluginId = request.queries.pluginId;
  if (!pluginId) {
    throw new Error('Plugin ID is required.');
    return;
  }else{
    console.log('pluginId:',pluginId);
  }
  (async () => {
    
    const pluginInfo = await getPluginInfo( pluginId);
   
    response.setStatusCode(200);
    response.setHeader('content-type', 'application/json');
    response.send(JSON.stringify(pluginInfo));
  })().catch(err => {
    response.setStatusCode(500);
    response.setHeader('content-type', 'text/plain');

    response.send(err.message);
  });
};
