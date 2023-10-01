

import puppeteer from 'puppeteer-extra';

import { executablePath } from 'puppeteer';

import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin())

import * as fs from 'fs';

import request from 'request';
import getUrls from 'get-urls';
import path from 'path';

const imgFolder = "img";

const __dirname = path.resolve();



process.on('uncaughtException', (error) => {
	console.log('Uncaught Exception:', error, error.stack);
  });
  
//   process.on('unhandledRejection', (reason, promise) => {
// 	console.log('Custom Unhandled Promise Rejection:', reason, reason);
// 	console.log('stack:', reason.stack);
//   });
process.on('unhandledRejection', (reason, promise, event) => {
	if (reason.message.includes('detached Frame')) {
	  console.log('Frame has been detached, handle gracefully');
	} else {
	  console.log('Custom Unhandled Promise Rejection:', reason, reason);
	  console.log('stack:', reason.stack);
	  event.preventDefault();
	}
  });




const targetDomains = Array(
	"awsevents.com"
);
const crawlUrls = [
	// "https://whoisretargeting.me/",
	// "https://techcrunch.com/category/startups/",
	// "https://www.entrepreneur.com/topic/tech-startups",
	// "https://www.buzzfeed.com/",
	"https://www.quora.com/What-website-has-the-most-amount-of-Google-ads",
	// "https://www.theverge.com/tech",
	// "https://www.cnn.com/2023/09/22/tech/generative-ai-corporate-policy/index.html",
	// "https://www.geekwire.com/",
	"https://www.cnet.com/tech/",
	// "https://www.bbc.com/news/technology",
	"https://news.yahoo.com/iphone-15-pro-max-5-040000020.html",
	// "https://www.gamepur.com/news/playstation-announces-showcase-date-for-may",
	"https://www.techopedia.com/chatgpt-is-now-connected-to-the-internet-but-is-it-any-smarter",
	// "https://www.newsweek.com/ten-wild-ways-people-are-using-chatgpts-new-vision-feature-1831069",
	// "https://www.sportskeeda.com/fortnite/i-part-layoffs-fortnite-employee-laid-fans-emotional-rollercoaster",


	// "https://www.dictionary.com/browse/adv",
  ];





// entry point
(async () =>
{
	if (fs.existsSync(imgFolder) == false)
		fs.mkdirSync(imgFolder);

	// let results = await DoTask("https://www.marcus.com/");
	// let results = await DoTask("https://www.appliancesconnection.com/");
	// let results = await DoTask("https://www.marcus.com/");
	let results = await DoTask("https://reinvent.awsevents.com/");

	console.log("Results: ", results);
})();




function getParamIfAvailable(url, key)
{
	var parsedUrl = new URL(url);

	var val = parsedUrl.searchParams.get(key);

	var val2 = parsedUrl.searchParams.get("doesn't exist");

	return val;
}

function doesUrlContainTargetDomain(url)
{
	var parsedUrl = new URL(url);

	var matchingTargetDomains = targetDomains.filter(x =>
	{
		return parsedUrl.host.toLowerCase().indexOf(x) != -1;
	});

	return matchingTargetDomains.length > 0;
}

