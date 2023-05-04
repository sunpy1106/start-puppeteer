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

async function fetchExtensionData(page, extension_id) {
  try{

    
    const extensionUrl = `https://chrome.google.com/webstore/detail/${extension_id}`;
    console.log(`Fetching data for ${extensionUrl}`);
    await page.goto(extensionUrl);
    await page.waitForSelector("h1.e-f-w", { timeout: 15000 });

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
                /Average rating (\d+(?:\.\d+)?)/
              );
              return ratingMatch ? ratingMatch[1] : "0.0";
            },
            "0.0"
          );

    const userCount = await safeEvaluate(
      page,
      "span.e-f-ih",
      (el) => el.innerText,
      "N/A"
    );

    const extensionData = {
      extension_id,
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

    return extensionData;
  } catch (error) {
    console.error(`Error fetching data for extension ${extension_id}: ${error.message}`);
    return {}; // 返回空对象或默认值，以便其他插件页面的爬取不受影响
  }
}

async function fetchRelatedExtensions(page, extension_id) {
  const extensionUrl = `https://chrome.google.com/webstore/detail/${extension_id}`;
  await page.goto(extensionUrl);

  // 等待额外的时间，以便 JavaScript 生成相关扩展模块的内容
  await page.waitForTimeout(5000);

  // 查找具有相关扩展的元素
  const relatedExtensionsSelector = "div.webstore-test-wall-tile";
  const relatedExtensionsExist = await page.$(relatedExtensionsSelector, {
    timeout: 5000,
  });

  if (relatedExtensionsExist) {
    const relatedExtensions = await page.$$eval(
      relatedExtensionsSelector,
      (elements) =>
        elements
          .map((el) => el.getAttribute("data-ua")) // 直接获取 extension_id
          .filter((extension_id) => extension_id) // 使用 filter 函数过滤掉空值
          .map((extension_id) => ({ extension_id })) // 将过滤后的 extension_id 重新包装为对象
    );

    return relatedExtensions;
  } else {
    console.error("Related extensions module not found.");
    return [];
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports.handler = async function (request, response, context) {
  const pluginId = request.queries.pluginId;
  if (!pluginId) {
    throw new Error('Plugin ID is required.');
  }

  try {
    const browser =  await puppeteer.launch({
      headless: true,
      args: [
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--disable-setuid-sandbox",
        "--no-first-run",
        "--no-zygote",
        "--no-sandbox",
      ],
    });

    const mainPage = await browser.newPage();
    const mainExtensionData = await fetchExtensionData(mainPage, pluginId);
    console.log("Main extension data:", mainExtensionData);

    // 获取相关扩展信息
    const relatedExtensions = await fetchRelatedExtensions(mainPage, pluginId);
    console.log("Related extensions:", relatedExtensions);
    const relatedExtensionsData = [];
    relatedExtensionsData.push(mainExtensionData);
    const topTenRelatedExtensions = relatedExtensions.slice(0, 10);
    
    const page = await browser.newPage();
    for (const relatedExtension of topTenRelatedExtensions) {
      const extensionData = await fetchExtensionData(page, relatedExtension.extension_id);
      if(Object.keys(extensionData).length >0 ){
        relatedExtensionsData.push(extensionData);
      }
    }
    await page.close();
    console.log("the response:", relatedExtensionsData);
    response.setStatusCode(200);
    response.setHeader('content-type', 'application/json');
    response.send(JSON.stringify(relatedExtensionsData));
    await mainPage.close();
    await browser.close();
    sleep(1000);
  } catch (err) {
    response.setStatusCode(500);
    response.setHeader('content-type', 'text/plain');
    response.send(err.message);
    console.error("Error:", err.message);
  }

};
