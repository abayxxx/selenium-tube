require('dotenv').config();

const {Builder, By, until} = require('selenium-webdriver');
const fs = require('fs');
const path = require('path');
const chrome = require('selenium-webdriver/chrome');
const { exit } = require('process');

/**
 * @typedef VideoProps
 * @property {string} href
 * @property {string} title
 */

 const dirPath = path.join(process.env.DOWNLOAD_PATH);

 const options = new chrome.Options();
 options.setUserPreferences({
   download: {
     default_directory: dirPath,
   },
 });
 options.addArguments(
   "--log-level=3",
   "--disable-gpu",
   "--hide-scrollbars",
   "--disable-logging"
 );

 const checkUnfinishDownload = async () => {
    const concurrent = parseInt(process.env.CONCURRENT ?? 1);
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        let files = fs.readdirSync(dirPath);
        const unfinishFile = files.filter(
          (file) => path.extname(file).toLowerCase() === ".crdownload"
        );
  
        if (!unfinishFile.length) {
          resolve();
          clearInterval(interval);
          return;
        }
  
        if (unfinishFile.length <= concurrent || unfinishFile.length >= concurrent  ) {
          console.log(
            `[Waiting] Wait unfinished download ${unfinishFile.length} videos (max: ${concurrent})`
          );
          if (unfinishFile.length !== concurrent) resolve();
        }
      }, 1500);
    });
  };
  
 ( async () => {
    if (!process.env.PLAYLIST_URL) throw new Error("Plase provide playlist url");
  
    const driver = await new Builder()
      .forBrowser("chrome")
      .setChromeOptions(options)
      .build();
  
    await driver.get(process.env.PLAYLIST_URL);
  
    await driver.sleep(2500);
    const getVideo = await driver.findElements(
      By.xpath("//a[@id='video-title']")
    );
  
    /**
     * @type {VideoProps[]}
     */
    const videos = [];
  
    for (let i = 0; i < getVideo.length; i++) {
      const href = await getVideo[i].getAttribute("href");
      const title = await getVideo[i].getAttribute("title");
      console.log(`Get data -> Video Title : ${title}`);
  
      videos.push({
        title,
        href,
      });
    }
  
    const start = parseInt(process.env.START ? process.env.START : 0);
    const end = parseInt(process.env.END ? process.env.END : videos.length );

    for (let i = start; i < end; i++) {
      await driver.sleep(2500);
      await driver
        .navigate()
        .to("https://id.savefrom.net/76");
      console.log(`[Processing] Submit -> Video Title : ${videos[i].title}`);
      const inputEl = await driver.findElement(By.id("sf_url"));
      const submitEl = await driver.findElement(By.id("sf_submit"));
      // const formatEl = await driver.findElement(
      //   By.xpath(`//option[@value='${process.env.VIDEO_RES}']`)
      // );
      await inputEl.sendKeys(videos[i].href);
      // await formatEl.click();
      await submitEl.click();
      console.log(
        `[Processing] Download -> Video Title : ${videos[i].title} on https://loader.to/ server`
      );
  
      await checkUnfinishDownload();
  
      await driver.sleep(2000);
      await driver.wait(
        until.elementIsNotVisible(
          driver.findElement(By.xpath('//div[@id="sf_indicator_box"]'))
        )
      );
  
      const downloadEl = await driver.findElement(
        By.xpath('//a[contains(@class, "download-icon")]')
      );
  
      /**
       * Using executeScript because there is a iframe when click the download button
       * https://stackoverflow.com/a/37880313/9905881
       */
      await driver.executeScript("arguments[0].click();", downloadEl)
      console.log(`[Downloading] Video ${videos[i].title}`);
    }
  
    await checkUnfinishDownload();
    await driver.quit();
    console.log(`[Success] All videos successfully downloaded`);
  })().catch(async err => {
    console.error(err);
  });
  