async function DoTask(url)
{
	let results = {
		"url": url,
		"date": new Date().toString(),
		"known": Array(),
		"unknown": Array()
	};

	const browser = await puppeteer.launch({
		args:
			[
				"--disable-web-security",
				"--no-sandbox",
				"--disable-features=site-per-process",
				"--disable-setuid-sandbox",
				"--disable-features=IsolateOrigins",
				"--disable-site-isolation-trials"
			],
		userDataDir: __dirname + "\\chrome-profile",
		headless: false,
		executablePath: executablePath()
	});


	const page = await browser.newPage();

	await page.goto(url);


	const patterns = Array(
		new RegExp(/var clickTag = "(.*)"/, "gi"),
		// new RegExp(/destinationUrl:[ \t\r\n]+"(.*)"/, "gi"),
		new RegExp(/destinationUrl:[ \t\r\n]+["']([^"']*)["']/, "gi"),
		// new RegExp(/adurl(=|\\x3d)([^&"]+)/, "gi"),
		new RegExp(/initvars.default_click = "(.*)"/, "gi")
	);

	// For debugging, will break results if true
	const downloadAllAds = false;

	for (var url of crawlUrls)
	{
		try
		{
			await page.goto(url);
		}
		catch(err)
		{
			console.error(err);
			console.log("Skipping broken url");
			continue;
		}

		await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

		// Wait for ads to load, possibly redundant
		await sleep(3000);

		await autoScroll(page);

		await sleep(1000);

		var frameIndex = 0;

		// for testing to see what the hidden page looks like
		await page.screenshot({ path: imgFolder + "/" + GetTempFileName() + ".png" });


		// Iterate the frames
		for (const frame of page.mainFrame().childFrames())
		{
			// Get the content of the iframe as a string
			let adEntry =
			{
				destination: "no url found",
				adImage: "empty or invisible iframe"
			};

			let isKnown = false;


			let adUrl = await frame.$eval("#google_image_div a", x => x.href).catch(x => { return null; });


			// If the ad is an embeded image instead of a canvas
			if (adUrl != null)
			{
				console.log("Ad url is:", adUrl);

				if (doesUrlContainTargetDomain(adUrl) == false)
				{
					adUrl = getParamIfAvailable(adUrl, "adurl") || adUrl;

					if (doesUrlContainTargetDomain(adUrl) == false)
					{
						adUrl = getParamIfAvailable(adUrl, "url") || adUrl;
					}
				}

				let imgSrc = await frame.$eval("#google_image_div a img", x => x.src).catch(x => { return null; });

				if (imgSrc != null)
				{
					let fileName = imgFolder + "/" + GetTempFileName() + ".png";

					await new Promise((resolve, reject) =>
					{
						request(imgSrc).pipe(fs.createWriteStream(fileName)).on("close", resolve);
						setTimeout(reject, 10000);
					});

					adEntry.adImage = fileName;
					adEntry.destination = adUrl;
				}
				else
					console.log("Unable to find ad image soruce. This should never happen.");
			}
			else
			{
				let content = await frame.$eval("html", x => x.outerHTML).catch(x => { return null; });

				// If its a google iframe
				if (content != null && typeof (content) == "string" && content.indexOf("google") != -1)
				{
					// Get all ad urls using the patterns
					var foundUrls = Array();

					patterns.forEach(pattern =>
					{
						var regexMatches = content.matchAll(pattern);

						var regexMatchesArray = [...(regexMatches || [])];

						if (regexMatchesArray.length > 0)
						{
							regexMatchesArray = regexMatchesArray.map(x => x.splice(-1)[0]);

							foundUrls = foundUrls.concat(regexMatchesArray);
						}
					});

					// Get all the ad urls using getUrls
					var additionalUrls = getUrls(content);

					foundUrls = foundUrls.concat(...additionalUrls);


					// Get the first one that matches one of the target urls
					var firstMatch = foundUrls.find(url =>
					{
						if (targetDomains.filter(x => url.indexOf(x) != -1).length > 0)
						{
							isKnown = true;
							return true;
						}
					});


					if (firstMatch == null)
					{
						// If there was no match from the target urls. Then get the first url on the list.
						firstMatch = foundUrls[0];
					}

					// If there was any url at all
					if (firstMatch != null)
						adEntry.destination = firstMatch;


					let handle = null;

					try
					{
						// // Get the iframe element by its index
						let handle = await page.evaluateHandle((index) =>
						{
							return window.frames[index].frameElement;
						}, frameIndex);
					}
					catch(err)
					{
						console.error("Failed to get handle of window frame. skipping", err);
					}

					if(handle == null)
						continue;

					// take a screenshot of it
					var fileName = imgFolder + "/" + GetTempFileName() + ".png";

					try 
					{
						await screenshotDOMElement2(page, fileName, handle);
						adEntry.adImage = fileName;
					}
					catch (err) 
					{
						// console.error(err);
					}
				}
			}

			if (isKnown == true)
				results.known.push(adEntry);
			else
				results.unknown.push(adEntry);

			// Increase the frame's index
			frameIndex++;
		}
	}

	for (var ent of results.known)
	{
		try
		{
			await page.goto(ent.destination);

			await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });

			fileName = imgFolder + "/" + GetTempFileName() + ".png";

			await page.screenshot({ path: fileName });

			ent.destinationScreenShot = fileName;
		}
		catch (err)
		{

		}
	}

	await browser.close();

	return results;
}





const sleep = (milliseconds) =>
{
	return new Promise(resolve => setTimeout(resolve, milliseconds))
}

async function screenshotDOMElement2(page, name, frame, padding = 0)
{
	const rect = await page.evaluate(frame => 
	{
		const element = frame;
		const { x, y, width, height } = element.getBoundingClientRect();
		return { left: x, top: y, width, height, id: element.id };
	}, frame);

	return await page.screenshot({
		path: name,
		clip: {
			x: rect.left - padding,
			y: rect.top - padding,
			width: rect.width + padding * 2,
			height: rect.height + padding * 2
		}
	});
}
async function autoScroll(page)
{
	await page.evaluate(async () =>
	{
		await new Promise((resolve, reject) =>
		{
			var totalHeight = 0;
			var distance = 100;
			var timer = setInterval(() =>
			{
				var scrollHeight = document.body.scrollHeight;
				window.scrollBy(0, distance);
				totalHeight += distance;

				if (totalHeight >= scrollHeight)
				{
					clearInterval(timer);
					resolve();
				}
			}, 100);
		});
	});

	await page.evaluate(async () =>
	{
		await new Promise((resolve, reject) =>
		{
			window.scrollBy(0, -document.body.scrollHeight);

			resolve();
		});
	});
}

function GetTempFileName()
{
	let d = new Date();

	return (d.getMonth() + 1) + "-" + d.getDate() + "-" + d.getFullYear() + "-" + d.getHours() + "-" + d.getMinutes() + "-" + d.getSeconds();
}
